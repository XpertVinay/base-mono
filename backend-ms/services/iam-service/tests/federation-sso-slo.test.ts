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
import { InMemoryUserRepository } from '../src/infrastructure/persistence/in-memory-user.repository.js';

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
  async listSystemDefaults(onlyEnabled = false) {
    return Array.from(this.items.values()).filter(
      (p) => p.isSystemDefault && (!onlyEnabled || (p.isEnabled && p.approvalStatus === 'APPROVED'))
    );
  }
  async findSystemDefaultBySlug(slug: string) {
    return (
      Array.from(this.items.values()).find(
        (p) => p.isSystemDefault && p.slug === slug.toLowerCase()
      ) || null
    );
  }
  async listPendingApprovals() {
    return Array.from(this.items.values()).filter((p) => p.approvalStatus === 'PENDING');
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

async function invokeApp(
  app: Express,
  method: string,
  urlPath: string,
  options: { headers?: Record<string, string>; body?: any; formBody?: Record<string, string> } = {}
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

    let bodyStr: string | undefined;
    if (options.formBody !== undefined) {
      bodyStr = new URLSearchParams(options.formBody).toString();
      normalizedHeaders['content-type'] = 'application/x-www-form-urlencoded';
      normalizedHeaders['content-length'] = String(Buffer.byteLength(bodyStr));
    } else if (options.body !== undefined) {
      bodyStr = JSON.stringify(options.body);
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

test('System Default Inheritance, Tenant Onboarding, Platform Approval, Google & Microsoft Entra ID + Internal SSO & SLO', async () => {
  process.env.MULTI_TENANCY_ENABLED = 'true';
  process.env.MULTI_TENANCY_MODE = 'optional';

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, any>;
  jwk.kid = 'fed-key-1';
  jwk.use = 'sig';
  jwk.alg = 'RS256';

  const googleIssuer = 'https://accounts.google.com';
  const entraIssuer = 'https://login.microsoftonline.com/common/v2.0';
  const entraTenantGuid = '11111111-2222-3333-4444-555555555555';

  let lastGoogleNonce = '';
  let lastEntraNonce = '';
  let lastTokenClientId = '';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr === `${googleIssuer}/.well-known/openid-configuration`) {
      return new Response(
        JSON.stringify({
          issuer: googleIssuer,
          authorization_endpoint: `${googleIssuer}/o/oauth2/v2/auth`,
          token_endpoint: `${googleIssuer}/token`,
          userinfo_endpoint: `${googleIssuer}/userinfo`,
          jwks_uri: `${googleIssuer}/jwks.json`,
          end_session_endpoint: `${googleIssuer}/logout`
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr === `${googleIssuer}/jwks.json` || urlStr === 'https://login.microsoftonline.com/common/discovery/v2.0/keys') {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (urlStr === `${googleIssuer}/token`) {
      const form = new URLSearchParams(String(init?.body || ''));
      lastTokenClientId = form.get('client_id') || '';
      const idToken = jwt.sign(
        {
          iss: googleIssuer,
          aud: lastTokenClientId,
          sub: 'google-sub-101',
          email: 'alice@globex.com',
          email_verified: true,
          name: 'Alice Google',
          nonce: lastGoogleNonce
        },
        privateKey,
        { algorithm: 'RS256', keyid: 'fed-key-1', expiresIn: '5m' }
      );
      return new Response(
        JSON.stringify({ access_token: 'g-access', id_token: idToken, token_type: 'Bearer', expires_in: 300 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr === `${entraIssuer}/.well-known/openid-configuration`) {
      return new Response(
        JSON.stringify({
          issuer: 'https://login.microsoftonline.com/{tenantid}/v2.0',
          authorization_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          token_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
          jwks_uri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
          end_session_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr === 'https://login.microsoftonline.com/common/oauth2/v2.0/token') {
      const form = new URLSearchParams(String(init?.body || ''));
      const clientId = form.get('client_id') || '';
      const idToken = jwt.sign(
        {
          iss: `https://login.microsoftonline.com/${entraTenantGuid}/v2.0`,
          tid: entraTenantGuid,
          aud: clientId,
          sub: 'entra-sub-202',
          preferred_username: 'bob@globex.com',
          email_verified: true,
          name: 'Bob Microsoft',
          roles: ['USER'],
          nonce: lastEntraNonce
        },
        privateKey,
        { algorithm: 'RS256', keyid: 'fed-key-1', expiresIn: '5m' }
      );
      return new Response(
        JSON.stringify({ access_token: 'ms-access', id_token: idToken, token_type: 'Bearer', expires_in: 300 }),
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
    // 1. Platform Admin setup
    await invokeApp(app, 'POST', '/api/v1/iam/register', {
      body: { email: 'platform@system.io', password: 'Password123!', name: 'Platform Admin', role: 'ADMIN' }
    });
    const platLogin = await invokeApp(app, 'POST', '/api/v1/iam/login', {
      body: { email: 'platform@system.io', password: 'Password123!' }
    });
    const platformAdminToken = platLogin.json.data.accessToken;

    // 2. Configure System-Default Google & Microsoft Entra ID providers (for demo / default inheritance)
    const sysGoogle = await invokeApp(app, 'POST', '/api/v1/iam/oidc/admin/providers', {
      headers: { Authorization: `Bearer ${platformAdminToken}` },
      body: {
        slug: 'google',
        providerType: 'GOOGLE',
        displayName: 'Google (Platform Default)',
        issuerUrl: googleIssuer,
        clientId: 'system-google-client-id',
        clientSecret: 'system-google-secret',
        redirectUri: 'http://localhost:4000/api/v1/iam/oidc/google/callback',
        isSystemDefault: true
      }
    });
    assert.equal(sysGoogle.status, 201);
    assert.equal(sysGoogle.json.data.isSystemDefault, true);
    assert.equal(sysGoogle.json.data.approvalStatus, 'APPROVED');

    const sysEntra = await invokeApp(app, 'POST', '/api/v1/iam/oidc/admin/providers', {
      headers: { Authorization: `Bearer ${platformAdminToken}` },
      body: {
        slug: 'microsoft',
        providerType: 'ENTRA_ID',
        displayName: 'Microsoft Entra ID (Platform Default)',
        issuerUrl: entraIssuer,
        clientId: 'system-entra-client-id',
        clientSecret: 'system-entra-secret',
        redirectUri: 'http://localhost:4000/api/v1/iam/oidc/microsoft/callback',
        isSystemDefault: true
      }
    });
    assert.equal(sysEntra.status, 201);

    // 3. Onboard tenant 'globex' with initial Tenant Admin
    const onboardRes = await invokeApp(app, 'POST', '/api/v1/iam/tenants/onboard', {
      headers: { Authorization: `Bearer ${platformAdminToken}` },
      body: {
        id: 'globex',
        slug: 'globex',
        name: 'Globex Corp',
        adminUser: {
          email: 'admin@globex.com',
          password: 'Password123!',
          name: 'Globex Admin'
        }
      }
    });
    assert.equal(onboardRes.status, 201);
    assert.equal(onboardRes.json.data.inheritedProviders.length, 2);

    // 4. Tenant 'globex' inherits system defaults right away
    const globexProviders = await invokeApp(app, 'GET', '/api/v1/iam/oidc/providers', {
      headers: { 'x-tenant-id': 'globex' }
    });
    assert.equal(globexProviders.status, 200);
    assert.equal(globexProviders.json.data.length, 2);
    assert.equal(globexProviders.json.data[0].configSource, 'SYSTEM_DEFAULT');

    // 5. Tenant Admin submits an override for Google with Globex's own credentials -> starts PENDING
    const tenantLogin = await invokeApp(app, 'POST', '/api/v1/iam/login', {
      headers: { 'x-tenant-id': 'globex' },
      body: { email: 'admin@globex.com', password: 'Password123!' }
    });
    const globexAdminToken = tenantLogin.json.data.accessToken;

    // Cross-tenant admin isolation check: globex admin cannot configure provider for 'default'
    const crossTenantAttempt = await invokeApp(app, 'POST', '/api/v1/iam/oidc/admin/providers', {
      headers: { Authorization: `Bearer ${globexAdminToken}` },
      body: {
        tenantId: 'default',
        slug: 'evil',
        providerType: 'MOCK',
        displayName: 'Evil',
        issuerUrl: 'https://evil.test',
        clientId: 'c',
        redirectUri: 'http://localhost:4000/cb'
      }
    });
    assert.equal(crossTenantAttempt.status, 403);

    const assocRes = await invokeApp(app, 'POST', '/api/v1/iam/oidc/admin/providers/associate', {
      headers: { Authorization: `Bearer ${globexAdminToken}` },
      body: {
        systemProvider: 'google',
        clientId: 'globex-own-google-client-id',
        clientSecret: 'globex-own-google-secret',
        allowedDomains: ['globex.com'],
        inheritsSystemConfig: true
      }
    });
    assert.equal(assocRes.status, 201);
    assert.equal(assocRes.json.data.approvalStatus, 'PENDING');
    const overrideProviderId = assocRes.json.data.id;

    // Tenant admin CANNOT self-approve
    const selfApprove = await invokeApp(
      app,
      'POST',
      `/api/v1/iam/oidc/admin/providers/${overrideProviderId}/approve`,
      { headers: { Authorization: `Bearer ${globexAdminToken}` } }
    );
    assert.equal(selfApprove.status, 403);

    // While PENDING, login falls back to approved SYSTEM default credentials
    const authPending = await invokeApp(app, 'GET', '/api/v1/iam/oidc/google/authorize?tenantId=globex');
    assert.equal(authPending.status, 200);
    const pendingAuthUrl = new URL(authPending.json.data.authorizationUrl);
    assert.equal(pendingAuthUrl.searchParams.get('client_id'), 'system-google-client-id');
    assert.equal(pendingAuthUrl.searchParams.get('access_type'), 'offline');

    // 6. Platform Admin reviews pending overrides and approves Globex's override
    const pendingList = await invokeApp(app, 'GET', '/api/v1/iam/oidc/admin/providers/pending', {
      headers: { Authorization: `Bearer ${platformAdminToken}` }
    });
    assert.equal(pendingList.status, 200);
    assert.equal(pendingList.json.data.length, 1);
    assert.equal(pendingList.json.data[0].id, overrideProviderId);

    const approveRes = await invokeApp(
      app,
      'POST',
      `/api/v1/iam/oidc/admin/providers/${overrideProviderId}/approve`,
      { headers: { Authorization: `Bearer ${platformAdminToken}` } }
    );
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.json.data.approvalStatus, 'APPROVED');

    // 7. Now Google login for Globex uses Globex's approved override credentials!
    const authGoogle = await invokeApp(app, 'GET', '/api/v1/iam/oidc/google/authorize?tenantId=globex');
    assert.equal(authGoogle.status, 200);
    const googleUrl = new URL(authGoogle.json.data.authorizationUrl);
    assert.equal(googleUrl.searchParams.get('client_id'), 'globex-own-google-client-id');
    assert.equal(googleUrl.searchParams.get('hd'), 'globex.com');
    lastGoogleNonce = googleUrl.searchParams.get('nonce') || '';
    const googleState = googleUrl.searchParams.get('state') || '';

    const googleCb = await invokeApp(
      app,
      'GET',
      `/api/v1/iam/oidc/google/callback?code=g-code-1&state=${encodeURIComponent(googleState)}`
    );
    assert.equal(googleCb.status, 200);
    assert.equal(lastTokenClientId, 'globex-own-google-client-id');
    assert.equal(googleCb.json.data.user.email, 'alice@globex.com');
    assert.ok(googleCb.json.data.sessionId);

    const aliceToken = googleCb.json.data.accessToken;

    // 8. Microsoft Entra ID login using form_post (x-www-form-urlencoded) + preferred_username fallback + dynamic tid issuer
    const authEntra = await invokeApp(app, 'GET', '/api/v1/iam/oidc/microsoft/authorize?tenantId=globex');
    assert.equal(authEntra.status, 200);
    const entraUrl = new URL(authEntra.json.data.authorizationUrl);
    assert.equal(entraUrl.searchParams.get('response_mode'), 'query');
    lastEntraNonce = entraUrl.searchParams.get('nonce') || '';
    const entraState = entraUrl.searchParams.get('state') || '';

    const entraCb = await invokeApp(app, 'POST', '/api/v1/iam/oidc/microsoft/callback', {
      formBody: { code: 'ms-code-1', state: entraState }
    });
    assert.equal(entraCb.status, 200);
    assert.equal(entraCb.json.data.user.email, 'bob@globex.com');
    assert.equal(entraCb.json.data.provider, 'microsoft');

    // 9. Internal SSO Flow: share auth securely with downstream Service Provider via PKCE handoff code
    const spVerifier = crypto.randomBytes(32).toString('base64url');
    const spChallenge = crypto.createHash('sha256').update(spVerifier).digest('base64url');

    const handoffRes = await invokeApp(app, 'POST', '/api/v1/iam/sso/handoff', {
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: {
        targetService: 'order-service',
        scope: 'orders:read orders:write',
        codeChallenge: spChallenge,
        redirectUri: 'https://orders.globex.app/sso/cb'
      }
    });
    assert.equal(handoffRes.status, 201);
    const ssoCode = handoffRes.json.data.code;
    assert.ok(ssoCode.startsWith('sso_'));

    // Wrong audience must fail
    const wrongAudRedeem = await invokeApp(app, 'POST', '/api/v1/iam/sso/redeem', {
      headers: { 'x-tenant-id': 'globex' },
      body: { code: ssoCode, targetService: 'inventory-service', codeVerifier: spVerifier }
    });
    assert.equal(wrongAudRedeem.status, 401);

    // Valid redeem (wait: previous consume consumed code? Let's verify single-use or re-issue!)
    const handoffRes2 = await invokeApp(app, 'POST', '/api/v1/iam/sso/handoff', {
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: { targetService: 'order-service', scope: 'orders:read', codeChallenge: spChallenge }
    });
    const ssoCode2 = handoffRes2.json.data.code;

    const validRedeem = await invokeApp(app, 'POST', '/api/v1/iam/sso/redeem', {
      headers: { 'x-tenant-id': 'globex' },
      body: { code: ssoCode2, targetService: 'order-service', codeVerifier: spVerifier }
    });
    assert.equal(validRedeem.status, 200);
    assert.equal(validRedeem.json.data.audience, 'order-service');
    assert.equal(validRedeem.json.data.tenantId, 'globex');
    const orderSpToken = validRedeem.json.data.accessToken;

    // Replay of consumed SSO code must fail
    const replayRedeem = await invokeApp(app, 'POST', '/api/v1/iam/sso/redeem', {
      headers: { 'x-tenant-id': 'globex' },
      body: { code: ssoCode2, targetService: 'order-service', codeVerifier: spVerifier }
    });
    assert.equal(replayRedeem.status, 401);

    // Introspect enforces audience & tenant isolation
    const introspectWrongAud = await invokeApp(app, 'POST', '/api/v1/iam/sso/introspect', {
      body: { token: orderSpToken, expectedTenantId: 'globex', expectedAudience: 'billing-service' }
    });
    assert.equal(introspectWrongAud.json.data.active, false);
    assert.equal(introspectWrongAud.json.data.reason, 'AUDIENCE_MISMATCH');

    const introspectOk = await invokeApp(app, 'POST', '/api/v1/iam/sso/introspect', {
      body: { token: orderSpToken, expectedTenantId: 'globex', expectedAudience: 'order-service' }
    });
    assert.equal(introspectOk.json.data.active, true);
    assert.equal(introspectOk.json.data.sub, googleCb.json.data.user.id);

    // 10. Refresh token rotation + reuse detection
    const refresh1 = await invokeApp(app, 'POST', '/api/v1/iam/refresh', {
      headers: { 'x-tenant-id': 'globex' },
      body: { refreshToken: googleCb.json.data.refreshToken }
    });
    assert.equal(refresh1.status, 200);

    // Reusing the OLD refresh token revokes the entire session
    const refreshReplay = await invokeApp(app, 'POST', '/api/v1/iam/refresh', {
      headers: { 'x-tenant-id': 'globex' },
      body: { refreshToken: googleCb.json.data.refreshToken }
    });
    assert.equal(refreshReplay.status, 401);

    // Alice's access token is now immediately revoked!
    const profileAfterReuse = await invokeApp(app, 'GET', '/api/v1/iam/profile', {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(profileAfterReuse.status, 401);

    // 11. Secure SLO on Bob's Entra ID session (returns upstream IdP logout URL + revokes session)
    const bobToken = entraCb.json.data.accessToken;
    const sloRes = await invokeApp(app, 'POST', '/api/v1/iam/sso/logout', {
      headers: { Authorization: `Bearer ${bobToken}` },
      body: { postLogoutRedirectUri: 'https://app.globex.com/logged-out' }
    });
    assert.equal(sloRes.status, 200);
    assert.equal(sloRes.json.data.loggedOut, true);
    assert.equal(sloRes.json.data.revokedSessions, 1);
    assert.ok(sloRes.json.data.idpLogoutUrl.includes('login.microsoftonline.com/common/oauth2/v2.0/logout'));
    assert.ok(sloRes.json.data.idpLogoutUrl.includes('id_token_hint='));

    // Bob's token is rejected immediately after SLO
    const bobProfileAfterSlo = await invokeApp(app, 'GET', '/api/v1/iam/profile', {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobProfileAfterSlo.status, 401);
  } finally {
    process.env.MULTI_TENANCY_MODE = 'optional';
    globalThis.fetch = originalFetch;
  }
});

test('OAuth 2.0 (without id_token), SAML 2.0 (XML Signature), and OIDC Back-Channel Logout', async () => {
  process.env.MULTI_TENANCY_ENABLED = 'true';
  process.env.MULTI_TENANCY_MODE = 'optional';

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const certPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, any>;
  jwk.kid = 'bcl-key-1';
  jwk.use = 'sig';
  jwk.alg = 'RS256';

  const oauthBase = 'https://oauth.example.test';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr === `${oauthBase}/token`) {
      return new Response('access_token=oauth2-tok-xyz&token_type=bearer&scope=read:user', {
        status: 200,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    }
    if (urlStr === `${oauthBase}/userinfo`) {
      assert.equal((init?.headers as any)?.Authorization, 'Bearer oauth2-tok-xyz');
      return new Response(
        JSON.stringify({ id: 'gh-42', email: 'dev@acme.io', name: 'OAuth Dev', email_verified: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr === 'https://oidc-bcl.test/jwks.json') {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(input as any, init);
  }) as typeof fetch;

  const tenantRepo = new InMemoryTenantRepo();
  const userRepo = new InMemoryUserRepo();
  const oidcProviderRepo = new InMemoryOidcProviderRepo();
  const federatedIdentityRepo = new InMemoryFederatedRepo();
  const oidcAuthStateRepo = new InMemoryAuthStateRepo();

  await oidcProviderRepo.save(
    OidcProvider.create({
      tenantId: 'default',
      slug: 'github-oauth2',
      providerType: 'GENERIC_OAUTH2',
      displayName: 'GitHub OAuth2',
      issuerUrl: oauthBase,
      authorizationEndpoint: `${oauthBase}/authorize`,
      tokenEndpoint: `${oauthBase}/token`,
      userinfoEndpoint: `${oauthBase}/userinfo`,
      clientId: 'oauth2-client',
      clientSecretEncrypted: 'oauth2-secret',
      redirectUri: 'http://localhost:4000/api/v1/iam/oidc/github-oauth2/callback'
    })
  );

  await oidcProviderRepo.save(
    OidcProvider.create({
      tenantId: 'default',
      slug: 'okta-saml',
      providerType: 'SAML',
      displayName: 'Okta SAML 2.0',
      issuerUrl: 'https://idp.saml.test',
      clientId: 'urn:platform:sp',
      redirectUri: 'http://localhost:4000/api/v1/iam/oidc/okta-saml/callback',
      samlConfig: {
        idpEntityId: 'https://idp.saml.test',
        idpSsoUrl: 'https://idp.saml.test/sso',
        idpSloUrl: 'https://idp.saml.test/slo',
        spEntityId: 'urn:platform:sp',
        idpCertificatePem: certPem
      }
    })
  );

  const bclProvider = OidcProvider.create({
    tenantId: 'default',
    slug: 'bcl-oidc',
    providerType: 'MOCK',
    displayName: 'Backchannel OIDC',
    issuerUrl: 'https://oidc-bcl.test',
    jwksUri: 'https://oidc-bcl.test/jwks.json',
    clientId: 'bcl-client',
    redirectUri: 'http://localhost:4000/api/v1/iam/oidc/bcl-oidc/callback'
  });
  await oidcProviderRepo.save(bclProvider);

  const { app } = createApp({
    tenantRepo,
    userRepo,
    oidcProviderRepo,
    federatedIdentityRepo,
    oidcAuthStateRepo
  });

  try {
    // 1. OAuth 2.0 flow without id_token
    const oauthInit = await invokeApp(app, 'GET', '/api/v1/iam/oidc/github-oauth2/authorize');
    assert.equal(oauthInit.status, 200);
    const oauthState = oauthInit.json.data.state;
    const oauthCb = await invokeApp(
      app,
      'GET',
      `/api/v1/iam/oidc/github-oauth2/callback?code=gh-code-1&state=${encodeURIComponent(oauthState)}`
    );
    assert.equal(oauthCb.status, 200);
    assert.equal(oauthCb.json.data.user.email, 'dev@acme.io');

    // 2. SAML 2.0 flow with RSA-SHA256 XML Signature verification
    const samlInit = await invokeApp(app, 'GET', '/api/v1/iam/oidc/okta-saml/authorize');
    assert.equal(samlInit.status, 200);
    const samlAuthUrl = new URL(samlInit.json.data.authorizationUrl);
    assert.ok(samlAuthUrl.searchParams.get('SAMLRequest'));
    const relayState = samlAuthUrl.searchParams.get('RelayState') || '';

    const signedInfoXml =
      '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/></ds:SignedInfo>';
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signedInfoXml, 'utf8');
    const sigB64 = signer.sign(privateKey, 'base64');

    const now = new Date();
    const later = new Date(Date.now() + 5 * 60 * 1000);
    const samlXml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_resp1" Version="2.0" InResponseTo="_${relayState}"><saml:Issuer>https://idp.saml.test</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfoXml}<ds:SignatureValue>${sigB64}</ds:SignatureValue></ds:Signature><saml:Assertion><saml:Subject><saml:NameID>saml.user@acme.io</saml:NameID></saml:Subject><saml:Conditions NotBefore="${now.toISOString()}" NotOnOrAfter="${later.toISOString()}"><saml:AudienceRestriction><saml:Audience>urn:platform:sp</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AttributeStatement><saml:Attribute Name="name"><saml:AttributeValue>SAML Enterprise User</saml:AttributeValue></saml:Attribute><saml:Attribute Name="role"><saml:AttributeValue>ADMIN</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion></samlp:Response>`;

    const samlCb = await invokeApp(app, 'POST', '/api/v1/iam/oidc/okta-saml/callback', {
      formBody: {
        SAMLResponse: Buffer.from(samlXml, 'utf8').toString('base64'),
        RelayState: relayState
      }
    });
    assert.equal(samlCb.status, 200);
    assert.equal(samlCb.json.data.user.email, 'saml.user@acme.io');
    assert.equal(samlCb.json.data.user.role, 'ADMIN');

    // 3. OIDC Back-Channel Logout revokes session
    const bclIdToken = jwt.sign(
      {
        iss: 'https://oidc-bcl.test',
        aud: 'bcl-client',
        sub: 'bcl-user-77',
        email: 'bcl@acme.io',
        email_verified: true,
        name: 'BCL User'
      },
      privateKey,
      { algorithm: 'RS256', keyid: 'bcl-key-1', expiresIn: '5m' }
    );
    const bclLogin = await invokeApp(app, 'POST', '/api/v1/iam/oidc/token-exchange', {
      body: { provider: 'bcl-oidc', idToken: bclIdToken }
    });
    assert.equal(bclLogin.status, 200);
    const bclAccessToken = bclLogin.json.data.accessToken;

    const logoutToken = jwt.sign(
      {
        iss: 'https://oidc-bcl.test',
        aud: 'bcl-client',
        sub: 'bcl-user-77',
        jti: 'bcl-jti-1',
        events: { 'http://schemas.openid.net/event/backchannel-logout': {} }
      },
      privateKey,
      { algorithm: 'RS256', keyid: 'bcl-key-1', expiresIn: '2m' }
    );

    const bclRes = await invokeApp(app, 'POST', '/api/v1/iam/oidc/bcl-oidc/backchannel-logout', {
      formBody: { logout_token: logoutToken }
    });
    assert.equal(bclRes.status, 200);
    assert.equal(bclRes.json.data.revokedSessions, 1);

    const bclProfileAfter = await invokeApp(app, 'GET', '/api/v1/iam/profile', {
      headers: { Authorization: `Bearer ${bclAccessToken}` }
    });
    assert.equal(bclProfileAfter.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

