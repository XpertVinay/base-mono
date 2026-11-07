import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import {
  ITransactionRepository,
  IWebhookEventRepository
} from '../../domain/repositories/transaction-repository.interface.js';
import {
  Transaction,
  InvalidTransactionStateError,
  InvalidTransactionAmountError
} from '../../domain/entities/transaction.entity.js';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';
import {
  IPaymentGatewayAdapter,
  WebhookPayload,
  WebhookProcessingResult
} from '../ports/payment-gateway.port.js';
import {
  ProcessPaymentRequestDto,
  TransactionDto,
  InitiatePaymentRequestDto,
  InitiatePaymentResponseDto,
  RefundPaymentResponseDto
} from '@monolith/contracts';
import { DynamicPaymentGatewayRouter } from '../../infrastructure/adapters/dynamic-payment-gateway.router.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { NotFoundError, BadRequestError } from '../../../../shared/presentation/error-handler.middleware.js';

export interface ProcessPaymentInput extends ProcessPaymentRequestDto {
  userId: string;
}

export interface InitiatePaymentInput extends InitiatePaymentRequestDto {
  userId: string;
  customerEmail?: string;
}

export interface HandleWebhookInput {
  provider: string;
  payload: WebhookPayload;
  rawBody?: string;
  signature?: string;
  tenantId?: string;
}

export interface RefundTransactionInput {
  transactionId: string;
  tenantId?: string;
  userId: string;
  reason?: string;
  amount?: number;
}

export class InitiatePaymentUseCase implements IUseCase<InitiatePaymentInput, InitiatePaymentResponseDto> {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly paymentGateway: IPaymentGatewayAdapter
  ) {}

  async execute(input: InitiatePaymentInput): Promise<Result<InitiatePaymentResponseDto, Error>> {
    try {
      const transaction = Transaction.create(
        input.referenceId,
        input.userId,
        input.amount,
        input.paymentMethod || 'PENDING_GATEWAY_SELECTION',
        input.currency || 'USD',
        'PAYMENT',
        undefined,
        input.tenantId
      );

      // Save initial PENDING state in ledger
      await this.transactionRepository.save(transaction);

      const defaultBaseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:8080';
      const returnUrl = input.returnUrl || `${defaultBaseUrl}/transactions/callback`;
      const cancelUrl = input.cancelUrl || `${defaultBaseUrl}/transactions/callback`;

      // Initiate checkout session with active gateway provider adapter
      const initiation = await this.paymentGateway.initiate({
        transactionId: transaction.id,
        referenceId: input.referenceId,
        userId: input.userId,
        tenantId: input.tenantId,
        amount: input.amount,
        currency: input.currency || 'USD',
        customerEmail: input.customerEmail,
        returnUrl,
        cancelUrl
      });

      // Update transaction entity with provider details
      transaction.setInitiationDetails(
        initiation.provider,
        initiation.providerSessionId,
        initiation.redirectUrl
      );

      await this.transactionRepository.save(transaction);

      return Result.ok({
        transactionId: transaction.id,
        tenantId: transaction.tenantId,
        referenceId: transaction.referenceId,
        status: transaction.status,
        provider: initiation.provider,
        redirectUrl: initiation.redirectUrl,
        providerSessionId: initiation.providerSessionId
      });
    } catch (err: any) {
      logger.error('Failed to initiate payment transaction', err);
      return Result.fail(err);
    }
  }
}

