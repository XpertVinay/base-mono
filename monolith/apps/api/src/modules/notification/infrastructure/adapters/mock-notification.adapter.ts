import {
  INotificationAdapter,
  SendNotificationInput,
  SendNotificationOutput
} from '../../application/ports/notification-adapter.port.js';
import { NotificationChannel, NotificationProvider } from '@monolith/contracts';
import { dryRunOutbox } from './dry-run-outbox.service.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class MockNotificationAdapter implements INotificationAdapter {
  readonly providerName: NotificationProvider = 'MOCK';
  readonly supportedChannels: NotificationChannel[] = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'];

  isConfigured(): boolean {
    return true;
  }

  async send(input: SendNotificationInput): Promise<SendNotificationOutput> {
    const isFailureRequested = 
      input.recipient.includes('fail') || 
      (input.metadata && input.metadata['forceFail'] === true);

    const messageId = `mock_${input.channel.toLowerCase()}_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const now = new Date();

    const record = {
      id: uuidv4(),
      notificationId: input.id,
      recipient: input.recipient,
      channel: input.channel,
      provider: 'MOCK',
      subject: input.subject,
      body: input.body,
      isDryRun: true,
      simulatedAt: now,
      headers: {
        'x-mock-delivery': 'simulated',
        'x-environment': process.env.NODE_ENV || 'development'
      },
      payload: {
        templateId: input.templateId,
        templateData: input.templateData,
        metadata: input.metadata
      }
    };

    dryRunOutbox.record(record);

    if (isFailureRequested) {
      logger.warn(`[DRY-RUN / MOCK] Simulated notification delivery failure to ${input.recipient}`, {
        channel: input.channel,
        messageId
      });
      return {
        provider: 'MOCK',
        providerMessageId: messageId,
        status: 'FAILED',
        isDryRun: true,
        simulatedAt: now,
        errorMessage: 'Simulated delivery failure: recipient requested failure in mock environment'
      };
    }

    logger.info(`[DRY-RUN / MOCK] Notification simulated to ${input.recipient} via ${input.channel}`, {
      messageId,
      subject: input.subject
    });

    return {
      provider: 'MOCK',
      providerMessageId: messageId,
      status: 'SENT',
      isDryRun: true,
      simulatedAt: now,
      rawResponse: {
        simulated: true,
        channel: input.channel,
        deliveredAt: now.toISOString()
      }
    };
  }

  async verifyConfig(): Promise<{ valid: boolean; message?: string }> {
    return { valid: true, message: 'Mock notification adapter is always available and configured.' };
  }
}
