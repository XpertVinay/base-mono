export {
  TransactionModule,
  type ITransactionModulePublicApi
} from './transaction.module.js';

export {
  Transaction,
  InvalidTransactionStateError,
  InvalidTransactionAmountError,
  type TransactionProps
} from './domain/entities/transaction.entity.js';

export {
  type ITransactionRepository,
  type IWebhookEventRepository,
  type WebhookEventRecord
} from './domain/repositories/transaction-repository.interface.js';

export {
  PostgresTransactionRepository
} from './infrastructure/persistence/postgres-transaction.repository.js';

export {
  PostgresWebhookEventRepository
} from './infrastructure/persistence/postgres-webhook-event.repository.js';

export {
  type IPaymentGatewayAdapter,
  type PaymentInitiationInput,
  type PaymentInitiationResult,
  type PaymentChargeInput,
  type PaymentChargeResult,
  type WebhookPayload,
  type WebhookProcessingResult
} from './application/ports/payment-gateway.port.js';

export {
  DynamicPaymentGatewayRouter,
  type ConfigResolver
} from './infrastructure/adapters/dynamic-payment-gateway.router.js';

export {
  MockPaymentGatewayAdapter
} from './infrastructure/adapters/mock-payment-gateway.adapter.js';

export {
  StripePaymentGatewayAdapter
} from './infrastructure/adapters/stripe-payment-gateway.adapter.js';

export {
  PayPalPaymentGatewayAdapter
} from './infrastructure/adapters/paypal-payment-gateway.adapter.js';

export {
  RazorpayPaymentGatewayAdapter
} from './infrastructure/adapters/razorpay-payment-gateway.adapter.js';

export {
  InitiatePaymentUseCase,
  HandlePaymentWebhookUseCase,
  ProcessPaymentUseCase,
  RefundTransactionUseCase,
  GetTransactionByIdQuery,
  ListTenantTransactionsQuery,
  ListMyTransactionsQuery,
  type InitiatePaymentInput,
  type ProcessPaymentInput,
  type HandleWebhookInput,
  type RefundTransactionInput
} from './application/use-cases/transaction.use-cases.js';

export {
  TransactionController
} from './presentation/http/transaction.controller.js';

export {
  createTransactionRouter
} from './presentation/http/transaction.routes.js';
