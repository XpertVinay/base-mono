export interface PaymentInitiationInput {
  transactionId: string;
  referenceId: string;
  amount: number;
  currency: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentInitiationResult {
  sessionId: string;
  redirectUrl: string;
  provider: string;
}

export interface IPaymentGatewayAdapter {
  readonly providerName: string;
  initiate(input: PaymentInitiationInput): Promise<PaymentInitiationResult>;
  verifyWebhook(payload: any, signature?: string): Promise<{ success: boolean; transactionId?: string; providerTxnId?: string }>;
}
