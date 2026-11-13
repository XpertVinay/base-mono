process.env.RABBITMQ_ENABLED = 'false';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { ITenantRepository } from '../src/domain/repositories/tenant-repository.interface.js';
import { IOidcProviderRepository } from '../src/domain/repositories/oidc-provider-repository.interface.js';
import { IFederatedIdentityRepository } from '../src/domain/repositories/federated-identity-repository.interface.js';
import { IOidcAuthStateRepository } from '../src/domain/repositories/oidc-auth-state-repository.interface.js';
import { User } from '../src/domain/entities/user.entity.js';
import { Tenant } from '../src/domain/entities/tenant.entity.js';
import { OidcProvider } from '../src/domain/entities/oidc-provider.entity.js';
import { FederatedIdentity } from '../src/domain/entities/federated-identity.entity.js';
import { OidcAuthState } from '../src/domain/entities/oidc-auth-state.entity.js';
import { InMemoryUserRepository } from '../src/infrastructure/persistence/in-memory-user.repository.js';
import { PasswordVO } from '../src/domain/value-objects/password.vo.js';

class InMemoryTenantRepo implements ITenantRepository {
  private readonly items = new Map<string, Tenant>();
  constructor() {
    this.items.set('default', Tenant.create({ slug: 'default', name: 'Platform Default' }, 'default'));
  }
  async findById(id: string) { return this.items.get(id) || null; }
  async findBySlug(slug: string) {
    return Array.from(this.items.values()).find((t) => t.slug === slug.toLowerCase()) || null;
  }
  async findByIdOrSlug(idOrSlug: string) {
    return (await this.findById(idOrSlug)) || (await this.findBySlug(idOrSlug));
  }
  async listAll() { return Array.from(this.items.values()); }
  async save(tenant: Tenant) { this.items.set(tenant.id, tenant); }
  async update(tenant: Tenant) { this.items.set(tenant.id, tenant); }
  async delete(id: string) { return this.items.delete(id); }
}

class InMemoryOidcProviderRepo implements IOidcProviderRepository {
  private readonly items = new Map<string, OidcProvider>();
  async findById(id: string) { return this.items.get(id) || null; }
  async findBySlug(tenantId: string, slug: string) {
    return Array.from(this.items.values()).find((p) => p.tenantId === tenantId && p.slug === slug.toLowerCase()) || null;
  }
  async findByIdOrSlug(tenantId: string, idOrSlug: string) {
    return (await this.findById(idOrSlug)) || (await this.findBySlug(tenantId, idOrSlug));
  }
  async listByTenant(tenantId: string, onlyEnabled = false) {
    return Array.from(this.items.values()).filter((p) => p.tenantId === tenantId && (!onlyEnabled || p.isEnabled));
  }
  async save(provider: OidcProvider) { this.items.set(provider.id, provider); }
  async update(provider: OidcProvider) { this.items.set(provider.id, provider); }
  async delete(id: string, tenantId: string) {
    const existing = this.items.get(id);
    if (!existing || existing.tenantId !== tenantId) return false;
    return this.items.delete(id);
  }
}

class InMemoryFederatedRepo implements IFederatedIdentityRepository {
  private readonly items = new Map<string, FederatedIdentity>();
  async findById(id: string) { return this.items.get(id) || null; }
  async findBySubject(tenantId: string, providerId: string, subject: string) {
    return Array.from(this.items.values()).find((f) => f.tenantId === tenantId && f.providerId === providerId && f.subject === subject) || null;
  }
  async findByUserId(userId: string, tenantId?: string) {
    return Array.from(this.items.values()).filter((f) => f.userId === userId && (!tenantId || f.tenantId === tenantId));
  }
  async save(federated: FederatedIdentity) { this.items.set(federated.id, federated); }
  async delete(id: string) { return this.items.delete(id); }
}

