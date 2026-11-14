import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Job } from '../src/domain/entities/job.entity.js';
import { ISchedulerRepository } from '../src/domain/repositories/scheduler-repository.interface.js';

class InMemorySchedulerRepo implements ISchedulerRepository {
  public jobs: Job[] = [];

  async findById(id: string, tenantId?: string): Promise<Job | null> {
    return this.jobs.find(j => j.id === id && (!tenantId || j.tenantId === tenantId || j.tenantId === 'default' || !j.tenantId)) || null;
  }

  async findByName(name: string, tenantId?: string): Promise<Job | null> {
    return this.jobs.find(j => j.name === name && (!tenantId || j.tenantId === tenantId || j.tenantId === 'default' || !j.tenantId)) || null;
  }

  async listAll(tenantId?: string): Promise<Job[]> {
    if (!tenantId) return [...this.jobs];
    return this.jobs.filter(j => j.tenantId === tenantId || j.tenantId === 'default' || !j.tenantId);
  }

  async save(job: Job): Promise<void> {
    const existing = this.jobs.findIndex(j => j.id === job.id && j.tenantId === job.tenantId);
    if (existing >= 0) {
      this.jobs[existing] = job;
    } else {
      this.jobs.push(job);
    }
  }

  async update(job: Job): Promise<void> {
    const existing = this.jobs.findIndex(j => j.id === job.id);
    if (existing >= 0) {
      this.jobs[existing] = job;
    }
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const idx = this.jobs.findIndex(j => j.id === id && (!tenantId || j.tenantId === tenantId));
    if (idx >= 0) {
      this.jobs.splice(idx, 1);
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

test('Scheduler Service: Back-office CRUD Operations', async (t) => {
  const repo = new InMemorySchedulerRepo();
  const { app } = createApp(repo);
  const adminToken = createToken('ADMIN', 'tenant-corp');
  const supportToken = createToken('SUPPORT', 'tenant-corp');
  const userToken = createToken('USER', 'tenant-corp');

  let jobId = '';

  await t.test('1. RBAC: User cannot access backoffice jobs list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/scheduler/jobs', undefined, {
      Authorization: `Bearer ${userToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2. Create Job: POST /api/v1/scheduler/jobs creates scheduled job', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/scheduler/jobs',
      {
        name: 'DAILY_INVENTORY_SYNC',
        cronExpression: '0 2 * * *'
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.name, 'DAILY_INVENTORY_SYNC');
    jobId = res.body.data.id;
    assert.ok(jobId);
  });

  await t.test('3. List Jobs: GET /api/v1/scheduler/jobs returns backoffice list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/scheduler/jobs', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.length, 1);
  });

  await t.test('4. Get Job: GET /api/v1/scheduler/jobs/:id returns job detail by ID', async () => {
    const res = await makeHttpRequest(app, 'GET', `/api/v1/scheduler/jobs/${jobId}`, undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.id, jobId);
    assert.strictEqual(res.body.data.name, 'DAILY_INVENTORY_SYNC');
  });

  await t.test('5. Update Job: PATCH /api/v1/scheduler/jobs/:id updates cronExpression', async () => {
    const res = await makeHttpRequest(
      app,
      'PATCH',
      `/api/v1/scheduler/jobs/${jobId}`,
      { cronExpression: '0 4 * * *' },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.cronExpression, '0 4 * * *');
  });

  await t.test('6. Trigger Job: POST /api/v1/scheduler/jobs/:id/trigger triggers job', async () => {
    const res = await makeHttpRequest(app, 'POST', `/api/v1/scheduler/jobs/${jobId}/trigger`, {}, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
  });

  await t.test('7. Delete Job: DELETE /api/v1/scheduler/jobs/:id removes job', async () => {
    const res = await makeHttpRequest(app, 'DELETE', `/api/v1/scheduler/jobs/${jobId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.deleted, true);

    // Verify lookup fails
    const lookup = await makeHttpRequest(app, 'GET', `/api/v1/scheduler/jobs/${jobId}`, undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(lookup.status, 404);
  });

  await t.test('8. Route Aliases: Works under /api/v1/scheduler/backoffice/jobs', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/scheduler/backoffice/jobs', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
  });

  await t.test('9. Root Directory Discovery: GET /api/v1/scheduler returns 200 discovery metadata (D6 fix)', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/scheduler');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.service, 'scheduler-service');
    assert.ok(Array.isArray(res.body.endpoints));
  });

  await t.test('10. Canonical Back-Office Routes (F12): Works under /api/v1/backoffice/scheduler and /api/v1/backoffice/jobs', async () => {
    const resScheduler = await makeHttpRequest(app, 'GET', '/api/v1/backoffice/scheduler/jobs', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resScheduler.status, 200);
    assert.strictEqual(resScheduler.body.status, true);

    const resJobs = await makeHttpRequest(app, 'GET', '/api/v1/backoffice/jobs', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resJobs.status, 200);
    assert.strictEqual(resJobs.body.status, true);
  });

  await t.test('11. F22 Parameter Validation: Rejects whitespace-only job ID with 400', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/scheduler/jobs/%20%20', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 400);
  });
});

