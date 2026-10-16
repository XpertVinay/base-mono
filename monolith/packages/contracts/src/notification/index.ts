export type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface NotificationDto {
  id: string;
  recipient: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  status: NotificationStatus;
  sentAt?: string;
  createdAt: string;
}

export interface SendNotificationRequestDto {
  recipient: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
}
