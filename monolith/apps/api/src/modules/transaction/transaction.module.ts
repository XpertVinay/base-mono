import { Router } from 'express';
import { PostgresTransactionRepository } from './infrastructure/persistence/postgres-transaction.repository.js';
import { PostgresWebhookEventRepository } from './infrastructure/persistence/postgres-webhook-event.repository.js';
import {
  ProcessPaymentUseCase,
  InitiatePaymentUseCase,
  HandlePaymentWebhookUseCase,
  RefundTransactionUseCase,
  GetTransactionByIdQuery,
  ListTenantTransactionsQuery,
  ListMyTransactionsQuery,
  InitiatePaymentInput
} from './application/use-cases/transaction.use-cases.js';
import { TransactionController } from './presentation/http/transaction.controller.js';
import { createTransactionRouter } from './presentation/http/transaction.routes.js';
import { DynamicPaymentGatewayRouter, ConfigResolver } from './infrastructure/adapters/dynamic-payment-gateway.router.js';
import { MockPaymentGatewayAdapter } from './infrastructure/adapters/mock-payment-gateway.adapter.js';
import { StripePaymentGatewayAdapter } from './infrastructure/adapters/stripe-payment-gateway.adapter.js';
import { PayPalPaymentGatewayAdapter } from './infrastructure/adapters/paypal-payment-gateway.adapter.js';
import { RazorpayPaymentGatewayAdapter } from './infrastructure/adapters/razorpay-payment-gateway.adapter.js';
import { eventBus, IEventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { TransactionDto, InitiatePaymentResponseDto } from '@monolith/contracts';
import { IConfigModulePublicApi } from '../config/index.js';
import {
  ITransactionRepository,
  IWebhookEventRepository
} from './domain/repositories/transaction-repository.interface.js';

export interface ITransactionModulePublicApi {
  getTransactionById(id: string, tenantId?: string): Promise<TransactionDto | null>;
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResponseDto>;
  refundTransaction(id: string, tenantId?: string, reason?: string, amount?: number): Promise<boolean>;
  getActivePaymentGateway(tenantId?: string): Promise<string>;
  getRepository(): ITransactionRepository;
  getWebhookEventRepository(): IWebhookEventRepository;
}

export class TransactionModule {
  public static init(
    customRepository?: ITransactionRepository,
    customWebhookEventRepository?: IWebhookEventRepository,
    customGatewayRouter?: DynamicPaymentGatewayRouter,
    customEventBus?: IEventBus
  ): {
    router: Router;
    publicApi: ITransactionModulePublicApi;
    repository: ITransactionRepository;
    webhookEventRepository: IWebhookEventRepository;
    gatewayRouter: DynamicPaymentGatewayRouter;
  } {
    const repository = customRepository || new PostgresTransactionRepository();
    const webhookEventRepository = customWebhookEventRepository || new PostgresWebhookEventRepository();
    const bus = customEventBus || eventBus;

    // Resolves database configuration flags dynamically without hardcoupling
    const configResolver: ConfigResolver = async (key: string, defaultValue = 'STRIPE', tenantId?: string) => {
      try {
        const configApi = container.resolve<IConfigModulePublicApi>('IConfigModulePublicApi');
        // Support tenant-specific configuration key if tenantId is provided
        if (tenantId) {
          const tenantKey = `${tenantId}_${key}`;
          const tenantVal = await configApi.get(tenantKey, '');
          if (tenantVal) return tenantVal;
        }
        return await configApi.get(key, defaultValue);
      } catch {
        return defaultValue;
      }
    };

    let gatewayRouter = customGatewayRouter;
    if (!gatewayRouter) {
      const mockAdapter = new MockPaymentGatewayAdapter();
      const stripeAdapter = new StripePaymentGatewayAdapter();
      const paypalAdapter = new PayPalPaymentGatewayAdapter();
      const razorpayAdapter = new RazorpayPaymentGatewayAdapter();

      gatewayRouter = new DynamicPaymentGatewayRouter(configResolver, [
        stripeAdapter,
        paypalAdapter,
        razorpayAdapter,
        mockAdapter
      ]);
    }

    const initiatePaymentUseCase = new InitiatePaymentUseCase(repository, gatewayRouter);
    const handlePaymentWebhookUseCase = new HandlePaymentWebhookUseCase(
      repository,
      bus,
      gatewayRouter,
      webhookEventRepository
    );
    const processPaymentUseCase = new ProcessPaymentUseCase(repository, bus, gatewayRouter);
    const refundTransactionUseCase = new RefundTransactionUseCase(repository, bus, gatewayRouter);
    const getTransactionByIdQuery = new GetTransactionByIdQuery(repository);
    const listTenantTransactionsQuery = new ListTenantTransactionsQuery(repository);
    const listMyTransactionsQuery = new ListMyTransactionsQuery(repository);

    const controller = new TransactionController(
      initiatePaymentUseCase,
      handlePaymentWebhookUseCase,
      processPaymentUseCase,
      refundTransactionUseCase,
      getTransactionByIdQuery,
      listTenantTransactionsQuery,
      listMyTransactionsQuery,
      gatewayRouter
    );

    const router = createTransactionRouter(controller);

    const publicApi: ITransactionModulePublicApi = {
      getTransactionById: async (id: string, tenantId?: string) => {
        const res = await getTransactionByIdQuery.execute({ id, tenantId });
        return res.isSuccess ? res.getValue() : null;
      },
      initiatePayment: async (input: InitiatePaymentInput) => {
        const res = await initiatePaymentUseCase.execute(input);
        if (res.isFailure) throw res.getError();
        return res.getValue();
      },
      refundTransaction: async (id: string, tenantId?: string, reason?: string, amount?: number) => {
        const res = await refundTransactionUseCase.execute({
          transactionId: id,
          tenantId,
          userId: 'system',
          reason,
          amount
        });
        return res.isSuccess;
      },
      getActivePaymentGateway: async (tenantId?: string) => {
        const active = await gatewayRouter.getActiveAdapter(tenantId);
        return active.providerName;
      },
      getRepository: () => repository,
      getWebhookEventRepository: () => webhookEventRepository
    };

    try {
      container.register('ITransactionModulePublicApi', publicApi);
    } catch {
      // Container registration fallback
    }

    return {
      router,
      publicApi,
      repository,
      webhookEventRepository,
      gatewayRouter
    };
  }
}
