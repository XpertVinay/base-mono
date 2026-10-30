import { DryRunNotificationRecord } from '../../application/ports/notification-adapter.port.js';
import { NotificationChannel } from '@monolith/contracts';

export class DryRunOutboxService {
  private static instance: DryRunOutboxService;
  private items: DryRunNotificationRecord[] = [];
  private readonly maxCapacity = 500;

  public static getInstance(): DryRunOutboxService {
    if (!DryRunOutboxService.instance) {
      DryRunOutboxService.instance = new DryRunOutboxService();
    }
    return DryRunOutboxService.instance;
  }

  public record(item: DryRunNotificationRecord): void {
    if (this.items.length >= this.maxCapacity) {
      this.items.shift();
    }
    this.items.push(item);
  }

  public getAll(): DryRunNotificationRecord[] {
    return [...this.items].reverse();
  }

  public getByRecipient(recipient: string): DryRunNotificationRecord[] {
    return this.items.filter(i => i.recipient.toLowerCase() === recipient.toLowerCase()).reverse();
  }

  public getByChannel(channel: NotificationChannel): DryRunNotificationRecord[] {
    return this.items.filter(i => i.channel === channel).reverse();
  }

  public clear(): void {
    this.items = [];
  }

  public count(): number {
    return this.items.length;
  }
}

export const dryRunOutbox = DryRunOutboxService.getInstance();
