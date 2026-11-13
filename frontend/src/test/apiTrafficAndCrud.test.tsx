import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  useApiTrafficStore,
  generateCurl,
  resolveSwaggerDocUrl,
  detectServiceTag,
} from '../core/api/trafficStore';
import { ApiTrafficInspector } from '../components/telemetry/ApiTrafficInspector';
import { ApiExplorerPage } from '../features/api-explorer/ApiExplorerPage';
import { organizationsApi } from '../core/api/services/organizationsApi';
import { configApi } from '../core/api/services/configApi';
import { rbacApi } from '../core/api/services/rbacApi';
import { notificationsApi } from '../core/api/services/notificationsApi';
import { recordsApi } from '../core/api/services/recordsApi';

// Mock Tenant Context
vi.mock('../core/tenant/TenantContext', () => ({
  useTenant: () => ({
    tenant: {
      identity: {
        id: 'ten_apex_health_01',
        slug: 'apex-health',
        displayName: 'Apex Health Global',
        legalName: 'Apex Health Systems Inc.',
      },
      industry: 'healthcare',
    },
  }),
}));

describe('API Communication & Traffic Store Telemetry', () => {
  beforeEach(() => {
    useApiTrafficStore.getState().clearRecords();
  });

  it('generates accurate reproducible curl command', () => {
    const curl = generateCurl(
      'POST',
      'http://localhost:4000/api/v1/organizations',
      {
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'ten_apex_health_01',
      },
      { name: 'Acme Health', tier: 'ENTERPRISE' }
    );

    expect(curl).toContain('curl -X POST "http://localhost:4000/api/v1/organizations"');
    expect(curl).toContain('-H "X-Tenant-ID: ten_apex_health_01"');
    expect(curl).toContain('"name": "Acme Health"');
  });

  it('resolves correct Swagger documentation anchors for endpoints', () => {
    expect(resolveSwaggerDocUrl('/api/v1/organizations')).toContain('Organization%20Service');
    expect(resolveSwaggerDocUrl('/api/v1/config/KEY')).toContain('Config%20Service');
    expect(resolveSwaggerDocUrl('/api/v1/rbac/roles')).toContain('Roles%20(RBAC)');
    expect(resolveSwaggerDocUrl('/api/v1/notifications')).toContain('Notifications');
  });

  it('detects correct service tags', () => {
    expect(detectServiceTag('/api/v1/organizations')).toBe('Organizations');
    expect(detectServiceTag('/api/v1/config')).toBe('Config');
    expect(detectServiceTag('/api/v1/rbac/roles')).toBe('RBAC');
    expect(detectServiceTag('/api/v1/notifications')).toBe('Notifications');
    expect(detectServiceTag('/records')).toBe('Records');
  });

  it('adds and clears traffic records properly', () => {
    const store = useApiTrafficStore.getState();
    expect(store.records).toHaveLength(0);

    store.addRecord({
      method: 'GET',
      url: 'http://localhost:4000/api/v1/organizations',
      endpoint: '/api/v1/organizations',
      service: 'Organizations',
      status: 200,
      statusText: 'OK',
      durationMs: 14,
      headers: { 'X-Tenant-ID': 'ten_apex_01' },
      mode: 'live',
    });

    expect(useApiTrafficStore.getState().records).toHaveLength(1);
    expect(useApiTrafficStore.getState().records[0]?.service).toBe('Organizations');

    store.clearRecords();
    expect(useApiTrafficStore.getState().records).toHaveLength(0);
  });
});

