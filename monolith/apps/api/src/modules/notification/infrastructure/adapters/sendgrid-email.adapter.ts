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

export interface SendGridConfig {
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
}

export class SendGridEmailAdapter implements INotificationAdapter {
  readonly providerName: NotificationProvider = 'SENDGRID';
  readonly supportedChannels: NotificationChannel[] = ['EMAIL'];

  private apiKey?: string;
  private fromEmail: string;
  private fromName: string;

  constructor(config?: SendGridConfig) {
    this.apiKey = config?.apiKey || env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY;
    this.fromEmail = config?.fromEmail || env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@monolith.local';
    this.fromName = config?.fromName || env.SENDGRID_FROM_NAME || process.env.SENDGRID_FROM_NAME || 'Monolith Platform';
  }

  isConfigured(): boolean {
    return Boolean(
      this.apiKey && 
      this.apiKey.startsWith('SG.') && 
      !this.apiKey.includes('your_sendgrid_api_key_here')
    );
  }

  async send(input: SendNotificationInput): Promise<SendNotificationOutput> {
    const isDryRun = input.dryRun !== undefined ? input.dryRun : !this.isConfigured();
    const simulatedMsgId = `sg_msg_${uuidv4().replace(/-/g, '').substring(0, 22)}`;
    const now = new Date();

    const sendgridPayload: Record<string, any> = {
      personalizations: [
        {
          to: [{ email: input.recipient }]
        }
      ],
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject: input.subject,
      content: [
        {
          type: input.body.includes('<') && input.body.includes('>') ? 'text/html' : 'text/plain',
          value: input.body
        }
      ]
    };

    if (input.templateId) {
      sendgridPayload.template_id = input.templateId;
      if (input.templateData) {
        sendgridPayload.personalizations[0].dynamic_template_data = input.templateData;
      }
    }

    if (input.metadata) {
      sendgridPayload.custom_args = input.metadata;
    }

    // Always record dry-run or mock execution into Developer Outbox
    if (isDryRun) {
      dryRunOutbox.record({
        id: uuidv4(),
        notificationId: input.id,
        recipient: input.recipient,
        channel: 'EMAIL',
        provider: 'SENDGRID',
        subject: input.subject,
        body: input.body,
        isDryRun: true,
        simulatedAt: now,
        headers: {
          'Authorization': 'Bearer SG.***[DRY_RUN_REDACTED]***',
          'Content-Type': 'application/json'
        },
        payload: sendgridPayload
      });

      logger.info(`[SendGrid DRY-RUN] Email simulated for ${input.recipient}`, {
        notificationId: input.id,
        providerMessageId: simulatedMsgId,
        from: this.fromEmail,
        subject: input.subject
      });

      return {
        provider: 'SENDGRID',
        providerMessageId: simulatedMsgId,
        status: 'SENT',
        isDryRun: true,
        simulatedAt: now,
        rawResponse: {
          statusCode: 202,
          simulated: true,
          provider: 'SENDGRID',
          endpoint: 'https://api.sendgrid.com/v3/mail/send'
        }
      };
    }

    // Live Execution against SendGrid v3 API
    const effectiveApiKey = this.apiKey || process.env.SENDGRID_API_KEY;
    if (!effectiveApiKey) {
      return {
        provider: 'SENDGRID',
        providerMessageId: simulatedMsgId,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: 'SENDGRID_API_KEY is not configured in environment variables for live dispatch'
      };
    }

    try {
      logger.info(`[SendGrid LIVE] Dispatching email to ${input.recipient} via SendGrid v3 API`, {
        notificationId: input.id,
        subject: input.subject
      });

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendgridPayload)
      });

      const messageIdHeader = response.headers.get('x-message-id') || simulatedMsgId;

      if (response.status === 202 || response.status === 200) {
        return {
          provider: 'SENDGRID',
          providerMessageId: messageIdHeader,
          status: 'SENT',
          isDryRun: false,
          rawResponse: {
            statusCode: response.status,
            xMessageId: messageIdHeader
          }
        };
      }

      const errorText = await response.text();
      logger.error(`SendGrid API rejected message`, { status: response.status, response: errorText });
      return {
        provider: 'SENDGRID',
        providerMessageId: messageIdHeader,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: `SendGrid API error (${response.status}): ${errorText}`
      };
    } catch (err: any) {
      logger.error(`SendGrid network or dispatch error`, { error: err.message });
      return {
        provider: 'SENDGRID',
        providerMessageId: simulatedMsgId,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: `SendGrid dispatch error: ${err.message}`
      };
    }
  }

  async verifyConfig(): Promise<{ valid: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return {
        valid: false,
        message: 'SendGrid API Key is missing or using default placeholder. Running in DRY-RUN mode.'
      };
    }
    return { valid: true, message: 'SendGrid configured with valid API Key format.' };
  }
}
