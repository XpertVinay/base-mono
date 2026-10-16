import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import jwt from 'jsonwebtoken';
import { securityConfig } from '../../config/security.js';

describe('Security & OWASP Controls Enforcement', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  it('OWASP Headers: Response includes secure HTTP headers', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('Deny-by-Default: Protected endpoints reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/orders/my');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('RBAC Authorization: Non-admin users are denied access to admin-only operations with 403', async () => {
    // Generate valid JWT for regular user
    const userToken = jwt.sign(
      { id: 'user-123', email: 'test@monolith.local', role: 'USER' },
      securityConfig.jwt.secret
    );

    const res = await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ key: 'MALICIOUS_OVERRIDE', value: 'danger' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Input Validation: Malformed payloads return 400 Bad Request with field validation errors', async () => {
    const res = await request(app)
      .post('/api/iam/register')
      .send({
        email: 'not-an-email',
        password: 'short', // less than 8 chars
        name: ''
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('Safe Error Handling: Never leaks stack traces to HTTP clients', async () => {
    const res = await request(app).get('/api/unknown-endpoint-404');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error.details).toBeUndefined();
  });
});
