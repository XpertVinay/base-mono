import { Entity } from '../../../../shared/domain/entity.js';
import { NotificationChannel, NotificationStatus } from '@monolith/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationProps {
  recipient: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  status: NotificationStatus;
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
  get sentAt(): Date | undefined { return this.props.sentAt; }
  get createdAt(): Date { return this.props.createdAt; }

  public markSent(): void {
    this.props.status = 'SENT';
    this.props.sentAt = new Date();
  }

  public markFailed(): void {
    this.props.status = 'FAILED';
  }

  public static create(recipient: string, channel: NotificationChannel, subject: string, body: string, id?: string): Notification {
    return new Notification(id || uuidv4(), {
      recipient,
      channel,
      subject,
      body,
      status: 'PENDING',
      createdAt: new Date()
    });
  }

  public static reconstitute(id: string, props: NotificationProps): Notification {
    return new Notification(id, props);
  }
}
