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

export interface FcmConfig {
  projectId?: string;
  serverKey?: string;
  bearerToken?: string;
}

export class FcmPushAdapter implements INotificationAdapter {
  readonly providerName: NotificationProvider = 'FCM';
  readonly supportedChannels: NotificationChannel[] = ['PUSH'];

  private projectId: string;
  private serverKey?: string;
  private bearerToken?: string;

  constructor(config?: FcmConfig) {
    this.projectId = config?.projectId || env.FCM_PROJECT_ID || process.env.FCM_PROJECT_ID || 'monolith-push-dev';
    this.serverKey = config?.serverKey || env.FCM_SERVER_KEY || process.env.FCM_SERVER_KEY;
    this.bearerToken = config?.bearerToken || env.FCM_BEARER_TOKEN || process.env.FCM_BEARER_TOKEN;
  }

  isConfigured(): boolean {
    const hasBearer = Boolean(this.bearerToken && this.bearerToken.length > 20);
    const hasServerKey = Boolean(
      this.serverKey && 
      this.serverKey.length > 10 && 
      !this.serverKey.includes('your_fcm_server_key_here')
    );
    return hasBearer || hasServerKey;
  }

  async send(input: SendNotificationInput): Promise<SendNotificationOutput> {
    const isDryRun = input.dryRun !== undefined ? input.dryRun : !this.isConfigured();
    const simulatedMsgId = `projects/${this.projectId}/messages/${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    const now = new Date();

    // Prepare FCM HTTP v1 / JSON payload
    const dataPayload: Record<string, string> = {};
    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        dataPayload[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }

    const fcmMessage = {
      message: {
        token: input.recipient,
        notification: {
          title: input.subject,
          body: input.body
        },
        data: Object.keys(dataPayload).length > 0 ? dataPayload : undefined
      }
    };

    if (isDryRun) {
      dryRunOutbox.record({
        id: uuidv4(),
        notificationId: input.id,
        tenantId: input.tenantId,
        recipient: input.recipient,
        channel: 'PUSH',
        provider: 'FCM',
        subject: input.subject,
        body: input.body,
        isDryRun: true,
        simulatedAt: now,
        headers: {
          'Authorization': 'Bearer ya29.***[DRY_RUN_REDACTED]***',
          'Content-Type': 'application/json'
        },
        payload: fcmMessage
      });

      logger.info(`[FCM Push DRY-RUN] Push notification simulated for token ${input.recipient.substring(0, 15)}...`, {
        notificationId: input.id,
        providerMessageId: simulatedMsgId,
        projectId: this.projectId
      });

      return {
        provider: 'FCM',
        providerMessageId: simulatedMsgId,
        status: 'SENT',
        isDryRun: true,
        simulatedAt: now,
        rawResponse: {
          name: simulatedMsgId,
          simulated: true,
          provider: 'FCM',
          endpoint: `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`
        }
      };
    }

    // Live Execution against Firebase Cloud Messaging API
    const effectiveBearer = this.bearerToken || process.env.FCM_BEARER_TOKEN;
    const effectiveServerKey = this.serverKey || process.env.FCM_SERVER_KEY;

    if (!effectiveBearer && !effectiveServerKey) {
      return {
        provider: 'FCM',
        providerMessageId: simulatedMsgId,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: 'FCM_SERVER_KEY or FCM_BEARER_TOKEN is not configured for live dispatch'
      };
    }

    try {
      logger.info(`[FCM Push LIVE] Dispatching push notification to ${input.recipient.substring(0, 15)}...`, {
        notificationId: input.id
      });

      if (effectiveBearer) {
        // FCM HTTP v1 API
        const endpoint = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${effectiveBearer}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fcmMessage)
        });

        const data = await response.json() as any;

        if (response.ok && data.name) {
          return {
            provider: 'FCM',
            providerMessageId: data.name,
            status: 'SENT',
            isDryRun: false,
            rawResponse: data
          };
        }

        logger.error('FCM HTTP v1 API error', { status: response.status, data });
        return {
          provider: 'FCM',
          providerMessageId: simulatedMsgId,
          status: 'FAILED',
          isDryRun: false,
          errorMessage: data.error?.message || `FCM status ${response.status}`
        };
      } else {
        // FCM Legacy HTTP protocol with Server Key
        const endpoint = 'https://fcm.googleapis.com/fcm/send';
        const legacyBody = {
          to: input.recipient,
          notification: {
            title: input.subject,
            body: input.body
          },
          data: Object.keys(dataPayload).length > 0 ? dataPayload : undefined
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `key=${this.serverKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(legacyBody)
        });

        const data = await response.json() as any;

        if (response.ok && (data.success === 1 || data.message_id)) {
          const msgId = data.results?.[0]?.message_id || data.message_id || simulatedMsgId;
          return {
            provider: 'FCM',
            providerMessageId: msgId,
            status: 'SENT',
            isDryRun: false,
            rawResponse: data
          };
        }

        logger.error('FCM legacy API error', { status: response.status, data });
        return {
          provider: 'FCM',
          providerMessageId: simulatedMsgId,
          status: 'FAILED',
          isDryRun: false,
          errorMessage: data.results?.[0]?.error || `FCM legacy error status ${response.status}`
        };
      }
    } catch (err: any) {
      logger.error('FCM push network or dispatch error', { error: err.message });
      return {
        provider: 'FCM',
        providerMessageId: simulatedMsgId,
        status: 'FAILED',
        isDryRun: false,
        errorMessage: `FCM dispatch error: ${err.message}`
      };
    }
  }

  async verifyConfig(): Promise<{ valid: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return {
        valid: false,
        message: 'FCM Server Key or Bearer Token is missing. Running in DRY-RUN mode.'
      };
    }
    return { valid: true, message: 'FCM configured with valid credentials.' };
  }
}
