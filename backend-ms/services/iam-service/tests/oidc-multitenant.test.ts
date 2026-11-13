process.env.RABBITMQ_ENABLED = 'false';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { IUserRepository } from '../src/domain/repositories/user-repository.interface.js';
import { ITenantRepository } from '../src/domain/repositories/tenant-repository.interface.js';
import { IOidcProviderRepository } from '../src/domain/repositories/oidc-provider-repository.interface.js';
import { IFederatedIdentityRepository } from '../src/domain/repositories/federated-identity-repository.interface.js';
import { IOidcAuthStateRepository } from '../src/domain/repositories/oidc-auth-state-repository.interface.js';
import { User } from '../src/domain/entities/user.entity.js';
import { Tenant } from '../src/domain/entities/tenant.entity.js';
import { OidcProvider } from '../src/domain/entities/oidc-provider.entity.js';
import { FederatedIdentity } from '../src/domain/entities/federated-identity.entity.js';
import { OidcAuthState } from '../src/domain/entities/oidc-auth-state.entity.js';
import { CryptoService } from '../src/shared/infrastructure/crypto.service.js';
import { InMemoryUserRepository } from '../src/infrastructure/persistence/in-memory-user.repository.js';

class InMemoryTenantRepo implements ITenantRepository {
  private readonly items = new Map<string, Tenant>();
  constructor() {
    this.items.set('default', Tenant.create({ slug: 'default', name: 'Default Tenant' }, 'default'));
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

class InMemoryUserRepo extends InMemoryUserRepository {}

class InMemoryOidcProviderRepo implements IOidcProviderRepository {
  private readonly items = new Map<string, OidcProvider>();
  async findById(id: string) { return this.items.get(id) || null; }
  async findBySlug(tenantId: string, slug: string) {
    return (
      Array.from(this.items.values()).find(
        (p) => p.tenantId === tenantId && p.slug === slug.toLowerCase()
      ) || null
    );
  }
  async findByIdOrSlug(tenantId: string, idOrSlug: string) {
    const byId = this.items.get(idOrSlug);
    if (byId && byId.tenantId === tenantId) return byId;
    return this.findBySlug(tenantId, idOrSlug);
  }
  async listByTenant(tenantId: string, onlyEnabled = false) {
    return Array.from(this.items.values()).filter(
      (p) => p.tenantId === tenantId && (!onlyEnabled || p.isEnabled)
    );
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
    return (
      Array.from(this.items.values()).find(
        (f) => f.tenantId === tenantId && f.providerId === providerId && f.subject === subject
      ) || null
    );
  }
  async findByUserId(userId: string, tenantId?: string) {
    return Array.from(this.items.values()).filter(
      (f) => f.userId === userId && (!tenantId || f.tenantId === tenantId)
    );
  }
  async save(identity: FederatedIdentity) { this.items.set(identity.id, identity); }
  async update(identity: FederatedIdentity) { this.items.set(identity.id, identity); }
  async deleteById(id: string, userId: string, tenantId: string) {
    const existing = this.items.get(id);
    if (!existing || existing.userId !== userId || existing.tenantId !== tenantId) return false;
    return this.items.delete(id);
  }
}

class InMemoryAuthStateRepo implements IOidcAuthStateRepository {
  private readonly items = new Map<string, OidcAuthState>();
  async save(state: OidcAuthState) { this.items.set(state.state, state); }
  async consume(stateValue: string) {
    const st = this.items.get(stateValue);
    if (!st || st.consumedAt) return null;
    st.consumedAt = new Date();
    return st;
  }
  async pruneExpired() { return 0; }
}

/**
 * In-process Express request dispatcher (avoids opening TCP ports in sandboxed environments).
 */
async function invokeApp(
  app: Express,
  method: string,
  urlPath: string,
  options: { headers?: Record<string, string>; body?: any } = {}
): Promise<{ status: number; headers: Record<string, any>; json: any }> {
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
    for (const [k, v] of Object.entries(options.headers || {})) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : undefined;
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
      // Express compression/headers strip status line when captured via write/end; body may start after HTTP headers if socket-written
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
        json: parsedBody
      });
      return origEnd(chunk, ...args);
    }) as any;

    res.on('error', reject);
    (app as any)(req, res);

    if (bodyStr !== undefined) {
      req.push(Buffer.from(bodyStr));
    }
    req.push(null);
  });
}

