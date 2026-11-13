import { Entity } from '../../shared/domain/entity.js';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface NotificationProps {
  tenantId?: string;
  recipient: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  status: NotificationStatus;
  sentAt?: Date;
  createdAt?: Date;
}

export class Notification extends Entity<NotificationProps> {
  private constructor(props: NotificationProps, id?: string) {
    super(props, id);
  }

  public static create(
    props: Omit<NotificationProps, 'status' | 'createdAt'>,
    id?: string
  ): Notification {
    return new Notification(
      {
        ...props,
        tenantId: props.tenantId || 'default',
        status: 'PENDING',
        createdAt: new Date()
      },
      id
    );
  }

  get tenantId(): string { return this.props.tenantId || 'default'; }
  get recipient(): string { return this.props.recipient; }
  get channel(): NotificationChannel { return this.props.channel; }
  get subject(): string { return this.props.subject; }
  get body(): string { return this.props.body; }
  get status(): NotificationStatus { return this.props.status; }
  get sentAt(): Date | undefined { return this.props.sentAt; }
  get createdAt(): Date { return this.props.createdAt!; }

  public markSent(): void {
    this.props.status = 'SENT';
    this.props.sentAt = new Date();
  }

  public markFailed(): void {
    this.props.status = 'FAILED';
  }
}
