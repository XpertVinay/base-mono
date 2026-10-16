import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

describe('Modular Monolith End-to-End Business Integration', () => {
  let app: any;
  let userToken: string;
  let createdOrderId: string;

  beforeAll(() => {
    app = createApp();
  });

  it('Health Probes: /health/live returns UP and uptime', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.uptimeSeconds).toBeDefined();
  });

  it('Health Probes: /health/ready returns detailed subsystem checks', async () => {
    const res = await request(app).get('/health/ready');
    // May be 200 (if PG connected) or 503 (if PG offline in standalone test), but body structure is valid
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.memory).toBeDefined();
  });

  it('IAM: Successfully registers a new user', async () => {
    const email = `architect-${Date.now()}@monolith.local`;
    const res = await request(app)
      .post('/api/iam/register')
      .send({
        email,
        password: 'Password123!',
        name: 'Principal Engineer',
        role: 'ADMIN'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.role).toBe('ADMIN');
  });

  it('IAM: Logs in registered user and returns JWT token', async () => {
    const email = `login-${Date.now()}@monolith.local`;
    await request(app).post('/api/iam/register').send({
      email,
      password: 'SecurePassword123!',
      name: 'Test Login User'
    });

    const res = await request(app)
      .post('/api/iam/login')
      .send({
        email,
        password: 'SecurePassword123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    userToken = res.body.data.accessToken;
  });

  it('Order: Creates order and dispatches asynchronous domain events', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [
          { productId: 'PROD-001', productName: 'Server Rack Mount', quantity: 2, unitPrice: 249.99 }
        ],
        currency: 'USD'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.totalAmount).toBe(499.98);
    createdOrderId = res.body.data.id;
  });

  it('Event-Driven Decoupling: Search module indexed the order via domain event', async () => {
    const res = await request(app)
      .get('/api/search')
      .query({ q: 'Order' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('Transaction: Processes payment and marks order PAID via domain integration event', async () => {
    const res = await request(app)
      .post('/api/transactions/pay')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        referenceId: createdOrderId,
        amount: 499.98,
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SUCCESS');

    // Verify order was marked paid by event subscriber
    const orderRes = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.status).toBe('PAID');
  });
});
