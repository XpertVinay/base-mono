export interface PaymentInitiationInput {
  transactionId: string;
  referenceId: string;
  userId: string;
  tenantId?: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitiationResult {
  provider: 'STRIPE' | 'PAYPAL' | 'RAZORPAY' | 'MOCK';
  providerSessionId: string;
  redirectUrl: string;
  status: 'REQUIRES_ACTION' | 'PENDING' | 'SUCCESS';
}

export interface PaymentChargeInput {
  referenceId: string;
  userId: string;
  tenantId?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentChargeResult {
  provider: 'STRIPE' | 'PAYPAL' | 'RAZORPAY' | 'MOCK';
  providerTransactionId: string;
  status: 'SUCCESS' | 'FAILED';
  feeAmount?: number;
  failureReason?: string;
  rawDetails?: Record<string, unknown>;
}

export interface WebhookPayload {
  body: any;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  rawBody?: string;
}

export interface WebhookProcessingResult {
  handled: boolean;
  transactionId?: string;
  referenceId?: string;
  providerTransactionId?: string;
  eventId?: string;
  eventType?: string;
  status: 'SUCCESS' | 'FAILED' | 'IGNORED' | 'ALREADY_PROCESSED';
  failureReason?: string;
  amount?: number;
  currency?: string;
  rawEvent?: Record<string, unknown>;
}

export interface IPaymentGatewayAdapter {
  readonly providerName: 'STRIPE' | 'PAYPAL' | 'RAZORPAY' | 'MOCK';
  initiate(input: PaymentInitiationInput): Promise<PaymentInitiationResult>;
  charge(input: PaymentChargeInput): Promise<PaymentChargeResult>;
  processWebhook(payload: WebhookPayload): Promise<WebhookProcessingResult>;
  verifyWebhookSignature?(rawBody: string, signature: string, secret?: string): boolean;
  verifyPayment(providerTransactionId: string): Promise<PaymentChargeResult>;
  refund(providerTransactionId: string, amount: number): Promise<PaymentChargeResult>;
}
