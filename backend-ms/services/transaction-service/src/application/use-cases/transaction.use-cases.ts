import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { ITransactionRepository } from '../../domain/repositories/transaction-repository.interface.js';
import { Transaction } from '../../domain/entities/transaction.entity.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { ConfigGrpcClient } from '../../grpc/config-grpc.client.js';
import {
  MockPaymentGatewayAdapter,
  StripePaymentGatewayAdapter,
  PayPalPaymentGatewayAdapter,
  RazorpayPaymentGatewayAdapter
} from '../../infrastructure/adapters/payment-gateway.adapters.js';
import { IPaymentGatewayAdapter } from '../ports/payment-gateway.port.js';
import { TransactionDto } from '../../shared/contracts/index.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface InitiatePaymentInput {
  referenceId: string;
  userId: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
}

export class InitiatePaymentUseCase implements UseCase<InitiatePaymentInput, TransactionDto> {
  private adapters = new Map<string, IPaymentGatewayAdapter>();

  constructor(
    private readonly repo: ITransactionRepository,
    private readonly configClient: ConfigGrpcClient
  ) {
    this.adapters.set('MOCK', new MockPaymentGatewayAdapter());
    this.adapters.set('STRIPE', new StripePaymentGatewayAdapter());
    this.adapters.set('PAYPAL', new PayPalPaymentGatewayAdapter());
    this.adapters.set('RAZORPAY', new RazorpayPaymentGatewayAdapter());
  }

  async execute(input: InitiatePaymentInput): Promise<Result<TransactionDto>> {
    // Dynamically retrieve active payment gateway via gRPC from config-service!
    const activeGatewayName = (await this.configClient.getActiveGateway()).toUpperCase();
    const adapter = this.adapters.get(activeGatewayName) || this.adapters.get('STRIPE')!;

    const transaction = Transaction.create({
      referenceId: input.referenceId,
      userId: input.userId,
      type: 'PAYMENT',
      amount: input.amount,
      currency: input.currency || 'USD',
      paymentMethod: input.paymentMethod || activeGatewayName
    });

    const initResult = await adapter.initiate({
      transactionId: transaction.id,
      referenceId: input.referenceId,
      amount: input.amount,
      currency: transaction.currency
    });

    transaction.setProviderDetails(initResult.provider, initResult.sessionId, initResult.redirectUrl);
    await this.repo.save(transaction);

    logger.info(`Initiated ${initResult.provider} payment session ${initResult.sessionId} for transaction ${transaction.id}`);

    return Result.ok(this.mapDto(transaction));
  }

  private mapDto(txn: Transaction): TransactionDto {
    return {
      id: txn.id,
      referenceId: txn.referenceId,
      userId: txn.userId,
      type: txn.type,
      status: txn.status,
      amount: txn.amount,
      currency: txn.currency,
      paymentMethod: txn.paymentMethod,
      provider: txn.provider,
      providerSessionId: txn.providerSessionId,
      providerTransactionId: txn.providerTransactionId,
      redirectUrl: txn.redirectUrl,
      createdAt: txn.createdAt.toISOString(),
      updatedAt: txn.updatedAt.toISOString()
    };
  }
}

export interface CompletePaymentInput {
  transactionId: string;
  providerTxnId?: string;
  success: boolean;
  failureReason?: string;
}

export class CompletePaymentUseCase implements UseCase<CompletePaymentInput, TransactionDto> {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(input: CompletePaymentInput): Promise<Result<TransactionDto>> {
    const txn = await this.repo.findById(input.transactionId);
    if (!txn) return Result.fail('Transaction not found');

    if (input.success) {
      txn.markSuccess(input.providerTxnId);
    } else {
      txn.markFailed(input.failureReason || 'Payment rejected by gateway');
    }

    await this.repo.update(txn);

    // Publish RabbitMQ asynchronous integration event
    await rabbitmq.publish('transactions.transaction_completed', {
      id: crypto.randomUUID(),
      eventName: 'transactions.transaction_completed',
      aggregateId: txn.id,
      occurredAt: new Date().toISOString(),
      payload: {
        transactionId: txn.id,
        referenceId: txn.referenceId,
        userId: txn.userId,
        amount: txn.amount,
        currency: txn.currency,
        status: txn.status
      },
      version: 1
    });

    return Result.ok({
      id: txn.id,
      referenceId: txn.referenceId,
      userId: txn.userId,
      type: txn.type,
      status: txn.status,
      amount: txn.amount,
      currency: txn.currency,
      paymentMethod: txn.paymentMethod,
      failureReason: txn.failureReason,
      provider: txn.provider,
      providerSessionId: txn.providerSessionId,
      providerTransactionId: txn.providerTransactionId,
      redirectUrl: txn.redirectUrl,
      createdAt: txn.createdAt.toISOString(),
      updatedAt: txn.updatedAt.toISOString()
    });
  }
}

export class GetTransactionByIdQuery implements UseCase<{ id: string }, TransactionDto> {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(input: { id: string }): Promise<Result<TransactionDto>> {
    const txn = await this.repo.findById(input.id);
    if (!txn) return Result.fail('Transaction not found');

    return Result.ok({
      id: txn.id,
      referenceId: txn.referenceId,
      userId: txn.userId,
      type: txn.type,
      status: txn.status,
      amount: txn.amount,
      currency: txn.currency,
      paymentMethod: txn.paymentMethod,
      failureReason: txn.failureReason,
      provider: txn.provider,
      providerSessionId: txn.providerSessionId,
      providerTransactionId: txn.providerTransactionId,
      redirectUrl: txn.redirectUrl,
      createdAt: txn.createdAt.toISOString(),
      updatedAt: txn.updatedAt.toISOString()
    });
  }
}
