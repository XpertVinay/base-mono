export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';
export type NotificationProvider = 'SENDGRID' | 'TWILIO' | 'META_CLOUD' | 'FCM' | 'MOCK';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';

export interface NotificationDto {
  id: string;
  tenantId?: string;
  recipient: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  status: NotificationStatus;
  provider?: string;
  providerMessageId?: string;
  isDryRun?: boolean;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

export interface SendNotificationRequestDto {
  tenantId?: string;
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

export interface BatchNotificationItemResult {
  index: number;
  recipient: string;
  channel: NotificationChannel;
  success: boolean;
  notification?: NotificationDto;
  error?: string;
}

export interface BatchNotificationRequestDto {
  tenantId?: string;
  notifications: SendNotificationRequestDto[];
  dryRun?: boolean;
}

export interface BatchNotificationResultDto {
  total: number;
  sentCount: number;
  failedCount: number;
  results: BatchNotificationItemResult[];
}

export interface NotificationDryRunOutboxItem {
  id: string;
  tenantId?: string;
  notificationId: string;
  recipient: string;
  channel: NotificationChannel;
  provider: string;
  subject: string;
  body: string;
  isDryRun: boolean;
  simulatedAt: string;
  headers?: Record<string, string>;
  payload: Record<string, unknown>;
}

export interface ChannelProviderConfigDto {
  channel: NotificationChannel;
  activeProvider: string;
  isConfigured: boolean;
  isDryRun: boolean;
  supportedProviders: string[];
}

export interface NotificationConfigDto {
  globalDryRun: boolean;
  environment: string;
  channels: Record<NotificationChannel, ChannelProviderConfigDto>;
}