describe('Live CRUD Operations & Traffic Telemetry Execution', () => {
  beforeEach(() => {
    useApiTrafficStore.getState().clearRecords();
  });

  it('executes Organizations CRUD and logs traffic records', async () => {
    // 1. List
    const listRes = await organizationsApi.list();
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.data)).toBe(true);
    expect(listRes.data.length).toBeGreaterThan(0);

    // 2. Create
    const createRes = await organizationsApi.create({
      name: 'Cyberdyne Systems Test',
      industry: 'robotics',
      tier: 'ENTERPRISE',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.data.name).toBe('Cyberdyne Systems Test');

    const createdId = createRes.data.id;

    // 3. Update
    const updateRes = await organizationsApi.update(createdId, {
      name: 'Cyberdyne Systems Updated',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.data.name).toBe('Cyberdyne Systems Updated');

    // 4. Delete
    const deleteRes = await organizationsApi.delete(createdId);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.data.deleted).toBe(true);

    // Verify traffic records were registered in store
    const traffic = useApiTrafficStore.getState().records;
    expect(traffic.length).toBeGreaterThanOrEqual(4);
    const postReq = traffic.find((r) => r.method === 'POST' && r.endpoint.includes('/organizations'));
    expect(postReq).toBeDefined();
    expect(postReq?.status).toBe(201);
  });

  it('executes Dynamic Config CRUD and logs traffic records', async () => {
    // 1. Set Config
    const setRes = await configApi.set({
      key: 'TEST_RUNTIME_FLAG_V1',
      value: 'ENABLED_TRUE',
      target: 'BACKEND',
      description: 'Automated test configuration key',
    });
    expect(setRes.status).toBe(200);
    expect(setRes.data.key).toBe('TEST_RUNTIME_FLAG_V1');
    expect(setRes.data.value).toBe('ENABLED_TRUE');

    // 2. Get Config by Key
    const getRes = await configApi.getByKey('TEST_RUNTIME_FLAG_V1');
    expect(getRes.status).toBe(200);
    expect(getRes.data.key).toBe('TEST_RUNTIME_FLAG_V1');

    // 3. Delete Config
    const delRes = await configApi.delete('TEST_RUNTIME_FLAG_V1');
    expect(delRes.status).toBe(200);
    expect(delRes.data.deleted).toBe(true);

    const traffic = useApiTrafficStore.getState().records;
    const configReq = traffic.find((r) => r.endpoint.includes('/config'));
    expect(configReq).toBeDefined();
  });

  it('executes RBAC Roles CRUD and logs traffic records', async () => {
    // 1. Create Custom Role
    const createRes = await rbacApi.createRole({
      name: 'AUTOMATED_TEST_INSPECTOR',
      description: 'Role for verifying Swagger integration',
      permissions: ['audit:read', 'records:read'],
    });
    expect(createRes.status).toBe(201);
    expect(createRes.data.name).toBe('AUTOMATED_TEST_INSPECTOR');

    const roleId = createRes.data.id;

    // 2. List Roles
    const listRes = await rbacApi.listRoles();
    expect(listRes.status).toBe(200);
    expect(listRes.data.some((r) => r.id === roleId)).toBe(true);

    // 3. Delete Role
    const delRes = await rbacApi.deleteRole(roleId);
    expect(delRes.status).toBe(200);
    expect(delRes.data.deleted).toBe(true);
  });

  it('executes Notifications Dispatch (including DRY-Run) and logs traffic records', async () => {
    const res = await notificationsApi.send({
      recipient: 'telemetry@enterprise.local',
      channel: 'EMAIL',
      subject: 'Security Alert: Test Notification',
      body: 'Verified via Automated Frontend-to-Backend Test Harness',
      dryRun: true,
    });

    expect(res.status).toBe(201);
    expect(res.data.isDryRun).toBe(true);
    expect(res.data.status).toBe('SENT');

    const outbox = await notificationsApi.getDryRunOutbox();
    expect(outbox.status).toBe(200);
    expect(outbox.data.length).toBeGreaterThan(0);
  });

  it('executes Data Records CRUD with tenant headers', async () => {
    // 1. List
    const listRes = await recordsApi.list({ tenantId: 'ten_apex_health_01' });
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.data)).toBe(true);

    // 2. Create
    const createRes = await recordsApi.create(
      {
        title: 'Diagnostic Test Series #901',
        category: 'Pathology',
        priority: 'high',
        status: 'active',
        amount: 550,
        notes: 'Specimen delivered to automated lab queue.',
      },
      { tenantId: 'ten_apex_health_01' }
    );
    expect(createRes.status).toBe(201);
    expect(createRes.data.title).toBe('Diagnostic Test Series #901');

    const recId = createRes.data.id;

    // 3. Update
    const updateRes = await recordsApi.update(
      recId,
      { amount: 620 },
      { tenantId: 'ten_apex_health_01' }
    );
    expect(updateRes.status).toBe(200);
    expect(updateRes.data.amount).toBe(620);

    // 4. Delete
    const delRes = await recordsApi.delete(recId, { tenantId: 'ten_apex_health_01' });
    expect(delRes.status).toBe(200);
  });
});

describe('ApiTrafficInspector Component UI Rendering', () => {
  it('renders floating trigger with counter and opens drawer on click', () => {
    useApiTrafficStore.getState().clearRecords();
    useApiTrafficStore.getState().setDrawerOpen(false);
    useApiTrafficStore.getState().addRecord({
      method: 'GET',
      url: 'http://localhost:4000/api/v1/organizations',
      endpoint: '/api/v1/organizations',
      service: 'Organizations',
      status: 200,
      statusText: 'OK',
      durationMs: 12,
      headers: { 'X-Tenant-ID': 'ten_apex_01' },
      mode: 'live',
    });

    render(<ApiTrafficInspector />);

    const trigger = screen.getByTitle(/Inspect Frontend -> Backend HTTP Communication/i);
    expect(trigger).toBeDefined();
    expect(screen.getByText('API Traffic')).toBeDefined();

    // Click trigger to open
    fireEvent.click(trigger);
    expect(useApiTrafficStore.getState().isDrawerOpen).toBe(true);
    expect(screen.getByText('API Communication Inspector')).toBeDefined();
  });
});

describe('ApiExplorerPage Component Rendering', () => {
  it('renders explorer workbench tabs and health ping banner', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ApiExplorerPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/API Operations & Live CRUD Workbench/i)).toBeDefined();
    expect(screen.getByText(/Target Ingress Gateway:/i)).toBeDefined();
    expect(screen.getByText('Organizations CRUD')).toBeDefined();
    expect(screen.getByText('Dynamic Config CRUD')).toBeDefined();
    expect(screen.getByText('RBAC Roles CRUD')).toBeDefined();
    expect(screen.getByText(/Notifications & Outbox/i)).toBeDefined();
    expect(screen.getByText('Tenant Data Records')).toBeDefined();

    // Click Ping Gateway button
    const pingBtn = screen.getByRole('button', { name: /Ping Gateway/i });
    fireEvent.click(pingBtn);

    await waitFor(() => {
      expect(screen.getByText(/Status:/i)).toBeDefined();
    });
  });
});
