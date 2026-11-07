import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import {
  Transaction,
  InvalidTransactionStateError,
  InvalidTransactionAmountError,
  PostgresTransactionRepository,
  PostgresWebhookEventRepository,
  DynamicPaymentGatewayRouter,
  MockPaymentGatewayAdapter,
  StripePaymentGatewayAdapter,
  RazorpayPaymentGatewayAdapter,
  InitiatePaymentUseCase,
  HandlePaymentWebhookUseCase,
  ProcessPaymentUseCase,
  RefundTransactionUseCase,
  GetTransactionByIdQuery,
  ListTenantTransactionsQuery,
  ListMyTransactionsQuery,
  TransactionController,
  TransactionModule
} from '../../modules/transaction/index.js';
import { InMemoryEventBus } from '../../infrastructure/messaging/event-bus.js';
import { Order, OrderModule } from '../../modules/order/index.js';
import { Request, Response } from 'express';
import {
  NotFoundError,
  BadRequestError
} from '../../shared/presentation/error-handler.middleware.js';

describe('Sprint 09: Multi-Gateway Payment Routing, Webhook Idempotency & Transaction Ledgers', () => {
  let transactionRepo: PostgresTransactionRepository;
  let webhookRepo: PostgresWebhookEventRepository;
  let eventBus: InMemoryEventBus;
  let mockAdapter: MockPaymentGatewayAdapter;
  let stripeAdapter: StripePaymentGatewayAdapter;
  let razorpayAdapter: RazorpayPaymentGatewayAdapter;
  let gatewayRouter: DynamicPaymentGatewayRouter;

  let initiateUseCase: InitiatePaymentUseCase;
  let handleWebhookUseCase: HandlePaymentWebhookUseCase;
  let processPaymentUseCase: ProcessPaymentUseCase;
  let refundUseCase: RefundTransactionUseCase;
  let getByIdQuery: GetTransactionByIdQuery;
  let listTenantQuery: ListTenantTransactionsQuery;
  let listMyQuery: ListMyTransactionsQuery;
  let controller: TransactionController;

  const TENANT_A = 'org-tenant-alpha-100';
  const TENANT_B = 'org-tenant-beta-200';
  const USER_A1 = 'user-alpha-001';
  const USER_A2 = 'user-alpha-002';
  const STRIPE_SECRET = 'whsec_test_secret_for_stripe_webhooks';
  const RAZORPAY_SECRET = 'rzp_test_secret_for_razorpay_webhooks';

  beforeEach(() => {
    transactionRepo = new PostgresTransactionRepository();
    webhookRepo = new PostgresWebhookEventRepository();
    eventBus = new InMemoryEventBus();

    mockAdapter = new MockPaymentGatewayAdapter();
    stripeAdapter = new StripePaymentGatewayAdapter('sk_test_dummy_key', STRIPE_SECRET);
    razorpayAdapter = new RazorpayPaymentGatewayAdapter('rzp_test_dummy_id', RAZORPAY_SECRET, RAZORPAY_SECRET);

    // Dynamic config resolver supporting global and tenant-specific gateway selection
    const tenantGateways = new Map<string, string>();
    tenantGateways.set(TENANT_B, 'RAZORPAY');

    const configResolver = async (_key: string, defaultValue = 'STRIPE', tenantId?: string) => {
      if (tenantId && tenantGateways.has(tenantId)) {
        return tenantGateways.get(tenantId)!;
      }
      return defaultValue;
    };

    gatewayRouter = new DynamicPaymentGatewayRouter(configResolver, [
      stripeAdapter,
      razorpayAdapter,
      mockAdapter
    ]);

    initiateUseCase = new InitiatePaymentUseCase(transactionRepo, gatewayRouter);
    handleWebhookUseCase = new HandlePaymentWebhookUseCase(transactionRepo, eventBus, gatewayRouter, webhookRepo);
    processPaymentUseCase = new ProcessPaymentUseCase(transactionRepo, eventBus, gatewayRouter);
    refundUseCase = new RefundTransactionUseCase(transactionRepo, eventBus, gatewayRouter);
    getByIdQuery = new GetTransactionByIdQuery(transactionRepo);
    listTenantQuery = new ListTenantTransactionsQuery(transactionRepo);
    listMyQuery = new ListMyTransactionsQuery(transactionRepo);

    controller = new TransactionController(
      initiateUseCase,
      handleWebhookUseCase,
      processPaymentUseCase,
      refundUseCase,
      getByIdQuery,
      listTenantQuery,
      listMyQuery,
      gatewayRouter
    );
  });

  // Helper for generating genuine Stripe HMAC-SHA256 signatures
  function createStripeSignature(rawBody: string, secret: string, timestamp?: number): string {
    const t = timestamp || Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${t}.${rawBody}`)
      .digest('hex');
    return `t=${t},v1=${signature}`;
  }

  // Helper for generating genuine Razorpay HMAC-SHA256 signatures
  function createRazorpaySignature(rawBody: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
  }

  describe('1. State Machine Lifecycle Transitions & Pricing Invariants', () => {
    it('follows valid lifecycle: PENDING -> SUCCESS -> REFUNDED', () => {
      const tx = Transaction.create('ref-order-01', USER_A1, 150.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-test-01', TENANT_A);
      expect(tx.status).toBe('PENDING');
      expect(tx.amount).toBe(150.00);

      tx.complete('pi_stripe_12345');
      expect(tx.status).toBe('SUCCESS');
      expect(tx.providerTransactionId).toBe('pi_stripe_12345');
      expect(tx.domainEvents.some(e => e.eventName === 'transactions.completed')).toBe(true);

      tx.refund('Customer return', 150.00, 're_stripe_99999');
      expect(tx.status).toBe('REFUNDED');
      expect(tx.failureReason).toBe('Customer return');
      expect(tx.domainEvents.some(e => e.eventName === 'transactions.refunded')).toBe(true);
    });

    it('follows failure lifecycle: PENDING -> FAILED', () => {
      const tx = Transaction.create('ref-order-02', USER_A1, 49.99, 'STRIPE', 'USD', 'PAYMENT', 'tx-test-02', TENANT_A);
      tx.fail('Insufficient funds', 'pi_failed_123');
      expect(tx.status).toBe('FAILED');
      expect(tx.failureReason).toBe('Insufficient funds');
      expect(tx.domainEvents.some(e => e.eventName === 'transactions.failed')).toBe(true);
    });

    it('rejects completing a transaction that is not PENDING', () => {
      const tx = Transaction.create('ref-order-03', USER_A1, 100.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-test-03', TENANT_A);
      tx.complete('pi_first');
      expect(() => tx.complete('pi_second')).toThrow(InvalidTransactionStateError);
    });

    it('rejects refunding a transaction that is not in SUCCESS status', () => {
      const pendingTx = Transaction.create('ref-order-04', USER_A1, 100.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-test-04', TENANT_A);
      expect(() => pendingTx.refund()).toThrow(InvalidTransactionStateError);

      const failedTx = Transaction.create('ref-order-05', USER_A1, 100.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-test-05', TENANT_A);
      failedTx.fail('Card declined');
      expect(() => failedTx.refund()).toThrow(InvalidTransactionStateError);
    });

    it('rejects refund amount that exceeds original transaction amount or is zero/negative', () => {
      const tx = Transaction.create('ref-order-06', USER_A1, 100.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-test-06', TENANT_A);
      tx.complete('pi_ok');

      expect(() => tx.refund('Exceeding', 150.00)).toThrow(InvalidTransactionAmountError);
      expect(() => tx.refund('Zero', 0)).toThrow(InvalidTransactionAmountError);
      expect(() => tx.refund('Negative', -10)).toThrow(InvalidTransactionAmountError);
    });

    it('rejects transaction creation with non-positive amount and enforces 2-decimal precision', () => {
      expect(() => Transaction.create('ref-01', USER_A1, 0, 'CARD')).toThrow(InvalidTransactionAmountError);
      expect(() => Transaction.create('ref-01', USER_A1, -50, 'CARD')).toThrow(InvalidTransactionAmountError);

      const tx = Transaction.create('ref-02', USER_A1, 99.999, 'CARD');
      expect(tx.amount).toBe(100.00); // 2-decimal rounding invariant
    });
  });

  describe('2. Multi-Tenant Quarantine & Boundary Isolation', () => {
    it('Tenant B cannot retrieve Tenant A transaction (NotFoundError / null)', async () => {
      const txA = Transaction.create('order-alpha-01', USER_A1, 250.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-alpha-100', TENANT_A);
      await transactionRepo.save(txA);

      // Tenant A can retrieve it
      const resA = await getByIdQuery.execute({ id: 'tx-alpha-100', tenantId: TENANT_A });
      expect(resA.isSuccess).toBe(true);
      expect(resA.getValue()).not.toBeNull();
      expect(resA.getValue()!.id).toBe('tx-alpha-100');

      // Tenant B query returns null
      const resB = await getByIdQuery.execute({ id: 'tx-alpha-100', tenantId: TENANT_B });
      expect(resB.isSuccess).toBe(true);
      expect(resB.getValue()).toBeNull();
    });

    it('Tenant B cannot refund Tenant A transaction', async () => {
      const txA = Transaction.create('order-alpha-02', USER_A1, 500.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-alpha-200', TENANT_A);
      txA.complete('pi_alpha_success');
      await transactionRepo.save(txA);

      // Tenant B attempts refund
      const refundResult = await refundUseCase.execute({
        transactionId: 'tx-alpha-200',
        tenantId: TENANT_B,
        userId: 'attacker-b',
        reason: 'Illegal cross-tenant refund'
      });

      expect(refundResult.isFailure).toBe(true);
      expect(refundResult.getError()).toBeInstanceOf(NotFoundError);

      // Ensure Tenant A transaction remains SUCCESS and unchanged
      const current = await transactionRepo.findById('tx-alpha-200', TENANT_A);
      expect(current!.status).toBe('SUCCESS');
    });

    it('ListTenantTransactionsQuery strictly isolates records to requesting tenant', async () => {
      const txA1 = Transaction.create('order-a-1', USER_A1, 10.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-a-1', TENANT_A);
      const txA2 = Transaction.create('order-a-2', USER_A2, 20.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-a-2', TENANT_A);
      const txB1 = Transaction.create('order-b-1', 'user-b-1', 99.00, 'RAZORPAY', 'INR', 'PAYMENT', 'tx-b-1', TENANT_B);

      await transactionRepo.save(txA1);
      await transactionRepo.save(txA2);
      await transactionRepo.save(txB1);

      const listA = await listTenantQuery.execute({ tenantId: TENANT_A });
      expect(listA.isSuccess).toBe(true);
      expect(listA.getValue().transactions).toHaveLength(2);
      expect(listA.getValue().transactions.every(t => t.tenantId === TENANT_A)).toBe(true);

      const listB = await listTenantQuery.execute({ tenantId: TENANT_B });
      expect(listB.isSuccess).toBe(true);
      expect(listB.getValue().transactions).toHaveLength(1);
      expect(listB.getValue().transactions[0]!.id).toBe('tx-b-1');
    });
  });

  describe('3. Cryptographic Webhook Signature Verification', () => {
    it('accepts Stripe webhook with authentic HMAC-SHA256 signature', async () => {
      const tx = Transaction.create('ref-stripe-01', USER_A1, 75.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-stripe-01', TENANT_A);
      await transactionRepo.save(tx);

      const rawBody = JSON.stringify({
        id: 'evt_stripe_sig_valid_01',
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'tx-stripe-01',
            payment_intent: 'pi_stripe_sig_valid',
            amount_total: 7500,
            currency: 'usd'
          }
        }
      });

      const signature = createStripeSignature(rawBody, STRIPE_SECRET);

      const res = await handleWebhookUseCase.execute({
        provider: 'STRIPE',
        payload: {
          body: JSON.parse(rawBody),
          headers: { 'stripe-signature': signature }
        },
        rawBody,
        signature
      });

      expect(res.isSuccess).toBe(true);
      expect(res.getValue().handled).toBe(true);
      expect(res.getValue().status).toBe('SUCCESS');

      const updated = await transactionRepo.findById('tx-stripe-01');
      expect(updated!.status).toBe('SUCCESS');
    });

    it('rejects Stripe webhook with invalid or tampered signature (BadRequestError)', async () => {
      const rawBody = JSON.stringify({ id: 'evt_tampered_01', type: 'checkout.session.completed' });
      const invalidSignature = 't=1234567,v1=tampered_fake_signature_hash';

      const res = await handleWebhookUseCase.execute({
        provider: 'STRIPE',
        payload: {
          body: JSON.parse(rawBody),
          headers: { 'stripe-signature': invalidSignature }
        },
        rawBody,
        signature: invalidSignature
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(BadRequestError);
      expect(res.getError().message).toContain('Invalid signature for STRIPE webhook');
    });

    it('accepts Razorpay webhook with authentic HMAC-SHA256 signature', async () => {
      const tx = Transaction.create('ref-rzp-01', USER_A1, 2000.00, 'RAZORPAY', 'INR', 'PAYMENT', 'tx-rzp-01', TENANT_A);
      await transactionRepo.save(tx);

      const rawBody = JSON.stringify({
        event: 'payment.captured',
        id: 'evt_rzp_valid_01',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_123',
              notes: { transactionId: 'tx-rzp-01' },
              amount: 200000,
              currency: 'INR'
            }
          }
        }
      });

      const signature = createRazorpaySignature(rawBody, RAZORPAY_SECRET);

      const res = await handleWebhookUseCase.execute({
        provider: 'RAZORPAY',
        payload: {
          body: JSON.parse(rawBody),
          headers: { 'x-razorpay-signature': signature }
        },
        rawBody,
        signature
      });

      expect(res.isSuccess).toBe(true);
      expect(res.getValue().handled).toBe(true);
      expect(res.getValue().status).toBe('SUCCESS');

      const updated = await transactionRepo.findById('tx-rzp-01');
      expect(updated!.status).toBe('SUCCESS');
    });

    it('rejects Razorpay webhook with forged signature', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_forged_rzp' });
      const forgedSignature = 'forged_signature_hash_value_9999999999';

      const res = await handleWebhookUseCase.execute({
        provider: 'RAZORPAY',
        payload: {
          body: JSON.parse(rawBody),
          headers: { 'x-razorpay-signature': forgedSignature }
        },
        rawBody,
        signature: forgedSignature
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(BadRequestError);
      expect(res.getError().message).toContain('Invalid signature for RAZORPAY webhook');
    });
  });

  describe('4. Webhook Idempotency & Replay Attack Defense', () => {
    it('processes first webhook delivery and safely ignores identical replayed event ID without duplicate domain events', async () => {
      const tx = Transaction.create('order-idemp-01', USER_A1, 120.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-idemp-01', TENANT_A);
      await transactionRepo.save(tx);

      const publishedEvents: any[] = [];
      eventBus.subscribe('transactions.completed', async (evt) => {
        publishedEvents.push(evt);
      });

      const eventPayload = {
        id: 'evt_stripe_idempotent_unique_001',
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'tx-idemp-01',
            payment_intent: 'pi_idemp_first',
            amount_total: 12000,
            currency: 'usd'
          }
        }
      };

      // First webhook delivery
      const firstRes = await handleWebhookUseCase.execute({
        provider: 'STRIPE',
        payload: {
          body: eventPayload,
          headers: {}
        }
      });

      expect(firstRes.isSuccess).toBe(true);
      expect(firstRes.getValue().status).toBe('SUCCESS');
      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0].payload.referenceId).toBe('order-idemp-01');

      // Replayed identical webhook delivery (same provider, same event ID)
      const replayedRes = await handleWebhookUseCase.execute({
        provider: 'STRIPE',
        payload: {
          body: eventPayload,
          headers: {}
        }
      });

      expect(replayedRes.isSuccess).toBe(true);
      expect(replayedRes.getValue().status).toBe('ALREADY_PROCESSED');
      // Invariant: MUST NOT emit a second integration event
      expect(publishedEvents).toHaveLength(1);
    });
  });

  describe('5. Order Settlement Linkage via Domain Integration Event', () => {
    it('completing transaction triggers OrderModule to transition linked order to PAID', async () => {
      // 1. Initialize OrderModule with the shared event bus
      const { publicApi: orderApi, repository: orderRepo } = OrderModule.init(undefined, undefined, eventBus);

      // 2. Place an order in RESERVED status
      const order = Order.create(
        USER_A1,
        [{ productId: 'SUPPLY-LOCK-01', productName: 'Smart Lock', quantity: 2, unitPrice: 150.00 }],
        'USD',
        'order-link-test-99',
        TENANT_A
      );
      order.markReserved();
      await orderRepo.save(order);

      const beforeOrder = await orderApi.getOrder('order-link-test-99', TENANT_A);
      expect(beforeOrder!.status).toBe('RESERVED');

      // 3. Create and complete payment transaction referencing this order
      const tx = Transaction.create('order-link-test-99', USER_A1, 300.00, 'STRIPE', 'USD', 'PAYMENT', 'tx-link-test-99', TENANT_A);
      await transactionRepo.save(tx);

      // Webhook arrives confirming payment
      await handleWebhookUseCase.execute({
        provider: 'MOCK',
        payload: {
          body: {
            id: 'evt_order_completion_hook_01',
            status: 'SUCCESS',
            transactionId: 'tx-link-test-99',
            providerTransactionId: 'mock_tx_order_paid',
            referenceId: 'order-link-test-99',
            amount: 300.00
          },
          headers: {}
        }
      });

      // 4. Verify transaction is SUCCESS and order is automatically transitioned to PAID
      const updatedTx = await transactionRepo.findById('tx-link-test-99', TENANT_A);
      expect(updatedTx!.status).toBe('SUCCESS');

      const afterOrder = await orderApi.getOrder('order-link-test-99', TENANT_A);
      expect(afterOrder!.status).toBe('PAID');
    });
  });

  describe('6. Dynamic Multi-Gateway Routing & Tenant Overrides', () => {
    it('initiates payment using global default gateway (STRIPE) for Tenant A', async () => {
      const res = await initiateUseCase.execute({
        referenceId: 'order-gate-01',
        userId: USER_A1,
        tenantId: TENANT_A,
        amount: 85.00,
        currency: 'USD'
      });

      expect(res.isSuccess).toBe(true);
      const val = res.getValue();
      expect(val.provider).toBe('STRIPE');
      expect(val.status).toBe('PENDING');
      expect(val.redirectUrl).toContain('provider=STRIPE');
    });

    it('initiates payment using tenant-specific override gateway (RAZORPAY) for Tenant B', async () => {
      const res = await initiateUseCase.execute({
        referenceId: 'order-gate-02',
        userId: 'user-beta-01',
        tenantId: TENANT_B,
        amount: 5000.00,
        currency: 'INR'
      });

      expect(res.isSuccess).toBe(true);
      const val = res.getValue();
      expect(val.provider).toBe('RAZORPAY');
      expect(val.status).toBe('PENDING');
      expect(val.redirectUrl).toContain('provider=RAZORPAY');
    });
  });

  describe('7. Presentation Boundary & Controller Integration', () => {
    it('executes initiate, getTransaction, listMyTransactions, and refund via TransactionController', async () => {
      // 1. Controller initiate
      const reqInitiate = {
        body: { referenceId: 'order-ctrl-01', amount: 99.50, currency: 'USD' },
        user: { id: USER_A1, email: 'alpha@example.com' },
        tenantId: TENANT_A,
        headers: { 'x-tenant-id': TENANT_A }
      } as unknown as Request;

      let initStatus = 0;
      let initBody: any = null;
      const resInitiate = {
        status: (s: number) => { initStatus = s; return resInitiate; },
        json: (b: any) => { initBody = b; return resInitiate; }
      } as unknown as Response;

      await controller.initiate(reqInitiate, resInitiate, (err) => { throw err; });
      expect(initStatus).toBe(201);
      expect(initBody.success).toBe(true);
      const createdTxId = initBody.data.transactionId;
      expect(createdTxId).toBeDefined();

      // 2. Simulate payment completion
      const tx = await transactionRepo.findById(createdTxId);
      tx!.complete('pi_ctrl_success');
      await transactionRepo.save(tx!);

      // 3. Controller getTransaction
      const reqGet = {
        params: { id: createdTxId },
        user: { id: USER_A1, role: 'TENANT' },
        tenantId: TENANT_A,
        headers: { 'x-tenant-id': TENANT_A }
      } as unknown as Request;

      let getStatus = 0;
      let getBody: any = null;
      const resGet = {
        status: (s: number) => { getStatus = s; return resGet; },
        json: (b: any) => { getBody = b; return resGet; }
      } as unknown as Response;

      await controller.getTransaction(reqGet, resGet, (err) => { throw err; });
      expect(getStatus).toBe(200);
      expect(getBody.data.status).toBe('SUCCESS');

      // 4. Controller refund
      const reqRefund = {
        params: { id: createdTxId },
        body: { reason: 'Job cancelled by owner', amount: 99.50 },
        user: { id: USER_A1 },
        tenantId: TENANT_A,
        headers: { 'x-tenant-id': TENANT_A }
      } as unknown as Request;

      let refStatus = 0;
      let refBody: any = null;
      const resRefund = {
        status: (s: number) => { refStatus = s; return resRefund; },
        json: (b: any) => { refBody = b; return resRefund; }
      } as unknown as Response;

      await controller.refund(reqRefund, resRefund, (err) => { throw err; });
      expect(refStatus).toBe(200);
      expect(refBody.data.status).toBe('REFUNDED');
      expect(refBody.data.refundedAmount).toBe(99.50);
    });

    it('rejects invalid inputs with Zod validation 400 Bad Request', async () => {
      const reqInvalid = {
        body: { referenceId: '', amount: -50.00 }, // invalid referenceId and negative amount
        user: { id: USER_A1 },
        headers: { 'x-tenant-id': TENANT_A }
      } as unknown as Request;

      let errorCaught: any = null;
      const res = { status: () => res, json: () => res } as unknown as Response;

      await controller.initiate(reqInvalid, res, (err) => { errorCaught = err; });
      expect(errorCaught).toBeDefined();
      expect(errorCaught.name).toBe('ZodError');
    });
  });

  describe('8. TransactionModule Public API Integration', () => {
    it('operates seamlessly via TransactionModule.init publicApi', async () => {
      const { publicApi } = TransactionModule.init(transactionRepo, webhookRepo, gatewayRouter, eventBus);

      const initiated = await publicApi.initiatePayment({
        referenceId: 'order-pub-api-01',
        userId: USER_A1,
        tenantId: TENANT_A,
        amount: 350.00,
        currency: 'USD'
      });

      expect(initiated.transactionId).toBeDefined();
      expect(initiated.status).toBe('PENDING');

      const retrieved = await publicApi.getTransactionById(initiated.transactionId, TENANT_A);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.amount).toBe(350.00);

      // Complete transaction directly
      const tx = await transactionRepo.findById(initiated.transactionId);
      tx!.complete('pi_pub_api_ok');
      await transactionRepo.save(tx!);

      const refunded = await publicApi.refundTransaction(initiated.transactionId, TENANT_A, 'Public API refund test');
      expect(refunded).toBe(true);

      const afterRefund = await publicApi.getTransactionById(initiated.transactionId, TENANT_A);
      expect(afterRefund!.status).toBe('REFUNDED');
    });
  });
});
