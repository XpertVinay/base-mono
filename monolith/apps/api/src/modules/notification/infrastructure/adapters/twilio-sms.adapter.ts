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

export interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  messagingServiceSid?: string;
}

export class TwilioSmsAdapter implements INotificationAdapter {
  readonly providerName: NotificationProvider = 'TWILIO';
  readonly supportedChannels: NotificationChannel[] = ['SMS'];

  private accountSid?: string;
  private authToken?: string;
  private fromNumber?: string;
  private messagingServiceSid?: string;

  constructor(config?: TwilioConfig) {
    this.accountSid = config?.accountSid || env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
    this.authToken = config?.authToken || env.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = config?.fromNumber || env.TWILIO_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER || '+15005550006';
    this.messagingServiceSid = config?.messagingServiceSid || env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_MESSAGING_SERVICE_SID;
  }

  isConfigured(): boolean {
    return Boolean(
      this.accountSid &&
      this.authToken &&
      this.accountSid.startsWith('AC') &&
      !this.accountSid.includes('your_twilio_account_sid_here')
    );
  }

  async send(input: SendNotificationInput): Promise<SendNotificationOutput> {
    const isDryRun = input.dryRun !== undefined ? input.dryRun : !this.isConfigured();
    const simulatedSid = `SM${uuidv4().replace(/-/g, '').substring(0, 32)}`;
    const now = new Date();

    const twilioParams: Record<string, string> = {
      To: input.recipient,
      Body: input.body
    };

    if (this.messagingServiceSid) {
      twilioParams.MessagingServiceSid = this.messagingServiceSid;
    } else if (this.fromNumber) {
      twilioParams.From = this.fromNumber;
    }

    if (isDryRun) {
      dryRunOutbox.record({
        id: uuidv4(),
        notificationId: input.id,
        tenantId: input.tenantId,
        recipient: input.recipient,
        channel: 'SMS',
        provider: 'TWILIO',
        subject: input.subject,
        body: input.body,
        isDryRun: true,
        simulatedAt: now,
        headers: {
          'Authorization': 'Basic AC***[DRY_RUN_REDACTED]***',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: twilioParams
      });

      logger.info(`[Twilio DRY-RUN] SMS simulated for ${input.recipient}`, {
        notificationId: input.id,
        providerMessageId: simulatedSid,
        from: this.fromNumber || this.messagingServiceSid,
        bodyLength: input.body.length
      });

      return {
        provider: 'TWILIO',
        providerMessageId: simulatedSid,
        status: 'SENT',
        isDryRun: true,
        simulatedAt: now,
        rawResponse: {
          sid: simulatedSid,
          status: 'queued',
          simulated: true,
          provider: 'TWILIO',
          endpoint: `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid || 'AC_SIMULATED'}/Messages.json`
        }
      };
    }

    // Live Execution against Twilio REST API
    const effectiveSid = this.accountSid || process.env.TWILIO_ACCOUNT_SID;
    const effectiveAuth = this.authToken || process.env.TWILIO_AUTH_TOKEN;

    if (!effectiveSid || !effectiveAuth) {
      return {
        provider: 'TWILIO',
        providerMessageId: simulatedSid,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not configured for live dispatch'
      };
    }

    try {
      logger.info(`[Twilio LIVE] Dispatching SMS to ${input.recipient}`, {
        notificationId: input.id
      });

      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${effectiveSid}/Messages.json`;
      const authHeader = `Basic ${Buffer.from(`${effectiveSid}:${effectiveAuth}`).toString('base64')}`;

      const formData = new URLSearchParams(twilioParams);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const data = await response.json() as any;

      if (response.ok && data.sid) {
        return {
          provider: 'TWILIO',
          providerMessageId: data.sid,
          status: 'SENT',
          isDryRun: false,
          rawResponse: data
        };
      }

      logger.error('Twilio SMS API error', { status: response.status, data });
      return {
        provider: 'TWILIO',
        providerMessageId: simulatedSid,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: data.message || `Twilio error status ${response.status}`
      };
    } catch (err: any) {
      logger.error('Twilio network or dispatch error', { error: err.message });
      return {
        provider: 'TWILIO',
        providerMessageId: simulatedSid,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: `Twilio dispatch error: ${err.message}`
      };
    }
  }

  async verifyConfig(): Promise<{ valid: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return {
        valid: false,
        message: 'Twilio Account SID or Auth Token missing or placeholder. Running in DRY-RUN mode.'
      };
    }
    return { valid: true, message: 'Twilio configured with valid Account SID.' };
  }
}
