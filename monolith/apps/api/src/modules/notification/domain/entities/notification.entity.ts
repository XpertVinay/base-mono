import { Entity } from '../../../../shared/domain/entity.js';
import { NotificationChannel, NotificationStatus } from '@monolith/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationProps {
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
  sentAt?: Date;
  createdAt: Date;
}

export class Notification extends Entity<NotificationProps> {
  private constructor(id: string, props: NotificationProps) {
    super(id, props);
  }

  get recipient(): string { return this.props.recipient; }
  get channel(): NotificationChannel { return this.props.channel; }
  get subject(): string { return this.props.subject; }
  get body(): string { return this.props.body; }
  get status(): NotificationStatus { return this.props.status; }
  get provider(): string | undefined { return this.props.provider; }
  get providerMessageId(): string | undefined { return this.props.providerMessageId; }
  get isDryRun(): boolean { return this.props.isDryRun ?? false; }
  get metadata(): Record<string, unknown> | undefined { return this.props.metadata; }
  get errorMessage(): string | undefined { return this.props.errorMessage; }
  get sentAt(): Date | undefined { return this.props.sentAt; }
  get createdAt(): Date { return this.props.createdAt; }

  public markSent(provider?: string, providerMessageId?: string, isDryRun?: boolean): void {
    this.props.status = 'SENT';
    this.props.sentAt = new Date();
    if (provider) this.props.provider = provider;
    if (providerMessageId) this.props.providerMessageId = providerMessageId;
    if (isDryRun !== undefined) this.props.isDryRun = isDryRun;
  }

  public markFailed(errorMessage: string, provider?: string): void {
    this.props.status = 'FAILED';
    this.props.errorMessage = errorMessage;
    if (provider) this.props.provider = provider;
  }

  public markDelivered(): void {
    this.props.status = 'DELIVERED';
  }

  public static create(
    recipient: string,
    channel: NotificationChannel,
    subject: string,
    body: string,
    options?: {
      provider?: string;
      isDryRun?: boolean;
      metadata?: Record<string, unknown>;
      id?: string;
    }
  ): Notification {
    return new Notification(options?.id || uuidv4(), {
      recipient,
      channel,
      subject,
      body,
      status: 'PENDING',
      provider: options?.provider,
      isDryRun: options?.isDryRun ?? false,
      metadata: options?.metadata,
      createdAt: new Date()
    });
  }

  public static reconstitute(id: string, props: NotificationProps): Notification {
    return new Notification(id, props);
  }
}