export class HandlePaymentWebhookUseCase implements IUseCase<HandleWebhookInput, WebhookProcessingResult> {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly eventBus: IEventBus,
    private readonly gatewayRouter: DynamicPaymentGatewayRouter,
    private readonly webhookEventRepo: IWebhookEventRepository
  ) {}

  async execute({
    provider,
    payload,
    rawBody,
    signature,
    tenantId
  }: HandleWebhookInput): Promise<Result<WebhookProcessingResult, Error>> {
    try {
      const providerUpper = provider.toUpperCase();

      // 1. Signature Verification
      const sigToVerify =
        signature ||
        (payload.headers['stripe-signature'] as string) ||
        (payload.headers['x-razorpay-signature'] as string) ||
        (payload.headers['signature'] as string);

      if (sigToVerify) {
        const bodyStr = rawBody || (typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body));
        const isValid = this.gatewayRouter.verifyProviderWebhookSignature(
          providerUpper,
          bodyStr,
          sigToVerify
        );
        if (!isValid) {
          logger.warn(`Invalid signature detected for ${providerUpper} webhook`, { provider: providerUpper });
          return Result.fail(new BadRequestError(`Invalid signature for ${providerUpper} webhook`));
        }
      }

      // 2. Process provider-specific payload
      const result = await this.gatewayRouter.processProviderWebhook(providerUpper, payload);

      if (!result.handled || result.status === 'IGNORED') {
        return Result.ok(result);
      }

      // 3. Idempotency Check & Replay Defense
      if (result.eventId) {
        const alreadyProcessed = await this.webhookEventRepo.hasEvent(providerUpper, result.eventId);
        if (alreadyProcessed) {
          logger.info(`Webhook event already processed (idempotency hit)`, {
            provider: providerUpper,
            eventId: result.eventId
          });
          return Result.ok({
            ...result,
            status: 'ALREADY_PROCESSED'
          });
        }

        // Record event in ledger
        await this.webhookEventRepo.recordEvent({
          provider: providerUpper,
          eventId: result.eventId,
          eventType: result.eventType || 'unknown',
          payload: payload.body,
          tenantId
        });
      }

      // 4. Look up transaction
      let transaction: Transaction | null = null;
      if (result.transactionId) {
        transaction = await this.transactionRepository.findById(result.transactionId, tenantId);
      }
      if (!transaction && result.providerTransactionId) {
        transaction = await this.transactionRepository.findBySessionId(result.providerTransactionId);
      }
      if (!transaction && result.referenceId) {
        const txs = await this.transactionRepository.findByReferenceId(result.referenceId, tenantId);
        transaction = txs.find(t => t.status === 'PENDING') || txs[0] || null;
      }

      if (!transaction) {
        logger.warn('Webhook processed but associated transaction not found', { result });
        return Result.ok(result);
      }

      // 5. Update transaction state
      if (result.status === 'SUCCESS' && transaction.status === 'PENDING') {
        transaction.complete(result.providerTransactionId);
        await this.transactionRepository.save(transaction);

        // Publish domain integration event to decouple modules (e.g. Orders -> PAID)
        for (const event of transaction.domainEvents) {
          await this.eventBus.publish({
            id: event.id,
            eventName: event.eventName,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredAt.toISOString(),
            payload: event.payload,
            version: event.version
          });
        }
        transaction.clearEvents();
        logger.info(`Transaction ${transaction.id} completed via ${providerUpper} webhook`);
      } else if (result.status === 'FAILED' && transaction.status === 'PENDING') {
        transaction.fail(result.failureReason || 'Failed at provider', result.providerTransactionId);
        await this.transactionRepository.save(transaction);

        for (const event of transaction.domainEvents) {
          await this.eventBus.publish({
            id: event.id,
            eventName: event.eventName,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredAt.toISOString(),
            payload: event.payload,
            version: event.version
          });
        }
        transaction.clearEvents();
        logger.warn(`Transaction ${transaction.id} failed via ${providerUpper} webhook`);
      }

      return Result.ok(result);
    } catch (err: any) {
      logger.error(`Error processing ${provider} webhook`, err);
      return Result.fail(err);
    }
  }
}

export class ProcessPaymentUseCase implements IUseCase<ProcessPaymentInput, TransactionDto> {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly eventBus: IEventBus,
    private readonly paymentGateway: IPaymentGatewayAdapter
  ) {}

  async execute(input: ProcessPaymentInput): Promise<Result<TransactionDto, Error>> {
    try {
      const gatewayResult = await this.paymentGateway.charge({
        referenceId: input.referenceId,
        userId: input.userId,
        tenantId: input.tenantId,
        amount: input.amount,
        currency: input.currency || 'USD',
        paymentMethod: input.paymentMethod
      });

      const displayPaymentMethod = `${gatewayResult.provider} (${input.paymentMethod || 'Default'})`;

      const transaction = Transaction.create(
        input.referenceId,
        input.userId,
        input.amount,
        displayPaymentMethod,
        input.currency || 'USD',
        'PAYMENT',
        undefined,
        input.tenantId
      );

      if (gatewayResult.status === 'SUCCESS') {
        transaction.complete(gatewayResult.providerTransactionId);
      } else {
        transaction.fail(gatewayResult.failureReason || 'Payment rejected by gateway', gatewayResult.providerTransactionId);
      }

      await this.transactionRepository.save(transaction);

      if (transaction.status === 'SUCCESS') {
        for (const event of transaction.domainEvents) {
          await this.eventBus.publish({
            id: event.id,
            eventName: event.eventName,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredAt.toISOString(),
            payload: event.payload,
            version: event.version
          });
        }
        transaction.clearEvents();
      }

      return Result.ok(this.mapToDto(transaction));
    } catch (err: any) {
      return Result.fail(err);
    }
  }

  private mapToDto(t: Transaction): TransactionDto {
    return {
      id: t.id,
      tenantId: t.tenantId,
      referenceId: t.referenceId,
      userId: t.userId,
      type: t.type,
      status: t.status,
      amount: t.amount,
      currency: t.currency,
      paymentMethod: t.paymentMethod,
      provider: t.provider,
      providerSessionId: t.providerSessionId,
      providerTransactionId: t.providerTransactionId,
      redirectUrl: t.redirectUrl,
      failureReason: t.failureReason,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString()
    };
  }
}

