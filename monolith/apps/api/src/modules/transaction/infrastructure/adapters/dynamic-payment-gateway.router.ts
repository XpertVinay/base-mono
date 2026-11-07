import {
  IPaymentGatewayAdapter,
  PaymentInitiationInput,
  PaymentInitiationResult,
  PaymentChargeInput,
  PaymentChargeResult,
  WebhookPayload,
  WebhookProcessingResult
} from '../../application/ports/payment-gateway.port.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export type ConfigResolver = (key: string, defaultValue?: string, tenantId?: string) => Promise<string>;

export class DynamicPaymentGatewayRouter implements IPaymentGatewayAdapter {
  readonly providerName = 'MOCK' as const;
  private adapters = new Map<string, IPaymentGatewayAdapter>();

  constructor(
    private readonly configResolver: ConfigResolver,
    defaultAdapters: IPaymentGatewayAdapter[] = []
  ) {
    defaultAdapters.forEach(adapter => {
      this.adapters.set(adapter.providerName.toUpperCase(), adapter);
    });
  }

  public registerAdapter(adapter: IPaymentGatewayAdapter): void {
    this.adapters.set(adapter.providerName.toUpperCase(), adapter);
  }

  public getAvailableGateways(): string[] {
    return Array.from(this.adapters.keys());
  }

  public getAdapter(providerName: string): IPaymentGatewayAdapter | undefined {
    return this.adapters.get(providerName.toUpperCase().trim());
  }

  public async getActiveAdapter(tenantId?: string): Promise<IPaymentGatewayAdapter> {
    const configuredGateway = (
      await this.configResolver('ACTIVE_PAYMENT_GATEWAY', 'STRIPE', tenantId)
    ).toUpperCase().trim();

    const adapter = this.adapters.get(configuredGateway);

    if (!adapter) {
      logger.warn(`Configured gateway '${configuredGateway}' not found. Falling back to MOCK`, {
        configuredGateway,
        tenantId,
        availableGateways: this.getAvailableGateways()
      });
      return this.adapters.get('MOCK') || Array.from(this.adapters.values())[0]!;
    }

    return adapter;
  }

  public verifyProviderWebhookSignature(
    providerName: string,
    rawBody: string,
    signature: string,
    secret?: string
  ): boolean {
    const adapter = this.getAdapter(providerName);
    if (!adapter) {
      logger.warn(`Signature verification requested for unknown provider: ${providerName}`);
      return false;
    }
    if (typeof adapter.verifyWebhookSignature === 'function') {
      return adapter.verifyWebhookSignature(rawBody, signature, secret);
    }
    return true;
  }

  async initiate(input: PaymentInitiationInput): Promise<PaymentInitiationResult> {
    const adapter = await this.getActiveAdapter(input.tenantId);
    logger.info(`Initiating hosted payment checkout through active gateway: ${adapter.providerName}`, {
      transactionId: input.transactionId,
      referenceId: input.referenceId,
      tenantId: input.tenantId,
      amount: input.amount,
      currency: input.currency
    });
    return adapter.initiate(input);
  }

  async charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    const adapter = await this.getActiveAdapter(input.tenantId);
    logger.info(`Routing direct payment charge through active gateway: ${adapter.providerName}`, {
      referenceId: input.referenceId,
      tenantId: input.tenantId,
      amount: input.amount,
      currency: input.currency
    });
    return adapter.charge(input);
  }

  async processWebhook(payload: WebhookPayload): Promise<WebhookProcessingResult> {
    const adapter = await this.getActiveAdapter();
    return adapter.processWebhook(payload);
  }

  async processProviderWebhook(providerName: string, payload: WebhookPayload): Promise<WebhookProcessingResult> {
    const adapter = this.getAdapter(providerName);
    if (!adapter) {
      logger.warn(`Webhook received for unregistered provider: ${providerName}`);
      return { handled: false, status: 'IGNORED' };
    }
    return adapter.processWebhook(payload);
  }

  async verifyPayment(providerTransactionId: string): Promise<PaymentChargeResult> {
    const adapter = await this.getActiveAdapter();
    return adapter.verifyPayment(providerTransactionId);
  }

  async refund(providerTransactionId: string, amount: number, providerName?: string): Promise<PaymentChargeResult> {
    const adapter = providerName ? (this.getAdapter(providerName) || await this.getActiveAdapter()) : await this.getActiveAdapter();
    return adapter.refund(providerTransactionId, amount);
  }
}
