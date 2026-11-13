import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { SearchDocument } from '../src/domain/entities/search-document.entity.js';
import { ISearchRepository, ListSearchDocumentsOptions } from '../src/domain/repositories/search-repository.interface.js';

class InMemorySearchRepo implements ISearchRepository {
  public documents: SearchDocument[] = [];

  async findById(id: string): Promise<SearchDocument | null> {
    return this.documents.find(d => d.id === id) || null;
  }

  async index(doc: SearchDocument): Promise<void> {
    const existing = this.documents.findIndex(d => d.id === doc.id);
    if (existing >= 0) {
      this.documents[existing] = doc;
    } else {
      this.documents.push(doc);
    }
  }

  async search(query: string, type?: string): Promise<SearchDocument[]> {
    const q = query.toLowerCase();
    return this.documents.filter(d => {
      const matchText = d.title.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q);
      const matchType = !type || d.documentType.toUpperCase() === type.toUpperCase();
      return matchText && matchType;
    });
  }

  async listAll(options: ListSearchDocumentsOptions = {}): Promise<{ documents: SearchDocument[]; total: number }> {
    let filtered = [...this.documents];
    if (options.type) {
      filtered = filtered.filter(d => d.documentType.toUpperCase() === options.type!.toUpperCase());
    }
    if (options.search) {
      const s = options.search.toLowerCase();
      filtered = filtered.filter(
        d => d.title.toLowerCase().includes(s) || (d.description || '').toLowerCase().includes(s) || d.id.toLowerCase().includes(s)
      );
    }
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const documents = filtered.slice(start, start + limit);
    return { documents, total: filtered.length };
  }

  async remove(id: string): Promise<boolean> {
    const idx = this.documents.findIndex(d => d.id === id);
    if (idx >= 0) {
      this.documents.splice(idx, 1);
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

test('Search Service: Back-office CRUD Operations', async (t) => {
  const repo = new InMemorySearchRepo();
  const { app } = createApp(repo);
  const adminToken = createToken('ADMIN', 'tenant-corp');
  const supportToken = createToken('SUPPORT', 'tenant-corp');
  const userToken = createToken('USER', 'tenant-corp');

  await t.test('1. RBAC: User cannot access backoffice search documents list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/search/documents', undefined, {
      Authorization: `Bearer ${userToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2. Create Document: POST /api/v1/search/documents indexes document', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/search/documents',
      {
        id: 'doc-help-security-policy',
        documentType: 'POLICY',
        title: 'Enterprise Cryptographic & Tenant Isolation Policy',
        description: 'Comprehensive guidelines for RS256 token verification, anti-hijacking device fingerprints and multi-tenancy boundaries.',
        metadata: { category: 'security', author: 'SecOps Team' }
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.id, 'doc-help-security-policy');
    assert.strictEqual(res.body.data.documentType, 'POLICY');
  });

  await t.test('3. List Documents: GET /api/v1/search/documents returns backoffice documents list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/search/documents?page=1&limit=10', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.meta_data.pagination.total, 1);
  });

  await t.test('4. Get Document: GET /api/v1/search/documents/:id returns detail by ID', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/search/documents/doc-help-security-policy', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.id, 'doc-help-security-policy');
    assert.strictEqual(res.body.data.title, 'Enterprise Cryptographic & Tenant Isolation Policy');
  });

  await t.test('5. Update Document: PATCH /api/v1/search/documents/:id updates document fields', async () => {
    const res = await makeHttpRequest(
      app,
      'PATCH',
      '/api/v1/search/documents/doc-help-security-policy',
      {
        title: 'Enterprise Cryptographic & Multi-Tenant Security Policy v2'
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.title, 'Enterprise Cryptographic & Multi-Tenant Security Policy v2');
  });

  await t.test('6. Delete Document: DELETE /api/v1/search/documents/:id removes document', async () => {
    const res = await makeHttpRequest(app, 'DELETE', '/api/v1/search/documents/doc-help-security-policy', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.deleted, true);

    // Verify subsequent lookup fails
    const lookup = await makeHttpRequest(app, 'GET', '/api/v1/search/documents/doc-help-security-policy', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(lookup.status, 404);
  });

  await t.test('7. Route Aliases: Works under /api/v1/search/backoffice/documents', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/search/backoffice/documents', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
  });
});

