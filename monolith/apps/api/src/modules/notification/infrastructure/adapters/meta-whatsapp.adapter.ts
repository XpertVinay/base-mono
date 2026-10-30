import {
  INotificationAdapter,
  SendNotificationInput,
  SendNotificationOutput
} from '../../application/ports/notification-adapter.port.js';
import { NotificationChannel, NotificationProvider } from '@monolith/contracts';
import { dryRunOutbox } from './dry-run-outbox.service.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { env } from '../../../../config/env.js';

export interface MetaWhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  businessAccountId?: string;
  apiVersion?: string;
}

export class MetaWhatsAppAdapter implements INotificationAdapter {
  readonly providerName: NotificationProvider = 'META_CLOUD';
  readonly supportedChannels: NotificationChannel[] = ['WHATSAPP'];

  private phoneNumberId?: string;
  private accessToken?: string;
  private apiVersion: string;

  constructor(config?: MetaWhatsAppConfig) {
    this.phoneNumberId = config?.phoneNumberId || env.META_WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = config?.accessToken || env.META_WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN;
    this.apiVersion = config?.apiVersion || env.META_WHATSAPP_API_VERSION || process.env.META_WHATSAPP_API_VERSION || 'v21.0';
  }

  isConfigured(): boolean {
    return Boolean(
      this.phoneNumberId &&
      this.accessToken &&
      this.accessToken.length > 20 &&
      !this.accessToken.includes('your_meta_access_token_here')
    );
  }

  async send(input: SendNotificationInput): Promise<SendNotificationOutput> {
    const isDryRun = input.dryRun !== undefined ? input.dryRun : !this.isConfigured();
    const simulatedMsgId = `wamid.HBgL${uuidv4().replace(/-/g, '').substring(0, 24)}==`;
    const now = new Date();

    // Prepare WhatsApp Cloud API message payload
    let whatsappPayload: Record<string, any>;

    if (input.templateId) {
      whatsappPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: input.recipient.replace(/[^0-9]/g, ''),
        type: 'template',
        template: {
          name: input.templateId,
          language: {
            code: (input.templateData?.language as string) || 'en_US'
          },
          components: input.templateData?.components || []
        }
      };
    } else {
      whatsappPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: input.recipient.replace(/[^0-9]/g, ''),
        type: 'text',
        text: {
          preview_url: false,
          body: input.body
        }
      };
    }

    if (isDryRun) {
      dryRunOutbox.record({
        id: uuidv4(),
        notificationId: input.id,
        recipient: input.recipient,
        channel: 'WHATSAPP',
        provider: 'META_CLOUD',
        subject: input.subject,
        body: input.body,
        isDryRun: true,
        simulatedAt: now,
        headers: {
          'Authorization': 'Bearer EAAG***[DRY_RUN_REDACTED]***',
          'Content-Type': 'application/json'
        },
        payload: whatsappPayload
      });

      logger.info(`[Meta WhatsApp DRY-RUN] WhatsApp message simulated for ${input.recipient}`, {
        notificationId: input.id,
        providerMessageId: simulatedMsgId,
        phoneNumberId: this.phoneNumberId || 'SIMULATED_PHONE_ID'
      });

      return {
        provider: 'META_CLOUD',
        providerMessageId: simulatedMsgId,
        status: 'SENT',
        isDryRun: true,
        simulatedAt: now,
        rawResponse: {
          messaging_product: 'whatsapp',
          contacts: [{ input: input.recipient, wa_id: input.recipient.replace(/[^0-9]/g, '') }],
          messages: [{ id: simulatedMsgId }],
          simulated: true,
          endpoint: `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId || 'SIMULATED'}/messages`
        }
      };
    }

    // Live Execution against Meta WhatsApp Cloud API
    const effectivePhoneId = this.phoneNumberId || process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const effectiveToken = this.accessToken || process.env.META_WHATSAPP_ACCESS_TOKEN;

    if (!effectivePhoneId || !effectiveToken) {
      return {
        provider: 'META_CLOUD',
        providerMessageId: simulatedMsgId,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: 'META_WHATSAPP_PHONE_NUMBER_ID or META_WHATSAPP_ACCESS_TOKEN is not configured for live dispatch'
      };
    }

    try {
      logger.info(`[Meta WhatsApp LIVE] Sending message to ${input.recipient}`, {
        notificationId: input.id
      });

      const endpoint = `https://graph.facebook.com/${this.apiVersion}/${effectivePhoneId}/messages`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(whatsappPayload)
      });

      const data = await response.json() as any;

      if (response.ok && data.messages && data.messages.length > 0) {
        return {
          provider: 'META_CLOUD',
          providerMessageId: data.messages[0].id,
          status: 'SENT',
          isDryRun: false,
          rawResponse: data
        };
      }

      logger.error('Meta WhatsApp Cloud API error', { status: response.status, data });
      return {
        provider: 'META_CLOUD',
        providerMessageId: simulatedMsgId,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: data.error?.message || `Meta WhatsApp status ${response.status}`
      };
    } catch (err: any) {
      logger.error('Meta WhatsApp network or dispatch error', { error: err.message });
      return {
        provider: 'META_CLOUD',
        providerMessageId: simulatedMsgId,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: `Meta WhatsApp dispatch error: ${err.message}`
      };
    }
  }

  async verifyConfig(): Promise<{ valid: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return {
        valid: false,
        message: 'Meta WhatsApp Phone Number ID or Access Token is missing. Running in DRY-RUN mode.'
      };
    }
    return { valid: true, message: 'Meta WhatsApp configured with valid credentials.' };
  }
}
