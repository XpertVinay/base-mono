import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  organizationsApi,
  rbacApi,
  ordersApi,
  inventoryApi,
  assetsApi,
  transactionsApi,
  configApi,
  notificationsApi,
  schedulerApi,
  recordsApi,
  apiClient,
  ApiServiceError,
  extractApiServiceError,
  unwrapEnvelope,
} from '../core/api';

describe('CRUD APIs from API Documentation (http://localhost:4000/api-docs/)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // --- Envelope and Error Extraction ---
  describe('Standard Response Envelope & Error Extraction', () => {
    it('unwraps microservices standard envelope', () => {
      const envelope = {
        status: true,
        message: 'Organizations retrieved successfully',
        data: [{ id: 'org-1', name: 'Acme Corp' }],
        errors: [],
        meta_data: { requestId: 'req-1', timestamp: '2026-11-13T00:00:00Z' },
      };
      const result = unwrapEnvelope<Array<{ id: string; name: string }>>(envelope, 200);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe('Acme Corp');
      expect(result.message).toBe('Organizations retrieved successfully');
      expect(result.status).toBe(200);
    });

    it('throws ApiServiceError on status=false envelope with code and further steps', () => {
      const errEnvelope = {
        status: false,
        message: 'Validation failed',
        data: null,
        errors: [{ code: 'INVALID_SLUG', message: 'Slug already taken' }],
        meta_data: { further_steps: ['Use another slug'] },
      };
      expect(() => unwrapEnvelope(errEnvelope, 400)).toThrow(ApiServiceError);
      try {
        unwrapEnvelope(errEnvelope, 400);
      } catch (e) {
        const err = e as ApiServiceError;
        expect(err.message).toBe('Validation failed');
        expect(err.code).toBe('INVALID_SLUG');
        expect(err.furtherSteps).toEqual(['Use another slug']);
      }
    });

    it('throws ApiServiceError on middleware error payload', () => {
      const middlewareErr = {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing JWT bearer' },
      };
      expect(() => unwrapEnvelope(middlewareErr, 401)).toThrow(ApiServiceError);
    });

    it('extracts error from ApiError details', () => {
      const extracted = extractApiServiceError(new Error('Network disconnected'));
      expect(extracted).toBeInstanceOf(ApiServiceError);
      expect(extracted.message).toBe('Network disconnected');
    });
  });

  // --- Organizations API ---
  describe('Organizations API CRUD', () => {
    it('calls GET /api/v1/organizations with query parameters', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: {
          status: true,
          message: 'Success',
          data: [{ id: 'org-1', name: 'Apex Medical', slug: 'apex-health', tier: 'ENTERPRISE', status: 'ACTIVE', industry: 'health', createdAt: '', updatedAt: '' }],
          errors: [],
        },
      });

      const res = await organizationsApi.list({ status: 'ACTIVE', tier: 'ENTERPRISE', page: 1, limit: 10 });
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy.mock.calls[0]![0]).toContain('/organizations');
      expect(getSpy.mock.calls[0]![1]?.params).toEqual({
        status: 'ACTIVE',
        tier: 'ENTERPRISE',
        page: 1,
        limit: 10,
      });
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.slug).toBe('apex-health');
    });

    it('creates, reads, updates, and deletes an organization', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 201,
        data: { status: true, message: 'Created', data: { id: 'org-new', name: 'New Corp', slug: 'new-corp' }, errors: [] },
      });
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Retrieved', data: { id: 'org-new', name: 'New Corp' }, errors: [] },
      });
      const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Updated', data: { id: 'org-new', name: 'Updated Corp' }, errors: [] },
      });
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Patched', data: { id: 'org-new', status: 'SUSPENDED' }, errors: [] },
      });
      const delSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Deleted', data: { deleted: true }, errors: [] },
      });

      // Create
      const created = await organizationsApi.create({ name: 'New Corp', industry: 'tech' });
      expect(created.data.id).toBe('org-new');
      expect(postSpy).toHaveBeenCalled();

      // Read
      const fetched = await organizationsApi.getByIdOrSlug('new-corp');
      expect(fetched.data.name).toBe('New Corp');
      expect(getSpy).toHaveBeenCalled();

      // Update
      const updated = await organizationsApi.update('org-new', { name: 'Updated Corp' });
      expect(updated.data.name).toBe('Updated Corp');
      expect(putSpy).toHaveBeenCalled();

      // Status Patch
      const statusPatched = await organizationsApi.updateStatus('org-new', 'SUSPENDED');
      expect(statusPatched.data.status).toBe('SUSPENDED');
      expect(patchSpy).toHaveBeenCalled();

      // Delete
      const deleted = await organizationsApi.delete('org-new');
      expect(deleted.data.deleted).toBe(true);
      expect(delSpy).toHaveBeenCalled();
    });

    it('manages organization members CRUD', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: [{ id: 'm-1', email: 'alice@corp.io', role: 'ADMIN' }], errors: [] },
      });
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 201,
        data: { status: true, message: 'Added', data: { id: 'm-2', email: 'bob@corp.io', role: 'MEMBER' }, errors: [] },
      });
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Updated', data: { id: 'm-2', role: 'BILLING_ADMIN' }, errors: [] },
      });
      const delSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Removed', data: { removed: true }, errors: [] },
      });

      const members = await organizationsApi.listMembers('org-1');
      expect(members.data).toHaveLength(1);
      expect(getSpy).toHaveBeenCalled();

      const added = await organizationsApi.addMember('org-1', { email: 'bob@corp.io', role: 'MEMBER' });
      expect(added.data.email).toBe('bob@corp.io');
      expect(postSpy).toHaveBeenCalled();

      const memberUpdated = await organizationsApi.updateMember('org-1', 'm-2', { role: 'BILLING_ADMIN' });
      expect(memberUpdated.data.role).toBe('BILLING_ADMIN');
      expect(patchSpy).toHaveBeenCalled();

      const removed = await organizationsApi.removeMember('org-1', 'm-2');
      expect(removed.data.removed).toBe(true);
      expect(delSpy).toHaveBeenCalled();
    });
  });

  // --- RBAC API ---
  describe('RBAC Roles & Permissions CRUD', () => {
    it('manages roles CRUD and role permissions', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: [{ id: 'r-1', name: 'Custom Auditor', isSystem: false }], errors: [] },
      });
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 201,
        data: { status: true, message: 'Created', data: { id: 'r-2', name: 'Compliance Officer' }, errors: [] },
      });
      const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Updated', data: { id: 'r-2', name: 'Chief Compliance Officer' }, errors: [] },
      });
      const delSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Deleted', data: { deleted: true }, errors: [] },
      });

      const roles = await rbacApi.listRoles({ isSystem: false });
      expect(roles.data).toHaveLength(1);
      expect(getSpy).toHaveBeenCalled();

      const role = await rbacApi.createRole({ name: 'Compliance Officer', permissions: ['audit:read'] });
      expect(role.data.id).toBe('r-2');
      expect(postSpy).toHaveBeenCalled();

      const updated = await rbacApi.updateRole('r-2', { name: 'Chief Compliance Officer' });
      expect(updated.data.name).toBe('Chief Compliance Officer');
      expect(putSpy).toHaveBeenCalled();

      const deleted = await rbacApi.deleteRole('r-2');
      expect(deleted.data.deleted).toBe(true);
      expect(delSpy).toHaveBeenCalled();
    });

    it('manages permissions CRUD, categories and user role assignments', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url.includes('/permissions/categories')) {
          return { status: 200, data: { status: true, message: 'OK', data: ['IAM', 'AUDIT', 'ORDER'], errors: [] } };
        }
        if (url.includes('/permissions')) {
          return { status: 200, data: { status: true, message: 'OK', data: [{ id: 'p-1', name: 'orders:create', action: 'create', resource: 'orders', category: 'ORDER' }], errors: [] } };
        }
        if (url.includes('/roles')) {
          return { status: 200, data: { status: true, message: 'OK', data: [{ userId: 'u-1', roleId: 'r-1', roleName: 'ADMIN', assignedAt: '' }], errors: [] } };
        }
        return { status: 200, data: { status: true, message: 'OK', data: ['orders:create'], errors: [] } };
      });

      const categories = await rbacApi.listPermissionCategories();
      expect(categories.data).toContain('AUDIT');

      const permissions = await rbacApi.listPermissions({ category: 'ORDER' });
      expect(permissions.data[0]?.name).toBe('orders:create');

      const userRoles = await rbacApi.getUserRoles('u-1');
      expect(userRoles.data[0]?.roleName).toBe('ADMIN');
    });

    it('checks user permissions', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: { granted: true, userId: 'u-1', permission: 'assets:upload' }, errors: [] },
      });

      const check = await rbacApi.checkPermission('u-1', { permission: 'assets:upload' });
      expect(check.data.granted).toBe(true);
    });
  });

  // --- Orders API ---
  describe('Orders API CRUD', () => {
    it('creates orders and fetches order details', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 201,
        data: {
          status: true,
          message: 'Order created',
          data: {
            id: 'ord-101',
            orderNumber: 'ORD-2026-101',
            status: 'PENDING',
            totalAmount: 499.0,
            currency: 'USD',
            items: [{ productId: 'prod-1', sku: 'SKU-1', name: 'Item', quantity: 2, unitPrice: 249.5, totalPrice: 499.0 }],
            createdAt: '',
            updatedAt: '',
          },
          errors: [],
        },
      });

      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: {
          status: true,
          message: 'Order retrieved',
          data: { id: 'ord-101', status: 'PENDING' },
          errors: [],
        },
      });

      const created = await ordersApi.create({
        items: [{ productId: 'prod-1', quantity: 2 }],
        currency: 'USD',
      });
      expect(created.data.id).toBe('ord-101');
      expect(created.data.totalAmount).toBe(499.0);

      const fetched = await ordersApi.getById('ord-101');
      expect(fetched.data.id).toBe('ord-101');
    });

    it('cancels an order', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Cancelled', data: { id: 'ord-101', status: 'CANCELLED' }, errors: [] },
      });

      const res = await ordersApi.cancel('ord-101', 'Customer request');
      expect(res.data.status).toBe('CANCELLED');
    });
  });

  // --- Inventory API ---
  describe('Inventory API CRUD', () => {
    it('queries stock, adds stock, and reserves stock', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: { productId: 'p-1', sku: 'SKU-1', quantity: 100, availableQuantity: 80, reservedQuantity: 20 }, errors: [] },
      });
      vi.spyOn(apiClient, 'post').mockImplementation(async (url: string) => {
        if (url.includes('/stock')) {
          return { status: 200, data: { status: true, message: 'Stock added', data: { productId: 'p-1', quantity: 150 }, errors: [] } };
        }
        return { status: 200, data: { status: true, message: 'Reserved', data: { reserved: true, expiresAt: '2026-11-13T01:00:00Z' }, errors: [] } };
      });

      const stock = await inventoryApi.getStock('p-1');
      expect(stock.data.quantity).toBe(100);

      const added = await inventoryApi.addStock({ productId: 'p-1', sku: 'SKU-1', quantity: 50 });
      expect(added.data.quantity).toBe(150);

      const reserved = await inventoryApi.reserveStock({ productId: 'p-1', quantity: 5 });
      expect(reserved.data.reserved).toBe(true);
    });
  });

  // --- Assets API ---
  describe('Assets API CRUD', () => {
    it('creates, lists, and deletes media assets', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 201,
        data: { status: true, message: 'Asset registered', data: { id: 'ast-1', name: 'report.pdf', mimeType: 'application/pdf', sizeBytes: 1024, url: 'https://cdn.example.com/report.pdf', createdAt: '' }, errors: [] },
      });
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: [{ id: 'ast-1', name: 'report.pdf' }], errors: [] },
      });
      vi.spyOn(apiClient, 'delete').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Deleted', data: { deleted: true }, errors: [] },
      });

      const created = await assetsApi.create({ name: 'report.pdf', mimeType: 'application/pdf', sizeBytes: 1024 });
      expect(created.data.id).toBe('ast-1');

      const myAssets = await assetsApi.getMyAssets();
      expect(myAssets.data).toHaveLength(1);

      const deleted = await assetsApi.delete('ast-1');
      expect(deleted.data.deleted).toBe(true);
    });
  });

  // --- Transactions API ---
  describe('Transactions API CRUD', () => {
    it('initiates payment and gets transaction status', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Payment initiated', data: { transactionId: 'txn-99', status: 'PENDING', gateway: 'STRIPE', approvalUrl: 'https://checkout.stripe.com/pay' }, errors: [] },
      });
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: { id: 'txn-99', status: 'SUCCEEDED', amount: 99.0, currency: 'USD', gateway: 'STRIPE' }, errors: [] },
      });

      const initiated = await transactionsApi.initiate({ amount: 99.0, currency: 'USD', gateway: 'STRIPE' });
      expect(initiated.data.transactionId).toBe('txn-99');
      expect(initiated.data.approvalUrl).toBeDefined();

      const tx = await transactionsApi.getById('txn-99');
      expect(tx.data.status).toBe('SUCCEEDED');
    });
  });

  // --- Config API ---
  describe('Config API CRUD & Modular Sections', () => {
    it('manages dynamic configuration keys and modular sections', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url.includes('/sections/white-label')) {
          return { status: 200, data: { status: true, message: 'OK', data: { brandName: 'Apex Health' }, errors: [] } };
        }
        if (url.includes('/sections')) {
          return { status: 200, data: { status: true, message: 'OK', data: { tenant: {}, iam: {} }, errors: [] } };
        }
        if (url.includes('/client')) {
          return { status: 200, data: { status: true, message: 'OK', data: { ACTIVE_GATEWAY: 'STRIPE' }, errors: [] } };
        }
        return { status: 200, data: { status: true, message: 'OK', data: [{ key: 'ACTIVE_GATEWAY', value: 'STRIPE' }], errors: [] } };
      });
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Saved', data: { key: 'SYSTEM_MAINTENANCE', value: 'false' }, errors: [] },
      });
      vi.spyOn(apiClient, 'delete').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Deleted', data: { deleted: true, key: 'OLD_KEY' }, errors: [] },
      });

      const list = await configApi.list();
      expect(list.data[0]?.key).toBe('ACTIVE_GATEWAY');

      const saved = await configApi.set({ key: 'SYSTEM_MAINTENANCE', value: 'false' });
      expect(saved.data.key).toBe('SYSTEM_MAINTENANCE');

      const deleted = await configApi.delete('OLD_KEY');
      expect(deleted.data.deleted).toBe(true);

      const clientConfig = await configApi.getClientConfig();
      expect(clientConfig.data.ACTIVE_GATEWAY).toBe('STRIPE');

      const section = await configApi.getSection('white-label');
      expect(section.data.brandName).toBe('Apex Health');
    });
  });

  // --- Notifications API ---
  describe('Notifications API CRUD & Batch', () => {
    it('dispatches single and batch notifications and lists logs', async () => {
      vi.spyOn(apiClient, 'post').mockImplementation(async (url: string) => {
        if (url.includes('/batch')) {
          return { status: 200, data: { status: true, message: 'Batch sent', data: { total: 2, sentCount: 2, failedCount: 0, results: [] }, errors: [] } };
        }
        return { status: 201, data: { status: true, message: 'Sent', data: { id: 'notif-1', recipient: 'user@test.io', channel: 'EMAIL', status: 'SENT', createdAt: '' }, errors: [] } };
      });
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: [{ id: 'notif-1', recipient: 'user@test.io', channel: 'EMAIL', status: 'SENT' }], errors: [] },
      });

      const sent = await notificationsApi.send({ recipient: 'user@test.io', channel: 'EMAIL', subject: 'Hello', body: 'Test message' });
      expect(sent.data.id).toBe('notif-1');

      const batch = await notificationsApi.sendBatch([
        { recipient: 'u1@test.io', channel: 'EMAIL', subject: 'Hi', body: 'Msg 1' },
        { recipient: 'u2@test.io', channel: 'EMAIL', subject: 'Hi', body: 'Msg 2' },
      ]);
      expect(batch.data.sentCount).toBe(2);

      const list = await notificationsApi.list({ channel: 'EMAIL' });
      expect(list.data).toHaveLength(1);
    });
  });

  // --- Scheduler API ---
  describe('Scheduler Jobs API CRUD', () => {
    it('registers, triggers, and deletes cron jobs', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: [{ id: 'job-1', name: 'nightly-reconcile', cronExpression: '0 0 * * *', enabled: true }], errors: [] },
      });
      vi.spyOn(apiClient, 'post').mockImplementation(async (url: string) => {
        if (url.includes('/trigger')) {
          return { status: 200, data: { status: true, message: 'Triggered', data: { triggered: true, jobId: 'job-1' }, errors: [] } };
        }
        return { status: 201, data: { status: true, message: 'Registered', data: { id: 'job-2', name: 'hourly-sync' }, errors: [] } };
      });
      vi.spyOn(apiClient, 'delete').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Deleted', data: { deleted: true }, errors: [] },
      });

      const jobs = await schedulerApi.listJobs();
      expect(jobs.data[0]?.name).toBe('nightly-reconcile');

      const created = await schedulerApi.createJob({ name: 'hourly-sync', cronExpression: '0 * * * *', targetService: 'sync', targetEndpoint: '/run' });
      expect(created.data.id).toBe('job-2');

      const triggered = await schedulerApi.triggerJob('job-1');
      expect(triggered.data.triggered).toBe(true);

      const deleted = await schedulerApi.deleteJob('job-1');
      expect(deleted.data.deleted).toBe(true);
    });
  });

  // --- Records API (CRUD in Frontend) ---
  describe('Records API CRUD', () => {
    it('performs full CRUD lifecycle on entity records', async () => {
      // List
      const list = await recordsApi.list({ tenantId: 'ten_apex_health_01' });
      expect(list.data.length).toBeGreaterThan(0);
      const initialCount = list.data.length;

      // Create
      const created = await recordsApi.create(
        {
          title: 'Automated Test Record',
          category: 'Diagnostics',
          amount: 2500,
          priority: 'high',
          status: 'active',
          notes: 'Test notes',
        },
        { tenantId: 'ten_apex_health_01' }
      );
      expect(created.data.title).toBe('Automated Test Record');
      expect(created.data.id).toBeDefined();

      // Read by ID
      const fetched = await recordsApi.getById(created.data.id, { tenantId: 'ten_apex_health_01' });
      expect(fetched.data.id).toBe(created.data.id);
      expect(fetched.data.amount).toBe(2500);

      // Update
      const updated = await recordsApi.update(
        created.data.id,
        {
          title: 'Updated Test Record Title',
          amount: 3200,
          status: 'completed',
        },
        { tenantId: 'ten_apex_health_01' }
      );
      expect(updated.data.title).toBe('Updated Test Record Title');
      expect(updated.data.amount).toBe(3200);
      expect(updated.data.status).toBe('completed');

      // Verify updated record in list
      const afterUpdateList = await recordsApi.list({ tenantId: 'ten_apex_health_01' });
      const found = afterUpdateList.data.find((r) => r.id === created.data.id);
      expect(found?.title).toBe('Updated Test Record Title');

      // Delete
      const deleted = await recordsApi.delete(created.data.id, { tenantId: 'ten_apex_health_01' });
      expect(deleted.data.success).toBe(true);

      // Verify deleted
      const finalList = await recordsApi.list({ tenantId: 'ten_apex_health_01' });
      expect(finalList.data.find((r) => r.id === created.data.id)).toBeUndefined();
      expect(finalList.data.length).toBe(initialCount);
    });
  });
});

