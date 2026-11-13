import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { Transaction } from '../src/domain/entities/transaction.entity.js';
import { ITransactionRepository } from '../src/domain/repositories/transaction-repository.interface.js';
import { GetTransactionByIdQuery, CompletePaymentUseCase } from '../src/application/use-cases/transaction.use-cases.js';
import { TransactionController } from '../src/presentation/http/transaction.controller.js';

class MockTransactionRepository implements ITransactionRepository {
  public transactions = new Map<string, Transaction>();

  async findById(id: string, tenantId?: string): Promise<Transaction | null> {
    const txn = this.transactions.get(id) || null;
    if (!txn) return null;
    if (tenantId && txn.tenantId !== tenantId && txn.tenantId !== 'default') {
      return null;
    }
    return txn;
  }

  async findByReferenceId(refId: string, tenantId?: string): Promise<Transaction | null> {
    for (const t of this.transactions.values()) {
      if (t.referenceId === refId && (!tenantId || t.tenantId === tenantId)) return t;
    }
    return null;
  }

  async save(transaction: Transaction): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  async update(transaction: Transaction): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }
}

test('Transaction Security: IDOR prevention and strict tenant scoping on GetTransactionByIdQuery', async () => {
  const repo = new MockTransactionRepository();
  const sampleTxn = Transaction.create(
    {
      tenantId: 'tenant-alpha',
      referenceId: 'order-101',
      userId: 'user-alice',
      type: 'PAYMENT',
      amount: 15000,
      currency: 'USD',
      paymentMethod: 'STRIPE'
    },
    'txn-999'
  );
  await repo.save(sampleTxn);

  const query = new GetTransactionByIdQuery(repo);

  // 1. Legitimate owner Alice in tenant-alpha should succeed
  const aliceResult = await query.execute({
    id: 'txn-999',
    userId: 'user-alice',
    role: 'USER',
    tenantId: 'tenant-alpha'
  });
  assert.strictEqual(aliceResult.isSuccess, true);
  assert.strictEqual(aliceResult.getValue().id, 'txn-999');

  // 2. Attacker Bob in tenant-alpha attempts IDOR access -> MUST BE FORBIDDEN
  const bobResult = await query.execute({
    id: 'txn-999',
    userId: 'user-bob',
    role: 'USER',
    tenantId: 'tenant-alpha'
  });
  assert.strictEqual(bobResult.isFailure, true);
  assert.strictEqual(bobResult.getError(), 'Forbidden: You do not own this transaction');

  // 3. User attempting access across tenant boundary (tenant-beta) -> MUST BE BLOCKED
  const crossTenantResult = await query.execute({
    id: 'txn-999',
    userId: 'user-alice',
    role: 'USER',
    tenantId: 'tenant-beta'
  });
  assert.strictEqual(crossTenantResult.isFailure, true);
  // Either not found in tenant or tenant mismatch
  assert.ok(
    crossTenantResult.getError() === 'Transaction not found' ||
    crossTenantResult.getError() === 'Forbidden: Tenant mismatch'
  );

  // 4. Platform Admin in tenant-alpha can inspect
  const adminResult = await query.execute({
    id: 'txn-999',
    userId: 'admin-super',
    role: 'ADMIN',
    tenantId: 'tenant-alpha'
  });
  assert.strictEqual(adminResult.isSuccess, true);
});

test('Transaction Security: Webhook signature verification and spoofing protection', async () => {
  const repo = new MockTransactionRepository();
  const completeUseCase = new CompletePaymentUseCase(repo);
  const controller = new TransactionController({} as any, completeUseCase, {} as any);

  const secret = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars';
  const payload = { transactionId: 'txn-1', status: 'SUCCESS' };
  const payloadStr = JSON.stringify(payload);
  const validSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

  // 1. Missing signature header -> 401 Unauthorized
  let capturedStatusCode = 0;
  let capturedResponse: any = null;
  const mockRes = {
    status(code: number) {
      capturedStatusCode = code;
      return this;
    },
    json(data: any) {
      capturedResponse = data;
      return this;
    }
  } as any;

  const reqWithoutSig = {
    header: (name: string) => undefined,
    body: payload,
    headers: {}
  } as any;

  await controller.handleWebhook(reqWithoutSig, mockRes, () => {});
  assert.strictEqual(capturedStatusCode, 401);
  assert.strictEqual(capturedResponse.errors[0].code, 'UNAUTHORIZED_WEBHOOK');

  // 2. Forged/invalid signature header -> 401 Unauthorized
  const reqWithForgedSig = {
    header: (name: string) => name === 'x-webhook-signature' ? 'invalid-hex-signature-12345' : undefined,
    body: payload,
    headers: { 'x-webhook-signature': 'invalid-hex-signature-12345' }
  } as any;

  await controller.handleWebhook(reqWithForgedSig, mockRes, () => {});
  assert.strictEqual(capturedStatusCode, 401);
  assert.strictEqual(capturedResponse.errors[0].code, 'UNAUTHORIZED_WEBHOOK');

  // 3. Valid signature -> Passes authorization and executes complete payment use case
  const txn2 = Transaction.create({
    tenantId: 'default',
    referenceId: 'order-200',
    userId: 'user-charlie',
    type: 'PAYMENT',
    amount: 5000,
    currency: 'USD',
    paymentMethod: 'STRIPE'
  }, 'txn-valid');
  await repo.save(txn2);

  const validPayload = { transactionId: 'txn-valid', status: 'SUCCESS', providerTxnId: 'ch_stripe_123' };
  const validPayloadStr = JSON.stringify(validPayload);
  const correctSig = crypto.createHmac('sha256', secret).update(validPayloadStr).digest('hex');

  const reqWithValidSig = {
    header: (name: string) => name === 'x-webhook-signature' ? correctSig : undefined,
    body: validPayload,
    headers: { 'x-webhook-signature': correctSig }
  } as any;

  await controller.handleWebhook(reqWithValidSig, mockRes, () => {});
  assert.strictEqual(capturedStatusCode, 200);
  assert.strictEqual(capturedResponse.status, true);
  assert.strictEqual(capturedResponse.data.status, 'SUCCESS');
});
