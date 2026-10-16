import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ITransactionRepository } from '../../domain/repositories/transaction-repository.interface.js';
import { Transaction } from '../../domain/entities/transaction.entity.js';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';
import { IPaymentGatewayAdapter, WebhookPayload, WebhookProcessingResult } from '../ports/payment-gateway.port.js';
import {
  ProcessPaymentRequestDto,
  TransactionDto,
  InitiatePaymentRequestDto,
  InitiatePaymentResponseDto
} from '@monolith/contracts';
import { DynamicPaymentGatewayRouter } from '../../infrastructure/adapters/dynamic-payment-gateway.router.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface ProcessPaymentInput extends ProcessPaymentRequestDto {
  userId: string;
}

export interface InitiatePaymentInput extends InitiatePaymentRequestDto {
  userId: string;
  customerEmail?: string;
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
        input.currency || 'USD'
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

export class HandlePaymentWebhookUseCase implements IUseCase<{ provider: string; payload: WebhookPayload }, WebhookProcessingResult> {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly eventBus: IEventBus,
    private readonly gatewayRouter: DynamicPaymentGatewayRouter
  ) {}

  async execute({ provider, payload }: { provider: string; payload: WebhookPayload }): Promise<Result<WebhookProcessingResult, Error>> {
    try {
      const result = await this.gatewayRouter.processProviderWebhook(provider, payload);

      if (!result.handled || result.status === 'IGNORED') {
        return Result.ok(result);
      }

      // Look up transaction
      let transaction: Transaction | null = null;
      if (result.transactionId) {
        transaction = await this.transactionRepository.findById(result.transactionId);
      }
      if (!transaction && result.providerTransactionId) {
        transaction = await this.transactionRepository.findBySessionId(result.providerTransactionId);
      }
      if (!transaction && result.referenceId) {
        const txs = await this.transactionRepository.findByReferenceId(result.referenceId);
        transaction = txs.find(t => t.status === 'PENDING') || txs[0] || null;
      }

      if (!transaction) {
        logger.warn('Webhook processed but associated transaction not found', { result });
        return Result.ok(result);
      }

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
        logger.info(`Transaction ${transaction.id} completed via ${provider} webhook`);
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
        logger.warn(`Transaction ${transaction.id} failed via ${provider} webhook`);
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
        input.currency || 'USD'
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
      referenceId: t.referenceId,
      userId: t.userId,
      type: t.type,
      status: t.status,
      amount: t.amount,
      currency: t.currency,
      paymentMethod: t.paymentMethod,
      failureReason: t.failureReason,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString()
    };
  }
}

export class ListMyTransactionsQuery implements IQuery<{ userId: string }, TransactionDto[]> {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute({ userId }: { userId: string }): Promise<Result<TransactionDto[], Error>> {
    try {
      const transactions = await this.transactionRepository.findByUserId(userId);
      return Result.ok(transactions.map(t => ({
        id: t.id,
        referenceId: t.referenceId,
        userId: t.userId,
        type: t.type,
        status: t.status,
        amount: t.amount,
        currency: t.currency,
        paymentMethod: t.paymentMethod,
        failureReason: t.failureReason,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
