import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

describe('Notification System Adapter & Configuration Testing', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();

    // Register & Login a user to obtain JWT authentication
    const testEmail = `notify-tester-${Date.now()}@monolith.local`;
    const regRes = await request(app)
      .post('/api/iam/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        name: 'Notification Tester',
        role: 'ADMIN'
      });

    expect(regRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/api/iam/login')
      .send({
        email: testEmail,
        password: 'Password123!'
      });

    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.data.accessToken;
  });

  it('1. GET /api/notifications/config returns active provider routing and dry-run state', async () => {
    const res = await request(app)
      .get('/api/notifications/config')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.globalDryRun).toBe(true);
    expect(res.body.data.channels.EMAIL.activeProvider).toBe('SENDGRID');
    expect(res.body.data.channels.SMS.activeProvider).toBe('TWILIO');
    expect(res.body.data.channels.WHATSAPP.activeProvider).toBe('META_CLOUD');
    expect(res.body.data.channels.PUSH.activeProvider).toBe('FCM');
  });

  it('2. Dispatches Email via SendGrid adapter in DRY-RUN mode', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipient: 'customer@example.com',
        channel: 'EMAIL',
        subject: 'Welcome to our platform',
        body: '<h1>Welcome!</h1><p>Thanks for joining us.</p>',
        dryRun: true
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recipient).toBe('customer@example.com');
    expect(res.body.data.channel).toBe('EMAIL');
    expect(res.body.data.provider).toBe('SENDGRID');
    expect(res.body.data.isDryRun).toBe(true);
    expect(res.body.data.status).toBe('SENT');
    expect(res.body.data.providerMessageId).toMatch(/^sg_msg_/);
  });

  it('3. Dispatches SMS via Twilio adapter in DRY-RUN mode', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipient: '+12345678901',
        channel: 'SMS',
        subject: 'Security Alert',
        body: 'Your verification code is 123456',
        dryRun: true
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.channel).toBe('SMS');
    expect(res.body.data.provider).toBe('TWILIO');
    expect(res.body.data.isDryRun).toBe(true);
    expect(res.body.data.status).toBe('SENT');
    expect(res.body.data.providerMessageId).toMatch(/^SM/);
  });

  it('4. Dispatches WhatsApp via Meta Cloud adapter in DRY-RUN mode', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipient: '+19876543210',
        channel: 'WHATSAPP',
        subject: 'Reservation Update',
        body: 'Your booking has been confirmed.',
        dryRun: true,
        templateId: 'booking_confirmation'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.channel).toBe('WHATSAPP');
    expect(res.body.data.provider).toBe('META_CLOUD');
    expect(res.body.data.isDryRun).toBe(true);
    expect(res.body.data.status).toBe('SENT');
    expect(res.body.data.providerMessageId).toMatch(/^wamid\./);
  });

  it('5. Dispatches Push notification via FCM adapter in DRY-RUN mode', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipient: 'device-fcm-token-xyz-123456789',
        channel: 'PUSH',
        subject: 'New Message',
        body: 'You received a new document update.',
        dryRun: true,
        metadata: { docId: 'doc-999', priority: 'high' }
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.channel).toBe('PUSH');
    expect(res.body.data.provider).toBe('FCM');
    expect(res.body.data.isDryRun).toBe(true);
    expect(res.body.data.status).toBe('SENT');
    expect(res.body.data.providerMessageId).toContain('messages/');
  });

  it('6. Inspects Developer DRY-Run Outbox and finds simulated dispatches', async () => {
    const res = await request(app)
      .get('/api/notifications/dry-run/outbox')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);

    const emailItem = res.body.data.find((item: any) => item.channel === 'EMAIL');
    expect(emailItem).toBeDefined();
    expect(emailItem.provider).toBe('SENDGRID');
    expect(emailItem.recipient).toBe('customer@example.com');

    const whatsappItem = res.body.data.find((item: any) => item.channel === 'WHATSAPP');
    expect(whatsappItem).toBeDefined();
    expect(whatsappItem.provider).toBe('META_CLOUD');
  });

  it('7. High performance batch notification dispatch (POST /api/notifications/batch)', async () => {
    const res = await request(app)
      .post('/api/notifications/batch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        notifications: [
          {
            recipient: 'batch-user-1@example.com',
            channel: 'EMAIL',
            subject: 'Batch Email 1',
            body: 'First batch email'
          },
          {
            recipient: '+12345678902',
            channel: 'SMS',
            subject: 'Batch SMS 2',
            body: 'Second batch sms'
          },
          {
            recipient: 'token-device-batch-3',
            channel: 'PUSH',
            subject: 'Batch Push 3',
            body: 'Third batch push'
          }
        ],
        dryRun: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.sentCount).toBe(3);
    expect(res.body.data.failedCount).toBe(0);
    expect(res.body.data.results).toHaveLength(3);
  });

  it('8. Retrieves single notification by ID and lists notifications with filters', async () => {
    const sendRes = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipient: 'unique-filter-user@example.com',
        channel: 'EMAIL',
        subject: 'Filtered Query Test',
        body: 'Testing query filter',
        dryRun: true
      });

    const notifId = sendRes.body.data.id;

    // Get by ID
    const getRes = await request(app)
      .get(`/api/notifications/${notifId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(notifId);
    expect(getRes.body.data.recipient).toBe('unique-filter-user@example.com');

    // List with recipient filter
    const listRes = await request(app)
      .get(`/api/notifications?recipient=unique-filter-user@example.com`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data[0].recipient).toBe('unique-filter-user@example.com');
  });

  it('9. Dynamically switches Email provider via configuration key in database', async () => {
    // Switch Email provider to MOCK
    const configRes = await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        key: 'NOTIFICATION_EMAIL_PROVIDER',
        value: 'MOCK',
        description: 'Testing provider switch to MOCK'
      });

    expect(configRes.status).toBe(200);

    // Verify config updated
    const checkConfig = await request(app)
      .get('/api/notifications/config')
      .set('Authorization', `Bearer ${authToken}`);

    expect(checkConfig.body.data.channels.EMAIL.activeProvider).toBe('MOCK');

    // Send email - it should now use MOCK
    const sendRes = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipient: 'switched-mock@example.com',
        channel: 'EMAIL',
        subject: 'Switched Provider Test',
        body: 'Dispatched through dynamically configured MOCK provider'
      });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.provider).toBe('MOCK');

    // Restore back to SENDGRID for idempotent re-runs
    await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        key: 'NOTIFICATION_EMAIL_PROVIDER',
        value: 'SENDGRID',
        description: 'Restore default provider'
      });
  });

  it('10. Ingests simulated provider delivery webhooks', async () => {
    // SendGrid webhook
    const sgWebhook = await request(app)
      .post('/api/notifications/webhooks/sendgrid')
      .send([
        {
          event: 'delivered',
          sg_message_id: 'sg_msg_12345.rec',
          email: 'customer@example.com',
          timestamp: Math.floor(Date.now() / 1000)
        }
      ]);

    expect(sgWebhook.status).toBe(200);
    expect(sgWebhook.body.success).toBe(true);

    // Twilio webhook
    const twilioWebhook = await request(app)
      .post('/api/notifications/webhooks/twilio')
      .send({
        MessageSid: 'SM1234567890abcdef',
        MessageStatus: 'delivered',
        To: '+12345678901'
      });

    expect(twilioWebhook.status).toBe(200);
    expect(twilioWebhook.body.success).toBe(true);

    // WhatsApp webhook
    const waWebhook = await request(app)
      .post('/api/notifications/webhooks/meta_cloud')
      .send({
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [{ id: 'wamid.HBgL123', status: 'delivered' }]
                }
              }
            ]
          }
        ]
      });

    expect(waWebhook.status).toBe(200);
    expect(waWebhook.body.success).toBe(true);
  });

  it('11. Clears Developer Dry-Run Outbox', async () => {
    const clearRes = await request(app)
      .delete('/api/notifications/dry-run/outbox')
      .set('Authorization', `Bearer ${authToken}`);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.data.cleared).toBe(true);

    const checkRes = await request(app)
      .get('/api/notifications/dry-run/outbox')
      .set('Authorization', `Bearer ${authToken}`);

    expect(checkRes.body.data).toHaveLength(0);
  });

  it('12. Serves interactive Swagger UI and OpenAPI 3.0 specification for Notifications', async () => {
    // OpenAPI Specification JSON endpoint
    const specRes = await request(app).get('/api-docs/swagger.json');
    expect(specRes.status).toBe(200);
    expect(specRes.body.openapi).toBe('3.0.3');
    expect(specRes.body.paths['/api/notifications']).toBeDefined();
    expect(specRes.body.paths['/api/notifications/batch']).toBeDefined();
    expect(specRes.body.paths['/api/notifications/config']).toBeDefined();
    expect(specRes.body.paths['/api/notifications/dry-run/outbox']).toBeDefined();
    expect(specRes.body.paths['/api/notifications/webhooks/{provider}']).toBeDefined();

    // Interactive Swagger UI HTML endpoint
    const uiRes = await request(app).get('/api-docs/');
    expect(uiRes.status).toBe(200);
    expect(uiRes.text).toContain('swagger-ui');

    // /docs redirect alias
    const redirectRes = await request(app).get('/docs');
    expect(redirectRes.status).toBe(302);
  });
});
