import { IPaymentGatewayAdapter, PaymentInitiationInput, PaymentInitiationResult } from '../../application/ports/payment-gateway.port.js';

export class MockPaymentGatewayAdapter implements IPaymentGatewayAdapter {
  readonly providerName = 'MOCK';

  async initiate(input: PaymentInitiationInput): Promise<PaymentInitiationResult> {
    const sessionId = `mock_sess_${crypto.randomUUID()}`;
    return {
      sessionId,
      redirectUrl: `https://mock-gateway.local/checkout?session=${sessionId}&ref=${input.referenceId}`,
      provider: this.providerName
    };
  }

  async verifyWebhook(payload: any): Promise<{ success: boolean; transactionId?: string; providerTxnId?: string }> {
    return {
      success: true,
      transactionId: payload.transactionId,
      providerTxnId: `mock_txn_${crypto.randomUUID()}`
    };
  }
}

export class StripePaymentGatewayAdapter implements IPaymentGatewayAdapter {
  readonly providerName = 'STRIPE';

  async initiate(_input: PaymentInitiationInput): Promise<PaymentInitiationResult> {
    const sessionId = `cs_test_${crypto.randomUUID()}`;
    return {
      sessionId,
      redirectUrl: `https://checkout.stripe.com/pay/${sessionId}`,
      provider: this.providerName
    };
  }

  async verifyWebhook(payload: any): Promise<{ success: boolean; transactionId?: string; providerTxnId?: string }> {
    return {
      success: true,
      transactionId: payload.data?.object?.client_reference_id || payload.transactionId,
      providerTxnId: payload.data?.object?.payment_intent || `pi_${crypto.randomUUID()}`
    };
  }
}

export class PayPalPaymentGatewayAdapter implements IPaymentGatewayAdapter {
  readonly providerName = 'PAYPAL';

  async initiate(_input: PaymentInitiationInput): Promise<PaymentInitiationResult> {
    const orderId = `EC-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    return {
      sessionId: orderId,
      redirectUrl: `https://www.paypal.com/checkoutnow?token=${orderId}`,
      provider: this.providerName
    };
  }

  async verifyWebhook(payload: any): Promise<{ success: boolean; transactionId?: string; providerTxnId?: string }> {
    return {
      success: true,
      transactionId: payload.resource?.custom_id || payload.transactionId,
      providerTxnId: payload.resource?.id || `pp_${crypto.randomUUID()}`
    };
  }
}

export class RazorpayPaymentGatewayAdapter implements IPaymentGatewayAdapter {
  readonly providerName = 'RAZORPAY';

  async initiate(_input: PaymentInitiationInput): Promise<PaymentInitiationResult> {
    const orderId = `order_${crypto.randomUUID().substring(0, 14)}`;
    return {
      sessionId: orderId,
      redirectUrl: `https://api.razorpay.com/v1/checkout/${orderId}`,
      provider: this.providerName
    };
  }

  async verifyWebhook(payload: any): Promise<{ success: boolean; transactionId?: string; providerTxnId?: string }> {
    return {
      success: true,
      transactionId: payload.payload?.payment?.entity?.notes?.transactionId || payload.transactionId,
      providerTxnId: payload.payload?.payment?.entity?.id || `pay_${crypto.randomUUID()}`
    };
  }
}
