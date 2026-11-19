import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP' | 'WEBHOOK';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';
export type NotificationProvider = 'SENDGRID' | 'TWILIO' | 'META_CLOUD' | 'FCM' | 'MOCK';

export interface NotificationDto {
  id: string;
  recipient: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  status: NotificationStatus;
  provider?: string;
  providerMessageId?: string;
  isDryRun?: boolean;
  metadata?: Record<string, unknown> | null;
  errorMessage?: string | null;
  sentAt?: string;
  createdAt: string;
}

export interface SendNotificationPayload {
  recipient: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  provider?: NotificationProvider | string;
  dryRun?: boolean;
  templateId?: string;
  templateData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface NotificationQueryParams {
  recipient?: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  limit?: number;
}

export interface BatchNotificationResultDto {
  total: number;
  sentCount: number;
  failedCount: number;
  results: Array<{
    index: number;
    recipient: string;
    channel: string;
    success: boolean;
    notification?: NotificationDto;
    error?: string;
  }>;
}

export interface NotificationConfigDto {
  channels?: string[];
  providers?: Record<string, { enabled: boolean; priority?: number }>;
  defaultChannelRouting?: Record<string, string>;
  activeGateways?: string[];
  retryPolicy?: { maxRetries: number; backoffMs: number };
}

export interface ClearDryRunResultDto {
  cleared: boolean;
  count?: number;
  message?: string;
}

export interface WebhookSimulationResultDto {
  handled: boolean;
  provider: string;
  eventId?: string;
  status?: string;
}

const notifPath = (subPath = ''): string => `${resolveServiceEndpoint('notifications')}${subPath}`;

export const notificationsApi = {
  /**
   * Dispatch a notification (Email, SMS, WhatsApp, Push, In-App)
   */
  async send(
    payload: SendNotificationPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<NotificationDto>> {
    try {
      const res = await apiClient.post<unknown>(notifPath(), payload, options);
      return unwrapEnvelope<NotificationDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * List sent notifications with optional filtering
   */
  async list(
    params?: NotificationQueryParams,
    options?: RequestContextOptions
  ): Promise<ApiResult<NotificationDto[]>> {
    try {
      const res = await apiClient.get<unknown>(notifPath(), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<NotificationDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get notification details by ID
   */
  async getById(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<NotificationDto>> {
    try {
      const res = await apiClient.get<unknown>(notifPath(`/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<NotificationDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * High-throughput batch notification dispatch
   */
  async sendBatch(
    notifications: SendNotificationPayload[],
    dryRun?: boolean,
    options?: RequestContextOptions
  ): Promise<ApiResult<BatchNotificationResultDto>> {
    try {
      const res = await apiClient.post<unknown>(
        notifPath('/batch'),
        { notifications, dryRun },
        options
      );
      return unwrapEnvelope<BatchNotificationResultDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get developer DRY-run outbox simulation payloads
   */
  async getDryRunOutbox(
    options?: RequestContextOptions
  ): Promise<ApiResult<NotificationDto[]>> {
    try {
      const res = await apiClient.get<unknown>(notifPath('/dry-run/outbox'), options);
      return unwrapEnvelope<NotificationDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Clear all simulated notifications from developer DRY-run outbox
   */
  async clearDryRunOutbox(
    options?: RequestContextOptions
  ): Promise<ApiResult<ClearDryRunResultDto>> {
    try {
      const res = await apiClient.delete<unknown>(notifPath('/dry-run/outbox'), options);
      return unwrapEnvelope<ClearDryRunResultDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Retrieve active provider routing and notification engine configuration
   */
  async getProviderConfig(
    options?: RequestContextOptions
  ): Promise<ApiResult<NotificationConfigDto>> {
    try {
      const res = await apiClient.get<unknown>(notifPath('/config'), options);
      return unwrapEnvelope<NotificationConfigDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Ingest or simulate provider webhook delivery callback
   */
  async simulateWebhook(
    provider: string,
    payload: Record<string, unknown>,
    options?: RequestContextOptions
  ): Promise<ApiResult<WebhookSimulationResultDto>> {
    try {
      const res = await apiClient.post<unknown>(
        notifPath(`/webhooks/${encodeURIComponent(provider)}`),
        payload,
        options
      );
      return unwrapEnvelope<WebhookSimulationResultDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

