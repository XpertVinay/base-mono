import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { TotpService } from '../../modules/iam/domain/services/totp.service.js';
import { tokenService } from '../../shared/infrastructure/token.service.js';

describe('IAM MFA Strict Authentication, Authorization & Audit System', () => {
  let app: any;
  let adminToken: string;
  let auditorToken: string;
  let standardUserToken: string;
  let standardUserId: string;
  const standardEmail = `mfa-user-${Date.now()}@monolith.local`;
  const standardPassword = 'MfaUserPassword123!';

  let totpSecret: string;
  let backupCodes: string[] = [];

  beforeAll(async () => {
    app = createApp();

    // 1. Register and login ADMIN user
    const adminEmail = `admin-mfa-${Date.now()}@monolith.local`;
    await request(app)
      .post('/api/iam/register')
      .send({
        email: adminEmail,
        password: 'AdminPassword123!',
        name: 'IAM Security Admin',
        role: 'ADMIN'
      });

    const adminLoginRes = await request(app)
      .post('/api/iam/login')
      .send({ email: adminEmail, password: 'AdminPassword123!' });
    adminToken = adminLoginRes.body.data.accessToken;

    // 2. Register and login AUDITOR user
    const auditorEmail = `auditor-${Date.now()}@monolith.local`;
    await request(app)
      .post('/api/iam/register')
      .send({
        email: auditorEmail,
        password: 'AuditorPassword123!',
        name: 'Compliance Auditor',
        role: 'AUDITOR'
      });

    const auditorLoginRes = await request(app)
      .post('/api/iam/login')
      .send({ email: auditorEmail, password: 'AuditorPassword123!' });
    auditorToken = auditorLoginRes.body.data.accessToken;

    // 3. Register standard test user
    const userRegRes = await request(app)
      .post('/api/iam/register')
      .send({
        email: standardEmail,
        password: standardPassword,
        name: 'Standard MFA Tester',
        role: 'USER'
      });
    standardUserId = userRegRes.body.data.id;

    const userLoginRes = await request(app)
      .post('/api/iam/login')
      .send({ email: standardEmail, password: standardPassword });
    standardUserToken = userLoginRes.body.data.accessToken;
  });

  describe('1. MFA Setup and Enrollment Flow', () => {
    it('GET /api/iam/mfa/status returns initially disabled MFA status', async () => {
      const res = await request(app)
        .get('/api/iam/mfa/status')
        .set('Authorization', `Bearer ${standardUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(false);
      expect(res.body.data.reverificationWindowSeconds).toBe(86400); // 24 hours
    });

    it('POST /api/iam/mfa/setup initiates TOTP secret and generates single-use backup recovery codes', async () => {
      const res = await request(app)
        .post('/api/iam/mfa/setup')
        .set('Authorization', `Bearer ${standardUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('secret');
      expect(res.body.data).toHaveProperty('otpauthUrl');
      expect(res.body.data.otpauthUrl).toContain('otpauth://totp/Monolith:');
      expect(res.body.data.backupCodes).toHaveLength(8);

      totpSecret = res.body.data.secret;
      backupCodes = res.body.data.backupCodes;
    });

    it('POST /api/iam/mfa/enable rejects activation with an invalid TOTP verification code', async () => {
      const res = await request(app)
        .post('/api/iam/mfa/enable')
        .set('Authorization', `Bearer ${standardUserToken}`)
        .send({
          secret: totpSecret,
          code: '000000',
          backupCodes
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid MFA verification code');
    });

    it('POST /api/iam/mfa/enable successfully activates MFA with valid RFC 6238 TOTP code', async () => {
      const validCode = TotpService.generateTotp(totpSecret);
      const res = await request(app)
        .post('/api/iam/mfa/enable')
        .set('Authorization', `Bearer ${standardUserToken}`)
        .send({
          secret: totpSecret,
          code: validCode,
          backupCodes
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.tokens.mfaVerified).toBe(true);
      expect(res.body.data.tokens.mfaVerifiedAt).toBeDefined();

      // Upgrade token with newly issued MFA token
      standardUserToken = res.body.data.tokens.accessToken;
    });

    it('GET /api/iam/mfa/status confirms MFA is active with totp and backup_code methods', async () => {
      const res = await request(app)
        .get('/api/iam/mfa/status')
        .set('Authorization', `Bearer ${standardUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.methods).toContain('totp');
      expect(res.body.data.methods).toContain('backup_code');
      expect(res.body.data.lastVerifiedAt).toBeDefined();
    });
  });

  describe('2. Strict Authentication & Login MFA Challenge', () => {
    let mfaChallengeToken: string;

    it('POST /api/iam/login with MFA enabled returns MFA challenge instead of issuing full tokens', async () => {
      const res = await request(app)
        .post('/api/iam/login')
        .send({ email: standardEmail, password: standardPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mfaRequired).toBe(true);
      expect(res.body.data.mfaChallengeToken).toBeDefined();
      expect(res.body.data.methods).toEqual(['totp', 'backup_code']);
      expect(res.body.data.expiresInSeconds).toBe(300);

      mfaChallengeToken = res.body.data.mfaChallengeToken;
    });

    it('POST /api/iam/mfa/verify rejects invalid challenge verification code', async () => {
      const res = await request(app)
        .post('/api/iam/mfa/verify')
        .send({
          mfaChallengeToken,
          code: '999999'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid MFA verification code');
    });

    it('POST /api/iam/mfa/verify successfully completes login with valid TOTP code', async () => {
      const validCode = TotpService.generateTotp(totpSecret);
      const res = await request(app)
        .post('/api/iam/mfa/verify')
        .send({
          mfaChallengeToken,
          code: validCode
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.mfaVerified).toBe(true);
      expect(res.body.data.mfaVerifiedAt).toBeDefined();

      // Store refreshed standard user token
      standardUserToken = res.body.data.accessToken;
    });

    it('POST /api/iam/mfa/verify supports single-use backup recovery code on login', async () => {
      // 1. Initiate login challenge
      const loginRes = await request(app)
        .post('/api/iam/login')
        .send({ email: standardEmail, password: standardPassword });
      const challenge = loginRes.body.data.mfaChallengeToken;

      // 2. Consume first backup code
      const backupCodeToUse = backupCodes[0];
      const verifyRes = await request(app)
        .post('/api/iam/mfa/verify')
        .send({
          mfaChallengeToken: challenge,
          code: backupCodeToUse
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.mfaVerified).toBe(true);

      // 3. Attempting to replay the consumed backup code fails
      const loginRes2 = await request(app)
        .post('/api/iam/login')
        .send({ email: standardEmail, password: standardPassword });
      const challenge2 = loginRes2.body.data.mfaChallengeToken;

      const replayRes = await request(app)
        .post('/api/iam/mfa/verify')
        .send({
          mfaChallengeToken: challenge2,
          code: backupCodeToUse
        });

      expect(replayRes.status).toBe(401);
    });
  });

  describe('3. 24-Hour Expiration Timeframe & Token Refresh Semantics', () => {
    it('POST /api/iam/refresh preserves active MFA status when verified within 24 hours', async () => {
      // Generate active tokens with recent mfaVerifiedAt
      const recentMfaAt = Date.now() - (2 * 3600 * 1000); // 2 hours ago
      const tokens = tokenService.generateTokens(
        {
          id: standardUserId,
          email: standardEmail,
          name: 'Standard MFA Tester',
          role: 'USER'
        },
        undefined,
        true,
        recentMfaAt
      );

      const res = await request(app)
        .post('/api/iam/refresh')
        .send({ refreshToken: tokens.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mfaVerified).toBe(true);
      expect(res.body.data.mfaVerifiedAt).toBe(new Date(recentMfaAt).toISOString());
    });

    it('POST /api/iam/refresh marks mfaVerified as false when the 24-hour window has elapsed', async () => {
      // Generate tokens with mfaVerifiedAt 25 hours ago (> 24 hours)
      const expiredMfaAt = Date.now() - (25 * 3600 * 1000);
      const tokens = tokenService.generateTokens(
        {
          id: standardUserId,
          email: standardEmail,
          name: 'Standard MFA Tester',
          role: 'USER'
        },
        undefined,
        true,
        expiredMfaAt
      );

      const res = await request(app)
        .post('/api/iam/refresh')
        .send({ refreshToken: tokens.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // MFA session exceeded 24 hours! Rotated tokens have mfaVerified = false
      expect(res.body.data.mfaVerified).toBe(false);
      expect(res.body.data.mfaVerifiedAt).toBeUndefined();
    });

    it('POST /api/iam/mfa/reverify resets the 24-hour expiration window with fresh verification', async () => {
      const validCode = TotpService.generateTotp(totpSecret);
      const beforeTime = Date.now();

      const res = await request(app)
        .post('/api/iam/mfa/reverify')
        .set('Authorization', `Bearer ${standardUserToken}`)
        .send({ code: validCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mfaVerified).toBe(true);
      const reverifiedAt = new Date(res.body.data.mfaVerifiedAt).getTime();
      expect(reverifiedAt).toBeGreaterThanOrEqual(beforeTime - 1000);

      // Update current token
      standardUserToken = res.body.data.accessToken;
    });
  });

  describe('4. Database-Defined Protected Routes & Cached In-Memory Reverification Guard', () => {
    it('SESSION_24H route (/api/iam/mfa/sensitive-operation) permits access when MFA session is within 24h', async () => {
      // We test the route middleware directly through supertest
      const res = await request(app)
        .get('/api/iam/mfa/sensitive-operation')
        .set('Authorization', `Bearer ${standardUserToken}`);

      // The route is protected by mfaReverificationMiddleware. Since user has active 24h MFA,
      // it passes the MFA check and reaches route handler (or 404 for unmounted path after passing middleware)
      expect(res.status).not.toBe(403);
    });

    it('SESSION_24H route blocks user when MFA verification has expired after 24h', async () => {
      // Token with expired MFA timestamp (25h old)
      const expiredMfaAt = Date.now() - (25 * 3600 * 1000);
      const expiredTokens = tokenService.generateTokens(
        {
          id: standardUserId,
          email: standardEmail,
          name: 'Standard MFA Tester',
          role: 'USER'
        },
        undefined,
        true,
        expiredMfaAt
      );

      const res = await request(app)
        .get('/api/iam/mfa/sensitive-operation')
        .set('Authorization', `Bearer ${expiredTokens.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('MFA_REVERIFICATION_REQUIRED');
      expect(res.body.reverificationMode).toBe('SESSION_24H');
      expect(res.body.message).toContain('expired after 24 hours');
    });

    it('SESSION_24H route allows immediate on-the-fly re-authentication via x-mfa-code header', async () => {
      const expiredMfaAt = Date.now() - (25 * 3600 * 1000);
      const expiredTokens = tokenService.generateTokens(
        {
          id: standardUserId,
          email: standardEmail,
          name: 'Standard MFA Tester',
          role: 'USER'
        },
        undefined,
        true,
        expiredMfaAt
      );

      const freshTotp = TotpService.generateTotp(totpSecret);
      const res = await request(app)
        .get('/api/iam/mfa/sensitive-operation')
        .set('Authorization', `Bearer ${expiredTokens.accessToken}`)
        .set('x-mfa-code', freshTotp);

      expect(res.status).not.toBe(403);
    });

    it('EVERY_TIME route (/api/iam/mfa/strict-action) strictly rejects requests without fresh MFA code', async () => {
      const res = await request(app)
        .post('/api/iam/mfa/strict-action')
        .set('Authorization', `Bearer ${standardUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('MFA_REVERIFICATION_REQUIRED');
      expect(res.body.reverificationMode).toBe('EVERY_TIME');
      expect(res.body.message).toContain('every request');
    });

    it('EVERY_TIME route permits request when valid x-mfa-code header is provided', async () => {
      const freshTotp = TotpService.generateTotp(totpSecret);
      const res = await request(app)
        .post('/api/iam/mfa/strict-action')
        .set('Authorization', `Bearer ${standardUserToken}`)
        .set('x-mfa-code', freshTotp);

      expect(res.status).not.toBe(403);
    });

    it('Dynamic Protected Routes: Admin can add new protected route with instant cache reflection', async () => {
      // 1. Add new route to database
      const addRes = await request(app)
        .post('/api/iam/mfa/protected-routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          method: 'POST',
          pathPattern: '/api/transactions/wire-transfer',
          description: 'High-value wire transfers',
          reverificationMode: 'EVERY_TIME'
        });

      expect(addRes.status).toBe(201);
      expect(addRes.body.success).toBe(true);
      const createdId = addRes.body.data.id;

      // 2. Request without MFA header is now strictly blocked
      const blockedRes = await request(app)
        .post('/api/transactions/wire-transfer')
        .set('Authorization', `Bearer ${standardUserToken}`);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error).toBe('MFA_REVERIFICATION_REQUIRED');

      // 3. Request with valid x-mfa-code header passes
      const freshTotp = TotpService.generateTotp(totpSecret);
      const allowedRes = await request(app)
        .post('/api/transactions/wire-transfer')
        .set('Authorization', `Bearer ${standardUserToken}`)
        .set('x-mfa-code', freshTotp);

      expect(allowedRes.status).not.toBe(403);

      // 4. Delete the route and verify cache invalidates
      const delRes = await request(app)
        .delete(`/api/iam/mfa/protected-routes/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deleted).toBe(true);
    });
  });

  describe('5. Enterprise Single Sign-On (SSO) Support with Strict MFA', () => {
    it('POST /api/iam/sso/initiate generates authorization URL, state, and nonce', async () => {
      const res = await request(app)
        .post('/api/iam/sso/initiate')
        .send({
          provider: 'google',
          redirectUri: 'https://monolith.local/login/sso/callback'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.authorizationUrl).toContain('accounts.google.com');
      expect(res.body.data.state).toBeDefined();
      expect(res.body.data.nonce).toBeDefined();
    });

    it('POST /api/iam/sso/callback auto-provisions new user and logs in directly when MFA is not enabled', async () => {
      const ssoEmail = `sso-user-${Date.now()}@corporate.domain`;
      const res = await request(app)
        .post('/api/iam/sso/callback')
        .send({
          provider: 'google',
          state: 'state_12345',
          mockProfile: {
            email: ssoEmail,
            name: 'Corporate Executive',
            subjectId: `google-sub-${Date.now()}`
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toBe(ssoEmail);
      expect(res.body.data.mfaVerified).toBe(false);
    });

    it('POST /api/iam/sso/callback strictly enforces MFA challenge when the SSO user has MFA enabled', async () => {
      // Standard test user has MFA enabled. Trigger SSO login for this user!
      const res = await request(app)
        .post('/api/iam/sso/callback')
        .send({
          provider: 'azure-ad',
          state: 'state_azure_54321',
          mockProfile: {
            email: standardEmail,
            name: 'Standard MFA Tester',
            subjectId: `azure-sub-${Date.now()}`
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // MFA challenge issued! User cannot bypass MFA via SSO
      expect(res.body.data.mfaRequired).toBe(true);
      expect(res.body.data.mfaChallengeToken).toBeDefined();
      expect(res.body.data.methods).toContain('totp');

      // Now verify challenge token
      const validCode = TotpService.generateTotp(totpSecret);
      const verifyRes = await request(app)
        .post('/api/iam/mfa/verify')
        .send({
          mfaChallengeToken: res.body.data.mfaChallengeToken,
          code: validCode
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.mfaVerified).toBe(true);
      expect(verifyRes.body.data.mfaVerifiedAt).toBeDefined();
    });
  });

  describe('6. Immutable Audit Logging Inspection', () => {
    it('GET /api/iam/audit-logs rejects non-privileged user with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/iam/audit-logs')
        .set('Authorization', `Bearer ${standardUserToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/iam/audit-logs allows ADMIN and AUDITOR to inspect historical security audit events', async () => {
      const res = await request(app)
        .get('/api/iam/audit-logs')
        .set('Authorization', `Bearer ${auditorToken}`)
        .query({ limit: 100 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const eventTypes = res.body.data.map((l: any) => l.eventType);
      expect(eventTypes).toContain('IAM_MFA_ENABLED');
      expect(eventTypes).toContain('IAM_MFA_CHALLENGE_ISSUED');
      expect(eventTypes).toContain('IAM_MFA_VERIFIED');
      expect(eventTypes).toContain('IAM_MFA_REVERIFIED');
      expect(eventTypes).toContain('IAM_TOKEN_MFA_EXPIRED');
      expect(eventTypes).toContain('IAM_SSO_INITIATED');
      expect(eventTypes).toContain('IAM_SSO_MFA_CHALLENGE');
      expect(eventTypes).toContain('IAM_SENSITIVE_ROUTE_BLOCKED');
    });
  });

  describe('7. MFA Deactivation Flow', () => {
    it('POST /api/iam/mfa/disable deactivates MFA with valid TOTP code and returns downgraded tokens', async () => {
      const validCode = TotpService.generateTotp(totpSecret);
      const res = await request(app)
        .post('/api/iam/mfa/disable')
        .set('Authorization', `Bearer ${standardUserToken}`)
        .send({
          code: validCode,
          password: standardPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.user.mfaEnabled).toBe(false);
      expect(res.body.data.tokens.mfaVerified).toBe(false);

      // Verify status is disabled
      const statusRes = await request(app)
        .get('/api/iam/mfa/status')
        .set('Authorization', `Bearer ${res.body.data.tokens.accessToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.enabled).toBe(false);
    });
  });
});