test('CryptoService AES-256-GCM encrypt/decrypt round-trip', () => {
  const secret = 'super-oidc-client-secret-value';
  const encrypted = CryptoService.encrypt(secret);
  assert.ok(encrypted.startsWith('v1:'));
  assert.notEqual(encrypted, secret);
  assert.equal(CryptoService.decrypt(encrypted), secret);
});

test('Full OIDC Authorization Code + PKCE + JWKS RS256 + Multi-Tenant Flow', async () => {
  process.env.MULTI_TENANCY_ENABLED = 'true';
  process.env.MULTI_TENANCY_MODE = 'optional';

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, any>;
  jwk.kid = 'test-rsa-key-1';
  jwk.use = 'sig';
  jwk.alg = 'RS256';

  let lastNonce = '';
  let lastCodeChallenge = '';
  const idpBaseUrl = 'https://idp.acme.test';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr === `${idpBaseUrl}/.well-known/openid-configuration`) {
      return new Response(
        JSON.stringify({
          issuer: idpBaseUrl,
          authorization_endpoint: `${idpBaseUrl}/authorize`,
          token_endpoint: `${idpBaseUrl}/token`,
          userinfo_endpoint: `${idpBaseUrl}/userinfo`,
          jwks_uri: `${idpBaseUrl}/.well-known/jwks.json`
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr === `${idpBaseUrl}/.well-known/jwks.json`) {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (urlStr === `${idpBaseUrl}/token`) {
      const bodyParams = new URLSearchParams(String(init?.body || ''));
      const verifier = bodyParams.get('code_verifier') || '';
      const computedChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      assert.equal(computedChallenge, lastCodeChallenge, 'PKCE S256 verifier must match code_challenge');
      assert.equal(bodyParams.get('client_secret'), 'acme-oidc-secret');

      const idToken = jwt.sign(
        {
          iss: idpBaseUrl,
          aud: 'acme-client-id',
          sub: 'idp-user-9001',
          email: 'jane.doe@acme.com',
          email_verified: true,
          name: 'Jane Doe',
          nonce: lastNonce,
          groups: ['acme-admins']
        },
        privateKey,
        { algorithm: 'RS256', keyid: 'test-rsa-key-1', expiresIn: '5m' }
      );

      return new Response(
        JSON.stringify({
          access_token: 'idp-access-token',
          id_token: idToken,
          token_type: 'Bearer',
          expires_in: 300
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return originalFetch(input as any, init);
  }) as typeof fetch;

  const tenantRepo = new InMemoryTenantRepo();
  const userRepo = new InMemoryUserRepo();
  const oidcProviderRepo = new InMemoryOidcProviderRepo();
  const federatedIdentityRepo = new InMemoryFederatedRepo();
  const oidcAuthStateRepo = new InMemoryAuthStateRepo();

  const { app } = createApp({
    tenantRepo,
    userRepo,
    oidcProviderRepo,
    federatedIdentityRepo,
    oidcAuthStateRepo
  });

  try {
    // 1. Register & login ADMIN in default tenant
    const regAdmin = await invokeApp(app, 'POST', '/api/v1/iam/register', {
      body: {
        email: 'root-admin@example.com',
        password: 'Password123!',
        name: 'Root Admin',
        role: 'ADMIN'
      }
    });
    assert.equal(regAdmin.status, 201);

    const loginAdmin = await invokeApp(app, 'POST', '/api/v1/iam/login', {
      body: {
        email: 'root-admin@example.com',
        password: 'Password123!'
      }
    });
    assert.equal(loginAdmin.status, 200);
    const adminToken = loginAdmin.json.data.accessToken;
    assert.ok(adminToken);

    // 2. Create 'acme' tenant
    const createTenantRes = await invokeApp(app, 'POST', '/api/v1/iam/tenants', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        id: 'acme',
        slug: 'acme',
        name: 'Acme Corporation',
        config: {
          allowLocalLogin: true,
          allowFederatedLogin: true,
          autoProvisionUsers: true,
          allowedEmailDomains: ['acme.com']
        }
      }
    });
    assert.equal(createTenantRes.status, 201);

    // 3. Configure GENERIC_OIDC provider for 'acme'
    const configProviderRes = await invokeApp(app, 'POST', '/api/v1/iam/oidc/admin/providers', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        tenantId: 'acme',
        slug: 'corp-sso',
        providerType: 'GENERIC_OIDC',
        displayName: 'Acme Corporate SSO',
        issuerUrl: idpBaseUrl,
        clientId: 'acme-client-id',
        clientSecret: 'acme-oidc-secret',
        redirectUri: 'http://localhost:4000/api/v1/iam/oidc/corp-sso/callback',
        allowedDomains: ['acme.com'],
        roleMapping: { 'acme-admins': 'ADMIN' }
      }
    });
    assert.equal(configProviderRes.status, 201);
    assert.equal(configProviderRes.json.data.hasClientSecret, true);
    assert.equal(configProviderRes.json.data.clientSecret, undefined);

    // 4. Test OIDC discovery endpoint
    const discoveryTestRes = await invokeApp(
      app,
      'POST',
      `/api/v1/iam/oidc/admin/providers/${configProviderRes.json.data.id}/test-discovery?tenantId=acme`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.equal(discoveryTestRes.status, 200);
    assert.equal(discoveryTestRes.json.data.jwksUri, `${idpBaseUrl}/.well-known/jwks.json`);

    // 5. Public provider discovery for tenant 'acme'
    const publicProvidersRes = await invokeApp(app, 'GET', '/api/v1/iam/oidc/providers', {
      headers: { 'x-tenant-id': 'acme' }
    });
    assert.equal(publicProvidersRes.status, 200);
    assert.equal(publicProvidersRes.json.data.length, 1);
    assert.equal(publicProvidersRes.json.data[0].slug, 'corp-sso');

    // 6. Initiate OIDC login (generates state, nonce, PKCE S256)
    const authRes = await invokeApp(app, 'GET', '/api/v1/iam/oidc/corp-sso/authorize?tenantSlug=acme');
    assert.equal(authRes.status, 200);
    const authUrl = new URL(authRes.json.data.authorizationUrl);
    lastNonce = authUrl.searchParams.get('nonce') || '';
    lastCodeChallenge = authUrl.searchParams.get('code_challenge') || '';
    const state = authUrl.searchParams.get('state') || '';
    assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(state && lastNonce && lastCodeChallenge);

    // 7. Complete OIDC callback -> verifies PKCE, RS256 JWKS, roleMapping, JIT provisioning
    const cbRes = await invokeApp(
      app,
      'GET',
      `/api/v1/iam/oidc/corp-sso/callback?code=auth-code-123&state=${encodeURIComponent(state)}`
    );
    assert.equal(cbRes.status, 200);
    assert.equal(cbRes.json.data.tenantId, 'acme');
    assert.equal(cbRes.json.data.authMethod, 'OIDC');
    assert.equal(cbRes.json.data.provider, 'corp-sso');
    assert.equal(cbRes.json.data.isNewUser, true);
    assert.equal(cbRes.json.data.user.role, 'ADMIN');
    assert.equal(cbRes.json.data.user.email, 'jane.doe@acme.com');

    const acmeToken = cbRes.json.data.accessToken;

    // 8. Replay protection: reusing the same OIDC state must fail
    const replayRes = await invokeApp(
      app,
      'GET',
      `/api/v1/iam/oidc/corp-sso/callback?code=auth-code-123&state=${encodeURIComponent(state)}`
    );
    assert.equal(replayRes.status, 401);

    // 9. Cross-tenant isolation: acme JWT with default x-tenant-id header must be rejected (403)
    const mismatchRes = await invokeApp(app, 'GET', '/api/v1/iam/profile', {
      headers: {
        Authorization: `Bearer ${acmeToken}`,
        'x-tenant-id': 'default'
      }
    });
    assert.equal(mismatchRes.status, 403);

    // Valid tenant header works
    const profileRes = await invokeApp(app, 'GET', '/api/v1/iam/profile', {
      headers: {
        Authorization: `Bearer ${acmeToken}`,
        'x-tenant-id': 'acme'
      }
    });
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.json.data.tenantId, 'acme');

    // 10. Passwordless OIDC user cannot unlink their sole federated identity
    const fedListRes = await invokeApp(app, 'GET', '/api/v1/iam/federated-identities', {
      headers: { Authorization: `Bearer ${acmeToken}` }
    });
    assert.equal(fedListRes.status, 200);
    assert.equal(fedListRes.json.data.length, 1);

    const unlinkRes = await invokeApp(
      app,
      'DELETE',
      `/api/v1/iam/federated-identities/${fedListRes.json.data[0].id}`,
      { headers: { Authorization: `Bearer ${acmeToken}` } }
    );
    assert.equal(unlinkRes.status, 400);

    // 11. Token refresh preserves tenant & OIDC metadata
    const refreshRes = await invokeApp(app, 'POST', '/api/v1/iam/refresh', {
      headers: { 'x-tenant-id': 'acme' },
      body: { refreshToken: cbRes.json.data.refreshToken }
    });
    assert.equal(refreshRes.status, 200);
    assert.equal(refreshRes.json.data.tenantId, 'acme');
    assert.equal(refreshRes.json.data.authMethod, 'OIDC');

    // 12. Direct ID token exchange endpoint
    const directIdToken = jwt.sign(
      {
        iss: idpBaseUrl,
        aud: 'acme-client-id',
        sub: 'idp-user-9002',
        email: 'john.smith@acme.com',
        email_verified: true,
        name: 'John Smith'
      },
      privateKey,
      { algorithm: 'RS256', keyid: 'test-rsa-key-1', expiresIn: '5m' }
    );
    const exchangeRes = await invokeApp(app, 'POST', '/api/v1/iam/oidc/token-exchange', {
      headers: { 'x-tenant-id': 'acme' },
      body: { provider: 'corp-sso', idToken: directIdToken }
    });
    assert.equal(exchangeRes.status, 200);
    assert.equal(exchangeRes.json.data.user.email, 'john.smith@acme.com');
    assert.equal(exchangeRes.json.data.tenantId, 'acme');

    // 13. Configurable strict multi-tenancy mode rejects missing tenant on tenant-required routes
    process.env.MULTI_TENANCY_MODE = 'strict';
    const strictMissingRes = await invokeApp(app, 'GET', '/api/v1/iam/oidc/providers');
    assert.equal(strictMissingRes.status, 400);
    const strictProvidedRes = await invokeApp(app, 'GET', '/api/v1/iam/oidc/providers', {
      headers: { 'x-tenant-id': 'acme' }
    });
    assert.equal(strictProvidedRes.status, 200);
  } finally {
    process.env.MULTI_TENANCY_MODE = 'optional';
    globalThis.fetch = originalFetch;
  }
});

test('Mock OIDC Provider + Multi-Tenant Email Isolation', async () => {
  process.env.MULTI_TENANCY_ENABLED = 'true';
  process.env.MULTI_TENANCY_MODE = 'optional';

  const tenantRepo = new InMemoryTenantRepo();
  await tenantRepo.save(Tenant.create({ slug: 'beta', name: 'Beta Inc' }, 'beta'));

  const userRepo = new InMemoryUserRepo();
  const oidcProviderRepo = new InMemoryOidcProviderRepo();
  const federatedIdentityRepo = new InMemoryFederatedRepo();
  const oidcAuthStateRepo = new InMemoryAuthStateRepo();

  await oidcProviderRepo.save(
    OidcProvider.create({
      tenantId: 'beta',
      slug: 'mock-sso',
      providerType: 'MOCK',
      displayName: 'Mock SSO',
      issuerUrl: 'https://mock-idp.local',
      clientId: 'mock-client',
      clientSecretEncrypted: CryptoService.encrypt('mock-secret'),
      redirectUri: 'http://localhost:4001/api/v1/iam/oidc/mock-sso/callback',
      roleMapping: { 'team-support': 'SUPPORT' }
    })
  );

  const { app } = createApp({
    tenantRepo,
    userRepo,
    oidcProviderRepo,
    federatedIdentityRepo,
    oidcAuthStateRepo
  });

  // Register same email in 'default' and 'beta' independently
  const r1 = await invokeApp(app, 'POST', '/api/v1/iam/register', {
    body: { email: 'shared@user.com', password: 'Password123!', name: 'Default User' }
  });
  const r2 = await invokeApp(app, 'POST', '/api/v1/iam/register', {
    headers: { 'x-tenant-id': 'beta' },
    body: { email: 'shared@user.com', password: 'Password123!', name: 'Beta User' }
  });
  assert.equal(r1.status, 201);
  assert.equal(r2.status, 201);

  // Mock OIDC login in 'beta' tenant
  const authRes = await invokeApp(app, 'GET', '/api/v1/iam/oidc/mock-sso/authorize', {
    headers: { 'x-tenant-id': 'beta' }
  });
  assert.equal(authRes.status, 200);

  const cbRes = await invokeApp(
    app,
    'GET',
    `/api/v1/iam/oidc/mock-sso/callback?code=${encodeURIComponent('mock_code:bob@beta.io:Bob Builder:team-support')}&state=${encodeURIComponent(authRes.json.data.state)}`
  );
  assert.equal(cbRes.status, 200);
  assert.equal(cbRes.json.data.tenantId, 'beta');
  assert.equal(cbRes.json.data.user.role, 'SUPPORT');
  assert.equal(cbRes.json.data.user.email, 'bob@beta.io');
});
