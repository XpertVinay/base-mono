import { NotificationChannel, NotificationProvider } from '@monolith/contracts';

export interface SendNotificationInput {
  id: string;
  recipient: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  provider?: NotificationProvider;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export interface SendNotificationOutput {
  provider: NotificationProvider | string;
  providerMessageId: string;
  status: 'SENT' | 'FAILED' | 'DELIVERED';
  isDryRun: boolean;
  simulatedAt?: Date;
  rawResponse?: Record<string, unknown>;
  errorMessage?: string;
}

export interface DryRunNotificationRecord {
  id: string;
  notificationId: string;
  recipient: string;
  channel: NotificationChannel;
  provider: string;
  subject: string;
  body: string;
  isDryRun: boolean;
  simulatedAt: Date;
  headers?: Record<string, string>;
  payload: Record<string, unknown>;
}

export interface INotificationAdapter {
  readonly providerName: NotificationProvider | string;
  readonly supportedChannels: NotificationChannel[];
  isConfigured(): boolean;
  send(input: SendNotificationInput): Promise<SendNotificationOutput>;
  verifyConfig?(): Promise<{ valid: boolean; message?: string }>;
}
