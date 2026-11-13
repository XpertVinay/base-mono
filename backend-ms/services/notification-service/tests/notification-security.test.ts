import { test } from 'node:test';
import assert from 'node:assert';
import { Notification } from '../src/domain/entities/notification.entity.js';
import { INotificationRepository } from '../src/domain/repositories/notification-repository.interface.js';
import { SendNotificationUseCase, ListNotificationsQuery } from '../src/application/use-cases/notification.use-cases.js';
import { NotificationController } from '../src/presentation/http/notification.controller.js';

class MockNotificationRepository implements INotificationRepository {
  public items: Notification[] = [];

  async findById(id: string, tenantId?: string): Promise<Notification | null> {
    const found = this.items.find(n => n.id === id);
    if (!found) return null;
    if (tenantId && found.tenantId !== tenantId && found.tenantId !== 'default') return null;
    return found;
  }

  async findRecent(limit: number, tenantId?: string): Promise<Notification[]> {
    return this.items
      .filter(n => !tenantId || n.tenantId === tenantId || n.tenantId === 'default')
      .slice(0, limit);
  }

  async save(notification: Notification): Promise<void> {
    this.items.push(notification);
  }

  async update(notification: Notification): Promise<void> {
    const idx = this.items.findIndex(n => n.id === notification.id);
    if (idx >= 0) this.items[idx] = notification;
  }
}

test('Notification Service: Anti-spam/open-relay prevention and channel privilege restrictions', async () => {
  const repo = new MockNotificationRepository();
  const sendUseCase = new SendNotificationUseCase(repo);
  const listQuery = new ListNotificationsQuery(repo);
  const controller = new NotificationController(sendUseCase, listQuery);

  let capturedStatusCode = 0;
  let capturedResponse: any = null;
  const mockRes = {
    status(code: number) {
      capturedStatusCode = code;
      return this;
    },
    json(data: any) {
      capturedResponse = data;
      return this;
    }
  } as any;

  // 1. Regular user trying to send email to victim@company.com (open-relay abuse) -> 403 Forbidden
  const reqOpenRelay = {
    header: (name: string) => undefined,
    user: { id: 'usr-1', email: 'alice@example.com', role: 'USER' },
    body: {
      recipient: 'victim@company.com',
      channel: 'EMAIL',
      subject: 'Spam Attack',
      body: 'Phishing content'
    }
  } as any;

  await controller.send(reqOpenRelay, mockRes, () => {});
  assert.strictEqual(capturedStatusCode, 403);
  assert.strictEqual(capturedResponse.errors[0].code, 'FORBIDDEN_RECIPIENT');

  // 2. Regular user sending email to their own verified email address -> 201 Created
  const reqSelf = {
    header: (name: string) => undefined,
    user: { id: 'usr-1', email: 'alice@example.com', role: 'USER', tenantId: 'tenant-test' },
    body: {
      recipient: 'alice@example.com',
      channel: 'EMAIL',
      subject: 'Welcome',
      body: 'Your account is ready'
    }
  } as any;

  await controller.send(reqSelf, mockRes, () => {});
  assert.strictEqual(capturedStatusCode, 201);
  assert.strictEqual(capturedResponse.data.recipient, 'alice@example.com');
  assert.strictEqual(capturedResponse.data.status, 'SENT');

  // 3. Regular user attempting direct SMS -> 403 Forbidden
  const reqSms = {
    header: (name: string) => undefined,
    user: { id: 'usr-1', email: 'alice@example.com', role: 'USER' },
    body: {
      recipient: '+1234567890',
      channel: 'SMS',
      subject: 'Alert',
      body: 'SMS bombing attempt'
    }
  } as any;

  await controller.send(reqSms, mockRes, () => {});
  assert.strictEqual(capturedStatusCode, 403);
  assert.strictEqual(capturedResponse.errors[0].code, 'FORBIDDEN_CHANNEL');

  // 4. Admin user sending broadcast email to customer -> 201 Created
  const reqAdmin = {
    header: (name: string) => undefined,
    user: { id: 'admin-1', email: 'admin@platform.com', role: 'ADMIN', tenantId: 'tenant-test' },
    body: {
      recipient: 'customer@client.com',
      channel: 'EMAIL',
      subject: 'Invoice Ready',
      body: 'Your monthly invoice is attached'
    }
  } as any;

  await controller.send(reqAdmin, mockRes, () => {});
  assert.strictEqual(capturedStatusCode, 201);
});
