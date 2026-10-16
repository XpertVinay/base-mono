import { Router } from 'express';
import { PostgresTransactionRepository } from './infrastructure/persistence/postgres-transaction.repository.js';
import {
  ProcessPaymentUseCase,
  InitiatePaymentUseCase,
  HandlePaymentWebhookUseCase,
  ListMyTransactionsQuery
} from './application/use-cases/transaction.use-cases.js';
import { TransactionController } from './presentation/http/transaction.controller.js';
import { createTransactionRouter } from './presentation/http/transaction.routes.js';
import { DynamicPaymentGatewayRouter, ConfigResolver } from './infrastructure/adapters/dynamic-payment-gateway.router.js';
import { MockPaymentGatewayAdapter } from './infrastructure/adapters/mock-payment-gateway.adapter.js';
import { StripePaymentGatewayAdapter } from './infrastructure/adapters/stripe-payment-gateway.adapter.js';
import { PayPalPaymentGatewayAdapter } from './infrastructure/adapters/paypal-payment-gateway.adapter.js';
import { RazorpayPaymentGatewayAdapter } from './infrastructure/adapters/razorpay-payment-gateway.adapter.js';
import { eventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { TransactionDto } from '@monolith/contracts';
import { IConfigModulePublicApi } from '../config/index.js';

export interface ITransactionModulePublicApi {
  getTransactionById(id: string): Promise<TransactionDto | null>;
  getActivePaymentGateway(): Promise<string>;
}

export class TransactionModule {
  public static init(): { router: Router; publicApi: ITransactionModulePublicApi } {
    const repository = new PostgresTransactionRepository();

    // Resolves database configuration flags dynamically without hardcoupling
    const configResolver: ConfigResolver = async (key: string, defaultValue = 'STRIPE') => {
      try {
        const configApi = container.resolve<IConfigModulePublicApi>('IConfigModulePublicApi');
        return await configApi.get(key, defaultValue);
      } catch {
        return defaultValue;
      }
    };

    // Instantiate adapters for popular payment gateways
    const mockAdapter = new MockPaymentGatewayAdapter();
    const stripeAdapter = new StripePaymentGatewayAdapter();
    const paypalAdapter = new PayPalPaymentGatewayAdapter();
    const razorpayAdapter = new RazorpayPaymentGatewayAdapter();

    // Instantiate Dynamic Router with database config flag selection
    const gatewayRouter = new DynamicPaymentGatewayRouter(configResolver, [
      stripeAdapter,
      paypalAdapter,
      razorpayAdapter,
      mockAdapter
    ]);

    const initiatePaymentUseCase = new InitiatePaymentUseCase(repository, gatewayRouter);
    const handlePaymentWebhookUseCase = new HandlePaymentWebhookUseCase(repository, eventBus, gatewayRouter);
    const processPaymentUseCase = new ProcessPaymentUseCase(repository, eventBus, gatewayRouter);
    const listMyTransactionsQuery = new ListMyTransactionsQuery(repository);

    const controller = new TransactionController(
      initiatePaymentUseCase,
      handlePaymentWebhookUseCase,
      processPaymentUseCase,
      listMyTransactionsQuery,
      gatewayRouter,
      repository
    );

    const router = createTransactionRouter(controller);

    const publicApi: ITransactionModulePublicApi = {
      getTransactionById: async (id: string) => {
        const t = await repository.findById(id);
        if (!t) return null;
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
      },
      getActivePaymentGateway: async () => {
        const active = await gatewayRouter.getActiveAdapter();
        return active.providerName;
      }
    };

    container.register('ITransactionModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