class InMemoryAuthStateRepo implements IOidcAuthStateRepository {
  private readonly items = new Map<string, OidcAuthState>();
  async save(state: OidcAuthState) { this.items.set(state.state, state); }
  async findByState(state: string) { return this.items.get(state) || null; }
  async delete(state: string) { return this.items.delete(state); }
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

function generateToken(payload: { id: string; email: string; role: string; tenantId: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
  return jwt.sign(
    {
      sub: payload.id,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      tid: payload.tenantId
    },
    secret,
    { expiresIn: '1h' }
  );
}

test('Back-Office Portal IAM CRUD APIs', async (t) => {
  const userRepo = new InMemoryUserRepository();
  const tenantRepo = new InMemoryTenantRepo();
  const oidcProviderRepo = new InMemoryOidcProviderRepo();
  const federatedIdentityRepo = new InMemoryFederatedRepo();
  const oidcAuthStateRepo = new InMemoryAuthStateRepo();

  const { app, ssoSessionRepo } = createApp({
    userRepo,
    tenantRepo,
    oidcProviderRepo,
    federatedIdentityRepo,
    oidcAuthStateRepo
  });

  // Seed default admin and support users
  const adminPasswordHash = await PasswordVO.create('AdminSecurePass123!');
  const adminUser = User.create(
    {
      tenantId: 'default',
      email: 'admin@platform.local',
      passwordHash: adminPasswordHash,
      name: 'System Admin',
      role: 'ADMIN',
      authMethod: 'LOCAL'
    },
    'user-admin-1'
  );
  await userRepo.save(adminUser);

  const supportPasswordHash = await PasswordVO.create('SupportPass123!');
  const supportUser = User.create(
    {
      tenantId: 'default',
      email: 'support@platform.local',
      passwordHash: supportPasswordHash,
      name: 'Support Agent',
      role: 'SUPPORT',
      authMethod: 'LOCAL'
    },
    'user-support-1'
  );
  await userRepo.save(supportUser);

  const regularPasswordHash = await PasswordVO.create('UserPass123!');
  const regularUser = User.create(
    {
      tenantId: 'default',
      email: 'john.doe@example.com',
      passwordHash: regularPasswordHash,
      name: 'John Doe',
      role: 'USER',
      authMethod: 'LOCAL'
    },
    'user-regular-1'
  );
  await userRepo.save(regularUser);

  const adminToken = generateToken({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    tenantId: adminUser.tenantId
  });

  const supportToken = generateToken({
    id: supportUser.id,
    email: supportUser.email,
    role: supportUser.role,
    tenantId: supportUser.tenantId
  });

  const regularToken = generateToken({
    id: regularUser.id,
    email: regularUser.email,
    role: regularUser.role,
    tenantId: regularUser.tenantId
  });

  let createdUserId = '';

  await t.test('1. RBAC Security: Enforces authentication and authorized role checks', async () => {
    // 1.1 Unauthenticated request should fail with 401
    const unauthRes = await makeHttpRequest(app, 'GET', '/api/v1/iam/backoffice/users');
    assert.strictEqual(unauthRes.status, 401);
    assert.strictEqual(unauthRes.body.success, false);

    // 1.2 Regular USER role cannot access backoffice endpoint
    const userRes = await makeHttpRequest(app, 'GET', '/api/v1/iam/backoffice/users', undefined, {
      Authorization: `Bearer ${regularToken}`
    });
    assert.strictEqual(userRes.status, 403);

    // 1.3 SUPPORT role can view users but cannot create users (POST requires ADMIN)
    const supportGetRes = await makeHttpRequest(app, 'GET', '/api/v1/iam/backoffice/users', undefined, {
      Authorization: `Bearer ${supportToken}`
    });
    assert.strictEqual(supportGetRes.status, 200);

    const supportCreateRes = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/iam/backoffice/users',
      { email: 'new@caretaker.com', name: 'New Caretaker', role: 'CARETAKER' },
      { Authorization: `Bearer ${supportToken}` }
    );
    assert.strictEqual(supportCreateRes.status, 403);
  });

  await t.test('2. Roles Inspection: GET /api/v1/iam/backoffice/roles returns system role definitions', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/iam/backoffice/roles', undefined, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.ok(Array.isArray(res.body.data));
    const roles = res.body.data.map((r: any) => r.role);
    assert.ok(roles.includes('ADMIN'));
    assert.ok(roles.includes('SUPPORT'));
    assert.ok(roles.includes('CARETAKER'));
    assert.ok(roles.includes('OWNER'));
    assert.ok(roles.includes('TENANT'));
    assert.ok(roles.includes('VENDOR'));
    assert.ok(roles.includes('AGENT'));
    assert.ok(roles.includes('LEGAL'));
  });

  await t.test('3. Create User: POST /api/v1/iam/backoffice/users creates user with auto-generated password', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/iam/backoffice/users',
      {
        email: 'ramesh.caretaker@property.in',
        name: 'Ramesh Caretaker',
        role: 'CARETAKER',
        tenantId: 'default'
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, true);
    assert.ok(res.body.data.user);
    assert.strictEqual(res.body.data.user.email, 'ramesh.caretaker@property.in');
    assert.strictEqual(res.body.data.user.role, 'CARETAKER');
    assert.strictEqual(res.body.data.user.isActive, true);
    // Temporary password was auto-generated
    assert.ok(res.body.data.temporaryPassword);
    assert.ok(res.body.data.temporaryPassword.length >= 8);

    createdUserId = res.body.data.user.id;
  });

