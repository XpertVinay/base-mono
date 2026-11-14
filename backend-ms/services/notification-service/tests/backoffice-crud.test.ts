import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Notification, NotificationChannel } from '../src/domain/entities/notification.entity.js';
import { INotificationRepository, ListNotificationsOptions } from '../src/domain/repositories/notification-repository.interface.js';

class InMemoryNotificationRepo implements INotificationRepository {
  public notifications: Notification[] = [];

  async findById(id: string, tenantId?: string): Promise<Notification | null> {
    const notif = this.notifications.find(n => n.id === id);
    if (!notif) return null;
    if (tenantId && notif.tenantId !== tenantId && notif.tenantId !== 'default') return null;
    return notif;
  }

  async listRecent(limit: number = 50, tenantId?: string): Promise<Notification[]> {
    return this.notifications
      .filter(n => !tenantId || n.tenantId === tenantId || n.tenantId === 'default')
      .slice(0, limit);
  }

  async findAll(tenantId?: string, options: ListNotificationsOptions = {}): Promise<{ notifications: Notification[]; total: number }> {
    let filtered = this.notifications.filter(
      n => !tenantId || n.tenantId === tenantId || n.tenantId === 'default'
    );
    if (options.status) {
      filtered = filtered.filter(n => n.status === options.status);
    }
    if (options.channel) {
      filtered = filtered.filter(n => n.channel === options.channel);
    }
    if (options.search) {
      const s = options.search.toLowerCase();
      filtered = filtered.filter(
        n => n.recipient.toLowerCase().includes(s) || n.subject.toLowerCase().includes(s) || n.body.toLowerCase().includes(s)
      );
    }
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const notifications = filtered.slice(start, start + limit);
    return { notifications, total: filtered.length };
  }

  async save(notification: Notification): Promise<void> {
    const existing = this.notifications.findIndex(n => n.id === notification.id);
    if (existing >= 0) {
      this.notifications[existing] = notification;
    } else {
      this.notifications.push(notification);
    }
  }

  async update(notification: Notification): Promise<void> {
    const existing = this.notifications.findIndex(n => n.id === notification.id);
    if (existing >= 0) {
      this.notifications[existing] = notification;
    }
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const idx = this.notifications.findIndex(
      n => n.id === id && (!tenantId || n.tenantId === tenantId || n.tenantId === 'default')
    );
    if (idx >= 0) {
      this.notifications.splice(idx, 1);
      return true;
    }
    return false;
  }
}

function makeHttpRequest(
  app: Express,
  method: string,
  urlPath: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: Record<string, any>; body: any }> {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({
      read() {},
      write(_chunk, _enc, cb) { cb(); }
    }) as any;
    socket.remoteAddress = '127.0.0.1';
    socket.encrypted = false;

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = urlPath;

    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const bodyStr = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
    if (bodyStr !== undefined) {
      normalizedHeaders['content-type'] = normalizedHeaders['content-type'] || 'application/json';
      normalizedHeaders['content-length'] = String(Buffer.byteLength(bodyStr));
    }
    req.headers = normalizedHeaders;

    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: any, ...args: any[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return origWrite(chunk, ...args);
    }) as any;

    res.end = ((chunk?: any, ...args: any[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsedBody: any = null;
      const headerSep = raw.indexOf('\r\n\r\n');
      const bodyPart = headerSep >= 0 && raw.startsWith('HTTP/') ? raw.slice(headerSep + 4) : raw;
      try {
        parsedBody = bodyPart ? JSON.parse(bodyPart) : null;
      } catch {
        parsedBody = bodyPart;
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody
      });
      return origEnd(chunk, ...args);
    }) as any;

    (app as any).handle(req, res, (err: any) => { if (err) reject(err); });

    if (bodyStr !== undefined) {
      req.push(bodyStr);
    }
    req.push(null);
  });
}

function createToken(role = 'ADMIN', tenantId = 'tenant-corp'): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
  return jwt.sign(
    { sub: 'usr-admin-1', role, tenantId, email: 'admin@corp.io' },
    secret,
    { expiresIn: '1h' }
  );
}

test('Notification Service: Back-office CRUD Operations', async (t) => {
  const repo = new InMemoryNotificationRepo();
  const { app } = createApp(repo);
  const adminToken = createToken('ADMIN', 'tenant-corp');
  const supportToken = createToken('SUPPORT', 'tenant-corp');
  const userToken = createToken('USER', 'tenant-corp');

  let notifId = '';

  await t.test('1. RBAC: User cannot access backoffice notifications list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/notifications', undefined, {
      Authorization: `Bearer ${userToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2. Send Notification: POST /api/v1/notifications creates notification', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/notifications',
      {
        recipient: 'finance@corp.io',
        channel: 'EMAIL',
        subject: 'Monthly Financial Summary',
        body: 'Please review the attached invoice summary for November 2026.'
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.recipient, 'finance@corp.io');
    notifId = res.body.data.id;
    assert.ok(notifId);
  });

  await t.test('3. List Notifications: GET /api/v1/notifications returns backoffice list with pagination', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/notifications?page=1&limit=10', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.meta_data.pagination.total, 1);
  });

  await t.test('4. Get Notification: GET /api/v1/notifications/:id returns detail by ID', async () => {
    const res = await makeHttpRequest(app, 'GET', `/api/v1/notifications/${notifId}`, undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.id, notifId);
    assert.strictEqual(res.body.data.subject, 'Monthly Financial Summary');
  });

  await t.test('5. Update Notification: PATCH /api/v1/notifications/:id updates status', async () => {
    const res = await makeHttpRequest(
      app,
      'PATCH',
      `/api/v1/notifications/${notifId}`,
      { status: 'SENT', subject: 'Monthly Financial Summary (Sent)' },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.status, 'SENT');
    assert.strictEqual(res.body.data.subject, 'Monthly Financial Summary (Sent)');
  });

  await t.test('6. Delete Notification: DELETE /api/v1/notifications/:id removes notification', async () => {
    const res = await makeHttpRequest(app, 'DELETE', `/api/v1/notifications/${notifId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.deleted, true);

    // Verify subsequent lookup fails
    const lookup = await makeHttpRequest(app, 'GET', `/api/v1/notifications/${notifId}`, undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(lookup.status, 404);
  });

  await t.test('7. Route Aliases: Works under /api/v1/notifications/backoffice/notifications', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/notifications/backoffice/notifications', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
  });

  await t.test('8. Canonical Back-Office Routes (F12): Works under /api/v1/backoffice/notifications and /api/backoffice/notifications', async () => {
    const resV1 = await makeHttpRequest(app, 'GET', '/api/v1/backoffice/notifications', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resV1.status, 200);
    assert.strictEqual(resV1.body.status, true);

    const resUnversioned = await makeHttpRequest(app, 'GET', '/api/backoffice/notifications', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resUnversioned.status, 200);
    assert.strictEqual(resUnversioned.body.status, true);
  });
});