export class RefundTransactionUseCase implements IUseCase<RefundTransactionInput, RefundPaymentResponseDto> {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly eventBus: IEventBus,
    private readonly paymentGateway: DynamicPaymentGatewayRouter
  ) {}

  async execute(input: RefundTransactionInput): Promise<Result<RefundPaymentResponseDto, Error>> {
    try {
      const transaction = await this.transactionRepository.findById(input.transactionId, input.tenantId);
      if (!transaction) {
        return Result.fail(new NotFoundError(`Transaction ${input.transactionId} not found or quarantined`));
      }

      const refundAmount = input.amount !== undefined ? input.amount : transaction.amount;

      // Domain-level validation
      transaction.refund(input.reason, refundAmount);

      // Coordinate with gateway adapter
      if (transaction.providerTransactionId) {
        try {
          await this.paymentGateway.refund(
            transaction.providerTransactionId,
            refundAmount,
            transaction.provider
          );
        } catch (gatewayErr: any) {
          logger.warn('Gateway refund call failed, continuing ledger refund', {
            error: gatewayErr.message
          });
        }
      }

      await this.transactionRepository.save(transaction);

      // Publish domain integration event
      for (const event of transaction.domainEvents) {
        await this.eventBus.publish({
          id: event.id,
          eventName: event.eventName,
          aggregateId: event.aggregateId,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
          version: event.version
        });
      }
      transaction.clearEvents();

      return Result.ok({
        transactionId: transaction.id,
        referenceId: transaction.referenceId,
        status: transaction.status,
        amount: transaction.amount,
        refundedAmount: refundAmount,
        reason: input.reason
      });
    } catch (err: any) {
      if (err instanceof InvalidTransactionStateError || err instanceof InvalidTransactionAmountError) {
        return Result.fail(new BadRequestError(err.message));
      }
      return Result.fail(err);
    }
  }
}

export class GetTransactionByIdQuery implements IQuery<{ id: string; tenantId?: string }, TransactionDto | null> {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute({ id, tenantId }: { id: string; tenantId?: string }): Promise<Result<TransactionDto | null, Error>> {
    try {
      const transaction = await this.transactionRepository.findById(id, tenantId);
      if (!transaction) return Result.ok(null);

      return Result.ok({
        id: transaction.id,
        tenantId: transaction.tenantId,
        referenceId: transaction.referenceId,
        userId: transaction.userId,
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentMethod: transaction.paymentMethod,
        provider: transaction.provider,
        providerSessionId: transaction.providerSessionId,
        providerTransactionId: transaction.providerTransactionId,
        redirectUrl: transaction.redirectUrl,
        failureReason: transaction.failureReason,
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListTenantTransactionsQuery implements IQuery<
  { tenantId: string; limit?: number; offset?: number },
  { transactions: TransactionDto[]; total: number }
> {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute({
    tenantId,
    limit,
    offset
  }: {
    tenantId: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<{ transactions: TransactionDto[]; total: number }, Error>> {
    try {
      const { transactions, total } = await this.transactionRepository.findByTenantId(tenantId, limit, offset);
      return Result.ok({
        transactions: transactions.map(t => ({
          id: t.id,
          tenantId: t.tenantId,
          referenceId: t.referenceId,
          userId: t.userId,
          type: t.type,
          status: t.status,
          amount: t.amount,
          currency: t.currency,
          paymentMethod: t.paymentMethod,
          provider: t.provider,
          providerSessionId: t.providerSessionId,
          providerTransactionId: t.providerTransactionId,
          redirectUrl: t.redirectUrl,
          failureReason: t.failureReason,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString()
        })),
        total
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListMyTransactionsQuery implements IQuery<{ userId: string; tenantId?: string }, TransactionDto[]> {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute({ userId, tenantId }: { userId: string; tenantId?: string }): Promise<Result<TransactionDto[], Error>> {
    try {
      const transactions = await this.transactionRepository.findByUserId(userId, tenantId);
      return Result.ok(transactions.map(t => ({
        id: t.id,
        tenantId: t.tenantId,
        referenceId: t.referenceId,
        userId: t.userId,
        type: t.type,
        status: t.status,
        amount: t.amount,
        currency: t.currency,
        paymentMethod: t.paymentMethod,
        provider: t.provider,
        providerSessionId: t.providerSessionId,
        providerTransactionId: t.providerTransactionId,
        redirectUrl: t.redirectUrl,
        failureReason: t.failureReason,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