  await t.test('4. Create User: Rejects duplicate email in the same tenant', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/iam/backoffice/users',
      {
        email: 'ramesh.caretaker@property.in',
        name: 'Duplicate Ramesh',
        role: 'CARETAKER'
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.status, false);
    assert.ok(res.body.message.includes('already exists'));
  });

  await t.test('5. List & Search Users: GET /api/v1/iam/backoffice/users supports search and filters', async () => {
    // 5.1 Basic pagination
    const listRes = await makeHttpRequest(app, 'GET', '/api/v1/iam/backoffice/users?page=1&limit=2', undefined, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.data.length, 2);
    assert.strictEqual(listRes.body.meta_data.pagination.page, 1);
    assert.strictEqual(listRes.body.meta_data.pagination.limit, 2);
    assert.strictEqual(listRes.body.meta_data.pagination.total >= 4, true);

    // 5.2 Filter by role=CARETAKER
    const roleFilterRes = await makeHttpRequest(
      app,
      'GET',
      '/api/v1/iam/backoffice/users?role=CARETAKER',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(roleFilterRes.status, 200);
    assert.strictEqual(roleFilterRes.body.data.length, 1);
    assert.strictEqual(roleFilterRes.body.data[0].email, 'ramesh.caretaker@property.in');

    // 5.3 Search by substring
    const searchRes = await makeHttpRequest(
      app,
      'GET',
      '/api/v1/iam/backoffice/users?search=ramesh',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.data.length, 1);
    assert.strictEqual(searchRes.body.data[0].name, 'Ramesh Caretaker');
  });

  await t.test('6. User Detail: GET /api/v1/iam/backoffice/users/:id retrieves profile & metadata', async () => {
    const res = await makeHttpRequest(app, 'GET', `/api/v1/iam/backoffice/users/${createdUserId}`, undefined, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.id, createdUserId);
    assert.strictEqual(res.body.data.email, 'ramesh.caretaker@property.in');
    assert.strictEqual(res.body.data.tenantName, 'Platform Default');
    assert.strictEqual(res.body.data.activeSessionsCount, 0);
  });

  await t.test('7. Update User: PATCH /api/v1/iam/backoffice/users/:id updates profile fields', async () => {
    const res = await makeHttpRequest(
      app,
      'PATCH',
      `/api/v1/iam/backoffice/users/${createdUserId}`,
      {
        name: 'Ramesh Senior Caretaker',
        role: 'PROPERTY_MANAGER'
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.name, 'Ramesh Senior Caretaker');
    assert.strictEqual(res.body.data.role, 'PROPERTY_MANAGER');
  });

  await t.test('8. User Status & Session Revocation: Suspend & Reactivate user', async () => {
    // 8.1 Suspend user
    const suspendRes = await makeHttpRequest(
      app,
      'PATCH',
      `/api/v1/iam/backoffice/users/${createdUserId}/status`,
      { isActive: false, reason: 'Pending background verification check' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(suspendRes.status, 200);
    assert.strictEqual(suspendRes.body.data.isActive, false);

    // 8.2 Verify in user detail
    const getSuspendedRes = await makeHttpRequest(
      app,
      'GET',
      `/api/v1/iam/backoffice/users/${createdUserId}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(getSuspendedRes.body.data.isActive, false);

    // 8.3 Safeguard: Admin cannot suspend self
    const selfSuspendRes = await makeHttpRequest(
      app,
      'PATCH',
      `/api/v1/iam/backoffice/users/${adminUser.id}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(selfSuspendRes.status, 400);
    assert.ok(selfSuspendRes.body.message.includes('cannot suspend their own account'));

    // 8.4 Reactivate user
    const reactivateRes = await makeHttpRequest(
      app,
      'PATCH',
      `/api/v1/iam/backoffice/users/${createdUserId}/status`,
      { isActive: true },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(reactivateRes.status, 200);
    assert.strictEqual(reactivateRes.body.data.isActive, true);
  });

  await t.test('9. Password Reset: POST /api/v1/iam/backoffice/users/:id/reset-password', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      `/api/v1/iam/backoffice/users/${createdUserId}/reset-password`,
      { newPassword: 'BrandNewSecurePassword123!' },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.passwordReset, true);
    assert.strictEqual(res.body.data.userId, createdUserId);

    // Verify user can now log in with the new password
    const loginRes = await makeHttpRequest(app, 'POST', '/api/v1/iam/login', {
      email: 'ramesh.caretaker@property.in',
      password: 'BrandNewSecurePassword123!'
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.status, true);
    assert.ok(loginRes.body.data.accessToken);
  });

  await t.test('10. Sessions Management: List and revoke user sessions', async () => {
    // Check sessions for the user (we just logged in, so at least 1 session exists)
    const listSessionsRes = await makeHttpRequest(
      app,
      'GET',
      `/api/v1/iam/backoffice/users/${createdUserId}/sessions`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(listSessionsRes.status, 200);
    assert.strictEqual(listSessionsRes.body.status, true);
    assert.ok(Array.isArray(listSessionsRes.body.data));
    assert.ok(listSessionsRes.body.data.length >= 1);

    const sessionId = listSessionsRes.body.data[0].id;

    // Revoke single session
    const revokeSingleRes = await makeHttpRequest(
      app,
      'DELETE',
      `/api/v1/iam/backoffice/sessions/${sessionId}`,
      { reason: 'Security maintenance' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(revokeSingleRes.status, 200);
    assert.strictEqual(revokeSingleRes.body.data.revokedCount, 1);

    // Revoke all sessions for user
    const revokeAllRes = await makeHttpRequest(
      app,
      'DELETE',
      `/api/v1/iam/backoffice/users/${createdUserId}/sessions`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(revokeAllRes.status, 200);
    assert.strictEqual(revokeAllRes.body.status, true);
  });

  await t.test('11. Delete User: Safeguards and execution', async () => {
    // 11.1 Safeguard: Admin cannot delete self
    const selfDeleteRes = await makeHttpRequest(
      app,
      'DELETE',
      `/api/v1/iam/backoffice/users/${adminUser.id}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(selfDeleteRes.status, 400);
    assert.ok(selfDeleteRes.body.message.includes('cannot delete their own account'));

    // 11.2 Successfully delete created caretaker user
    const deleteRes = await makeHttpRequest(
      app,
      'DELETE',
      `/api/v1/iam/backoffice/users/${createdUserId}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.status, true);
    assert.strictEqual(deleteRes.body.data.deleted, true);

    // 11.3 Verify user no longer exists
    const getDeletedRes = await makeHttpRequest(
      app,
      'GET',
      `/api/v1/iam/backoffice/users/${createdUserId}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(getDeletedRes.status, 404);
  });

  await t.test('12. Tenant CRUD: Cannot delete default tenant, can delete created tenant', async () => {
    // 12.1 Cannot delete default tenant
    const delDefaultRes = await makeHttpRequest(
      app,
      'DELETE',
      '/api/v1/iam/backoffice/tenants/default',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(delDefaultRes.status, 400);
    assert.ok(delDefaultRes.body.message.includes('default tenant cannot be deleted'));

    // 12.2 Create a custom tenant
    const createTenantRes = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/iam/tenants',
      { slug: 'temp-tenant', name: 'Temporary Tenant' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(createTenantRes.status, 201);

    // 12.3 Delete the custom tenant via backoffice endpoint
    const delCustomRes = await makeHttpRequest(
      app,
      'DELETE',
      '/api/v1/iam/backoffice/tenants/temp-tenant',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.strictEqual(delCustomRes.status, 200);
    assert.strictEqual(delCustomRes.body.data.deleted, true);
  });

  await t.test('13. Route Aliases: Works under /api/iam/backoffice and /api/v1/iam/admin', async () => {
    const alias1 = await makeHttpRequest(app, 'GET', '/api/iam/backoffice/roles', undefined, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(alias1.status, 200);

    const alias2 = await makeHttpRequest(app, 'GET', '/api/v1/iam/admin/roles', undefined, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(alias2.status, 200);
  });
});
