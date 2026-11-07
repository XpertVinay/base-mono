import {
  IPaymentGatewayAdapter,
  PaymentInitiationInput,
  PaymentInitiationResult,
  PaymentChargeInput,
  PaymentChargeResult,
  WebhookPayload,
  WebhookProcessingResult
} from '../../application/ports/payment-gateway.port.js';
import { v4 as uuidv4 } from 'uuid';

export class MockPaymentGatewayAdapter implements IPaymentGatewayAdapter {
  readonly providerName = 'MOCK' as const;

  async initiate(input: PaymentInitiationInput): Promise<PaymentInitiationResult> {
    const sessionId = `mock_sess_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const redirectUrl = `/api/transactions/gateway-simulator?sessionId=${sessionId}&provider=MOCK&amount=${input.amount}&currency=${input.currency}&referenceId=${encodeURIComponent(input.referenceId)}&transactionId=${encodeURIComponent(input.transactionId)}&returnUrl=${encodeURIComponent(input.returnUrl)}&cancelUrl=${encodeURIComponent(input.cancelUrl)}`;

    return {
      provider: 'MOCK',
      providerSessionId: sessionId,
      redirectUrl,
      status: 'REQUIRES_ACTION'
    };
  }

  async charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    return {
      provider: 'MOCK',
      providerTransactionId: `mock_tx_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
      status: 'SUCCESS',
      feeAmount: 0.00,
      rawDetails: { method: input.paymentMethod, simulated: true }
    };
  }

  verifyWebhookSignature(_rawBody: string, signature: string, _secret?: string): boolean {
    if (signature === 'invalid_signature') return false;
    return true;
  }

  async processWebhook(payload: WebhookPayload): Promise<WebhookProcessingResult> {
    const event = payload.body || {};
    const eventId = event.id || (payload.headers['x-mock-event-id'] as string) || `mock_evt_${uuidv4().substring(0, 8)}`;
    const eventType = event.event || event.type || 'payment.succeeded';

    return {
      handled: true,
      status: event.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
      transactionId: event.transactionId,
      referenceId: event.referenceId,
      providerTransactionId: event.providerTransactionId || `mock_tx_${uuidv4().substring(0, 8)}`,
      eventId,
      eventType,
      amount: event.amount,
      currency: event.currency || 'USD',
      rawEvent: event
    };
  }

  async verifyPayment(providerTransactionId: string): Promise<PaymentChargeResult> {
    return {
      provider: 'MOCK',
      providerTransactionId,
      status: 'SUCCESS'
    };
  }

  async refund(providerTransactionId: string, amount: number): Promise<PaymentChargeResult> {
    return {
      provider: 'MOCK',
      providerTransactionId: `mock_ref_${uuidv4().substring(0, 12)}`,
      status: 'SUCCESS',
      feeAmount: 0.00,
      rawDetails: { originalTransaction: providerTransactionId, amount }
    };
  }
}
