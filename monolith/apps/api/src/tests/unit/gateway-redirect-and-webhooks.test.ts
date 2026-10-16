import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

describe('Payment Gateway Hosted Redirect & Asynchronous Webhook Integration', () => {
  let app: any;
  let userToken: string;
  let adminToken: string;
  let orderId: string;

  beforeAll(async () => {
    app = createApp();

    // 1. Create a normal user
    const userEmail = `shopper-${Date.now()}@monolith.local`;
    await request(app)
      .post('/api/iam/register')
      .send({ email: userEmail, password: 'UserPassword123!', name: 'Test Shopper' });

    const userLogin = await request(app)
      .post('/api/iam/login')
      .send({ email: userEmail, password: 'UserPassword123!' });

    userToken = userLogin.body.data.accessToken;

    // 2. Create an admin user for config flag updates
    const adminEmail = `admin-gw-${Date.now()}@monolith.local`;
    await request(app)
      .post('/api/iam/register')
      .send({ email: adminEmail, password: 'AdminPassword123!', name: 'Admin', role: 'ADMIN' });

    const adminLogin = await request(app)
      .post('/api/iam/login')
      .send({ email: adminEmail, password: 'AdminPassword123!' });

    adminToken = adminLogin.body.data.accessToken;

    // 3. Create a test order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [
          { productId: 'P-100', productName: '4K Pro Monitor', quantity: 1, unitPrice: 799.00 }
        ],
        currency: 'USD'
      });

    expect(orderRes.status).toBe(201);
    orderId = orderRes.body.data.id;
  });

  it('1. Initiates hosted checkout redirect session for Stripe with PENDING status', async () => {
    // Set active gateway flag to STRIPE
    await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'ACTIVE_PAYMENT_GATEWAY', value: 'STRIPE' });

    const res = await request(app)
      .post('/api/transactions/initiate')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        referenceId: orderId,
        amount: 799.00,
        currency: 'USD',
        returnUrl: 'http://localhost:8080/?status=success',
        cancelUrl: 'http://localhost:8080/?status=cancelled'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.provider).toBe('STRIPE');
    expect(res.body.data.redirectUrl).toBeDefined();
    expect(res.body.data.redirectUrl).toContain('sessionId=');

    // Query transaction by ID
    const txnRes = await request(app)
      .get(`/api/transactions/${res.body.data.transactionId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(txnRes.status).toBe(200);
    expect(txnRes.body.data.status).toBe('PENDING');
  });

  it('2. Processes asynchronous Stripe webhook (checkout.session.completed) and transitions order to PAID', async () => {
    // Create new order to test webhook completion
    const ordRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [{ productId: 'P-200', productName: 'Wireless Mouse', quantity: 1, unitPrice: 50.00 }],
        currency: 'USD'
      });

    const targetOrderId = ordRes.body.data.id;

    // Initiate payment
    const initRes = await request(app)
      .post('/api/transactions/initiate')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        referenceId: targetOrderId,
        amount: 50.00,
        currency: 'USD'
      });

    const txnId = initRes.body.data.transactionId;

    // Simulate incoming Stripe Webhook
    const webhookRes = await request(app)
      .post('/api/transactions/webhooks/stripe')
      .send({
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: txnId,
            payment_intent: 'pi_stripe_live_test_123',
            amount_total: 5000,
            currency: 'usd'
          }
        }
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.success).toBe(true);
    expect(webhookRes.body.data.status).toBe('SUCCESS');

    // Verify transaction updated to SUCCESS
    const txnRes = await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(txnRes.status).toBe(200);
    expect(txnRes.body.data.status).toBe('SUCCESS');

    // Verify domain event listener marked order PAID
    const checkOrderRes = await request(app)
      .get(`/api/orders/${targetOrderId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(checkOrderRes.status).toBe(200);
    expect(checkOrderRes.body.data.status).toBe('PAID');
  });

  it('3. Dynamically switches to PAYPAL, initiates redirect, and handles decline webhook', async () => {
    // Switch to PAYPAL
    await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'ACTIVE_PAYMENT_GATEWAY', value: 'PAYPAL' });

    // Initiate PayPal checkout
    const initRes = await request(app)
      .post('/api/transactions/initiate')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        referenceId: `ord_paypal_${Date.now()}`,
        amount: 120.00,
        currency: 'USD'
      });

    expect(initRes.status).toBe(201);
    expect(initRes.body.data.provider).toBe('PAYPAL');
    expect(initRes.body.data.redirectUrl).toBeDefined();

    const txnId = initRes.body.data.transactionId;

    // Send PayPal decline webhook
    const webhookRes = await request(app)
      .post('/api/transactions/webhooks/paypal')
      .send({
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          custom_id: txnId,
          id: 'PAYPAL-DENIED-99'
        }
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.data.status).toBe('FAILED');

    // Verify transaction is FAILED
    const txnRes = await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(txnRes.status).toBe(200);
    expect(txnRes.body.data.status).toBe('FAILED');
  });

  it('4. Dynamically switches to RAZORPAY, initiates redirect, and handles capture webhook', async () => {
    // Switch to RAZORPAY
    await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'ACTIVE_PAYMENT_GATEWAY', value: 'RAZORPAY' });

    const initRes = await request(app)
      .post('/api/transactions/initiate')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        referenceId: `ord_rzp_${Date.now()}`,
        amount: 2500.00,
        currency: 'INR'
      });

    expect(initRes.status).toBe(201);
    expect(initRes.body.data.provider).toBe('RAZORPAY');

    const txnId = initRes.body.data.transactionId;

    // Send Razorpay payment.captured webhook
    const webhookRes = await request(app)
      .post('/api/transactions/webhooks/razorpay')
      .send({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_test_456',
              amount: 250000,
              currency: 'INR',
              notes: { transactionId: txnId }
            }
          }
        }
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.data.status).toBe('SUCCESS');

    const txnRes = await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(txnRes.status).toBe(200);
    expect(txnRes.body.data.status).toBe('SUCCESS');
  });

  it('5. Renders hosted gateway simulation HTML page for sandbox test flows', async () => {
    const res = await request(app)
      .get('/api/transactions/gateway-simulator')
      .query({
        provider: 'STRIPE',
        amount: 199.99,
        currency: 'USD',
        referenceId: 'ord-test-simulator',
        transactionId: 'txn-test-123'
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Stripe Checkout');
    expect(res.text).toContain('$199.99 USD');
    expect(res.text).toContain('completePayment(true)');
  });
});
