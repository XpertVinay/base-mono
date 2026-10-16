import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

describe('Dynamic Payment Gateway Adapter Switching via Database Config Flag', () => {
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();

    // Register an admin user to authorize config updates
    const adminEmail = `admin-gateway-${Date.now()}@monolith.local`;
    const regRes = await request(app)
      .post('/api/iam/register')
      .send({
        email: adminEmail,
        password: 'AdminPassword123!',
        name: 'Gateway Switcher Admin',
        role: 'ADMIN'
      });

    expect(regRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/api/iam/login')
      .send({
        email: adminEmail,
        password: 'AdminPassword123!'
      });

    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.data.accessToken;
  });

  it('1. Returns initial active gateway and available adapters', async () => {
    const res = await request(app)
      .get('/api/transactions/gateways')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.availableGateways).toEqual(
      expect.arrayContaining(['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK'])
    );
  });

  it('2. Dynamically switches active payment adapter to PAYPAL via config flag', async () => {
    // Admin sets database configuration flag ACTIVE_PAYMENT_GATEWAY = PAYPAL
    const configRes = await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'ACTIVE_PAYMENT_GATEWAY',
        value: 'PAYPAL',
        description: 'Switched to PayPal adapter'
      });

    expect(configRes.status).toBe(200);
    expect(configRes.body.success).toBe(true);

    // Query transaction gateways endpoint
    const gwRes = await request(app)
      .get('/api/transactions/gateways')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(gwRes.status).toBe(200);
    expect(gwRes.body.data.activeGateway).toBe('PAYPAL');
  });

  it('3. Routes payment through PAYPAL adapter without server restart', async () => {
    const payRes = await request(app)
      .post('/api/transactions/pay')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        referenceId: `ord_paypal_${Date.now()}`,
        amount: 89.95,
        currency: 'USD',
        paymentMethod: 'PAYPAL_WALLET'
      });

    expect(payRes.status).toBe(201);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.data.status).toBe('SUCCESS');
    expect(payRes.body.data.amount).toBe(89.95);
  });

  it('4. Dynamically switches active payment adapter to RAZORPAY', async () => {
    // Switch to RAZORPAY
    const configRes = await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'ACTIVE_PAYMENT_GATEWAY',
        value: 'RAZORPAY',
        description: 'Switched to Razorpay adapter'
      });

    expect(configRes.status).toBe(200);

    const gwRes = await request(app)
      .get('/api/transactions/gateways')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(gwRes.status).toBe(200);
    expect(gwRes.body.data.activeGateway).toBe('RAZORPAY');

    // Charge through Razorpay
    const payRes = await request(app)
      .post('/api/transactions/pay')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        referenceId: `ord_rzp_${Date.now()}`,
        amount: 150.00,
        currency: 'INR',
        paymentMethod: 'UPI'
      });

    expect(payRes.status).toBe(201);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.data.status).toBe('SUCCESS');
  });

  it('5. Falls back safely to MOCK adapter if unknown gateway is configured', async () => {
    // Set an invalid / unknown provider in config flag
    await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: 'ACTIVE_PAYMENT_GATEWAY',
        value: 'NON_EXISTENT_GATEWAY'
      });

    // Transaction module router should fall back gracefully to MOCK
    const payRes = await request(app)
      .post('/api/transactions/pay')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        referenceId: `ord_fallback_${Date.now()}`,
        amount: 25.00,
        currency: 'USD',
        paymentMethod: 'TEST_CARD'
      });

    expect(payRes.status).toBe(201);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.data.status).toBe('SUCCESS');
  });
});
