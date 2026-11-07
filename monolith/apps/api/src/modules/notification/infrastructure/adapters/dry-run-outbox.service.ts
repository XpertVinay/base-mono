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

  public getAll(tenantId?: string): DryRunNotificationRecord[] {
    const list = tenantId ? this.items.filter(i => i.tenantId === tenantId) : this.items;
    return [...list].reverse();
  }

  public getByRecipient(recipient: string, tenantId?: string): DryRunNotificationRecord[] {
    return this.items
      .filter(i => i.recipient.toLowerCase() === recipient.toLowerCase() && (!tenantId || i.tenantId === tenantId))
      .reverse();
  }

  public getByChannel(channel: NotificationChannel, tenantId?: string): DryRunNotificationRecord[] {
    return this.items
      .filter(i => i.channel === channel && (!tenantId || i.tenantId === tenantId))
      .reverse();
  }

  public clear(): void {
    this.items = [];
  }

  public count(): number {
    return this.items.length;
  }
}

export const dryRunOutbox = DryRunOutboxService.getInstance();
