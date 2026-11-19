import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  OrdersTab,
  InventoryTab,
  AssetsTab,
  TransactionsTab,
  SchedulerTab,
  MfaCryptoTab,
  ConfigTab,
  NotificationsTab,
} from '../features/api-explorer/tabs';
import { ApiExplorerPage } from '../features/api-explorer/ApiExplorerPage';
import { ordersApi } from '../core/api/services/ordersApi';
import { inventoryApi } from '../core/api/services/inventoryApi';
import { assetsApi } from '../core/api/services/assetsApi';
import { transactionsApi } from '../core/api/services/transactionsApi';
import { schedulerApi } from '../core/api/services/schedulerApi';
import { iamApi } from '../core/api/services/iamApi';
import { configApi } from '../core/api/services/configApi';
import { notificationsApi } from '../core/api/services/notificationsApi';

// Mock Tenant Context
vi.mock('../core/tenant/TenantContext', () => ({
  useTenant: () => ({
    tenant: {
      identity: {
        id: 'ten_apex_health_01',
        slug: 'apex-health',
        displayName: 'Apex Health Systems Inc.',
      },
      industry: 'healthcare',
    },
  }),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('CRUD Tabs & Components Verification (Requirement R2, R3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('OrdersTab Component', () => {
    it('renders orders listing and opens create order modal', async () => {
      vi.spyOn(ordersApi, 'listOrders').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: [
          {
            id: 'ord_101',
            orderNumber: 'ORD-2026-8921',
            status: 'CONFIRMED',
            totalAmount: 542.5,
            currency: 'USD',
            subtotal: 500,
            tax: 42.5,
            items: [{ productId: 'p1', sku: 'SKU-1', name: 'Kit', quantity: 1, unitPrice: 500, totalPrice: 500 }],
            createdAt: '2026-11-14T00:00:00Z',
            updatedAt: '2026-11-14T00:00:00Z',
          },
        ],
      });

      renderWithProviders(<OrdersTab />);

      await waitFor(() => {
        expect(screen.getByText('ORD-2026-8921')).toBeDefined();
        expect(screen.getByText('CONFIRMED')).toBeDefined();
      });

      // Click Create Order button
      const createBtn = screen.getByRole('button', { name: /Create Order/i });
      fireEvent.click(createBtn);

      expect(screen.getByText('Create New Order')).toBeDefined();
      expect(screen.getByPlaceholderText('USD')).toBeDefined();
    });

    it('cancels an order with cancellation reason modal', async () => {
      vi.spyOn(ordersApi, 'listOrders').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: [
          {
            id: 'ord_101',
            orderNumber: 'ORD-2026-8921',
            status: 'PENDING',
            totalAmount: 100,
            currency: 'USD',
            subtotal: 100,
            tax: 0,
            items: [],
            createdAt: '2026-11-14T00:00:00Z',
            updatedAt: '2026-11-14T00:00:00Z',
          },
        ],
      });

      const cancelSpy = vi.spyOn(ordersApi, 'cancel').mockResolvedValue({
        status: 200,
        message: 'Cancelled',
        data: {
          id: 'ord_101',
          orderNumber: 'ORD-2026-8921',
          status: 'CANCELLED',
          totalAmount: 100,
          currency: 'USD',
          subtotal: 100,
          tax: 0,
          items: [],
          createdAt: '',
          updatedAt: '',
        },
      });

      renderWithProviders(<OrdersTab />);

      await waitFor(() => {
        expect(screen.getByText('ORD-2026-8921')).toBeDefined();
      });

      // Click cancel action button
      const cancelBtn = screen.getByTitle('Cancel Order');
      fireEvent.click(cancelBtn);

      expect(screen.getByText(/Reason for Cancellation/i)).toBeDefined();

      const reasonInput = screen.getByPlaceholderText(/Customer requested cancellation/i);
      fireEvent.change(reasonInput, { target: { value: 'Patient rescheduled appointment' } });

      const confirmBtn = screen.getByRole('button', { name: /Confirm Cancellation/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(cancelSpy).toHaveBeenCalledWith('ord_101', 'Patient rescheduled appointment');
      });
    });
  });

  describe('InventoryTab Component', () => {
    it('renders stock catalog, opens Add Stock and Reserve Stock modals', async () => {
      vi.spyOn(inventoryApi, 'listItems').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: [
          {
            productId: 'prod_mri_1',
            sku: 'MED-MRI-01',
            name: 'MRI Contrast Kit',
            quantity: 85,
            availableQuantity: 73,
            reservedQuantity: 12,
            warehouseId: 'wh_main',
          },
        ],
      });

      renderWithProviders(<InventoryTab />);

      await waitFor(() => {
        expect(screen.getByText('MED-MRI-01')).toBeDefined();
        expect(screen.getByText('73 in stock')).toBeDefined();
      });

      // Open Add Stock modal
      const addStockBtn = screen.getByRole('button', { name: /Add Stock/i });
      fireEvent.click(addStockBtn);
      expect(screen.getByText('Add Inventory Stock')).toBeDefined();

      // Open Reserve Stock modal
      const reserveBtn = screen.getByRole('button', { name: /Reserve Stock/i });
      fireEvent.click(reserveBtn);
      expect(screen.getByText('Reserve Inventory Stock')).toBeDefined();
    });
  });

  describe('AssetsTab Component', () => {
    it('renders media assets and triggers delete modal', async () => {
      vi.spyOn(assetsApi, 'list').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: [
          {
            id: 'ast_101',
            name: 'radiology_patient_8921.dcm',
            mimeType: 'application/dicom',
            sizeBytes: 15728640,
            url: 'https://cdn.example.com/asset.dcm',
            storageProvider: 'LOCAL',
            createdAt: '2026-11-14T00:00:00Z',
          },
        ],
      });

      renderWithProviders(<AssetsTab />);

      await waitFor(() => {
        expect(screen.getByText('radiology_patient_8921.dcm')).toBeDefined();
        expect(screen.getByText('application/dicom')).toBeDefined();
      });

      // Open Register Asset modal
      const registerBtn = screen.getByRole('button', { name: /Register Asset/i });
      fireEvent.click(registerBtn);
      expect(screen.getByText('Register File Asset Metadata')).toBeDefined();

      // Click delete icon button
      const deleteBtn = screen.getByTitle('Delete Asset');
      fireEvent.click(deleteBtn);
      expect(screen.getByText('Confirm Asset Deletion')).toBeDefined();
    });
  });

  describe('TransactionsTab Component', () => {
    it('renders transactions and opens initiate payment modal', async () => {
      vi.spyOn(transactionsApi, 'list').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: [
          {
            id: 'txn_901',
            orderId: 'ord_101',
            amount: 542.5,
            currency: 'USD',
            gateway: 'STRIPE',
            gatewayTransactionId: 'ch_test123',
            status: 'SUCCEEDED',
            createdAt: '2026-11-14T00:00:00Z',
            updatedAt: '2026-11-14T00:00:00Z',
          },
        ],
      });

      renderWithProviders(<TransactionsTab />);

      await waitFor(() => {
        expect(screen.getByText('txn_901')).toBeDefined();
        expect(screen.getByText('USD 542.50')).toBeDefined();
      });

      // Open Initiate Payment modal
      const initBtn = screen.getByRole('button', { name: /Initiate Payment/i });
      fireEvent.click(initBtn);
      expect(screen.getByText('Initiate Gateway Payment')).toBeDefined();
    });
  });

  describe('SchedulerTab Component', () => {
    it('renders cron jobs and executes trigger action', async () => {
      vi.spyOn(schedulerApi, 'listJobs').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: [
          {
            id: 'job_1',
            name: 'Nightly Sync',
            cronExpression: '0 2 * * *',
            targetService: 'orders',
            targetEndpoint: '/api/v1/orders/reconcile',
            enabled: true,
            createdAt: '2026-11-14T00:00:00Z',
          },
        ],
      });

      const triggerSpy = vi.spyOn(schedulerApi, 'triggerJob').mockResolvedValue({
        status: 200,
        message: 'Triggered',
        data: { triggered: true, jobId: 'job_1' },
      });

      renderWithProviders(<SchedulerTab />);

      await waitFor(() => {
        expect(screen.getByText('Nightly Sync')).toBeDefined();
        expect(screen.getByText('0 2 * * *')).toBeDefined();
      });

      // Click trigger button
      const triggerBtn = screen.getByTitle('Trigger Immediate Execution');
      fireEvent.click(triggerBtn);

      await waitFor(() => {
        expect(triggerSpy).toHaveBeenCalledWith('job_1');
      });
    });
  });

  describe('MfaCryptoTab Component', () => {
    it('renders MFA live status, JWKS and RSA Public Key', async () => {
      vi.spyOn(iamApi, 'getMfaStatus').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: { mfaEnabled: true, isMfaVerifiedSession: true, verifiedAt: '2026-11-14T00:00:00Z' },
      });

      vi.spyOn(iamApi, 'getJwks').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: { keys: [{ kid: 'key-2026', kty: 'RSA', alg: 'RS256', use: 'sig', n: 'abc', e: 'AQAB' }] },
      });

      vi.spyOn(iamApi, 'getPublicKey').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: { publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhki...\n-----END PUBLIC KEY-----' },
      });

      renderWithProviders(<MfaCryptoTab />);

      await waitFor(() => {
        expect(screen.getByText('Enrolled & Active')).toBeDefined();
        expect(screen.getByText(/BEGIN PUBLIC KEY/)).toBeDefined();
      });

      // Open Re-verify Session modal
      const reverifyBtn = screen.getByRole('button', { name: /Re-Verify Session/i });
      fireEvent.click(reverifyBtn);
      expect(screen.getByText('Re-verify Authenticated MFA Session')).toBeDefined();
    });
  });

  describe('ConfigTab Enhanced Component', () => {
    it('renders 11 modular sections and cache stats telemetry', async () => {
      vi.spyOn(configApi, 'list').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: [{ key: 'ACTIVE_PAYMENT_GATEWAY', value: 'STRIPE', target: 'BACKEND' }],
      });

      vi.spyOn(configApi, 'getSectionsSummary').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: {
          tenant: { multiTenancyEnabled: true },
          iam: { mfaEnabled: true },
          'white-label': { brandName: 'Apex Health' },
        },
      });

      vi.spyOn(configApi, 'getCacheStats').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: { hits: 1500, misses: 50, size: 45, hitRate: 0.967 },
      });

      renderWithProviders(<ConfigTab />);

      await waitFor(() => {
        expect(screen.getByText('1500')).toBeDefined();
        expect(screen.getByText('ACTIVE_PAYMENT_GATEWAY')).toBeDefined();
        expect(screen.getByText('Multi-Tenant')).toBeDefined();
        expect(screen.getByText('White-Label Branding')).toBeDefined();
      });

      // Open Context Token modal
      const tokenBtn = screen.getByRole('button', { name: /Context Token/i });
      fireEvent.click(tokenBtn);
      expect(screen.getByText('Generate Encrypted PII Context Token')).toBeDefined();
    });
  });

  describe('NotificationsTab Enhanced Component', () => {
    it('renders provider routing, sent history, and batch modal', async () => {
      vi.spyOn(notificationsApi, 'list').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: [
          {
            id: 'notif_1',
            recipient: 'doctor@apex.health',
            channel: 'EMAIL',
            subject: 'Emergency Alert',
            body: 'Code Blue in Ward 4',
            status: 'SENT',
            isDryRun: true,
            createdAt: '2026-11-14T00:00:00Z',
          },
        ],
      });

      vi.spyOn(notificationsApi, 'getProviderConfig').mockResolvedValue({
        status: 200,
        message: 'Success',
        data: { defaultChannelRouting: { EMAIL: 'SENDGRID', SMS: 'TWILIO' } },
      });

      renderWithProviders(<NotificationsTab />);

      await waitFor(() => {
        expect(screen.getByText('doctor@apex.health')).toBeDefined();
        expect(screen.getByText('Emergency Alert')).toBeDefined();
      });

      // Open Batch Dispatch modal
      const batchBtn = screen.getByRole('button', { name: /Batch Dispatch/i });
      fireEvent.click(batchBtn);
      expect(screen.getByText('High-Throughput Batch Notification Dispatch')).toBeDefined();

      // Open Simulate Webhook modal
      const webhookBtn = screen.getByRole('button', { name: /Simulate Webhook/i });
      fireEvent.click(webhookBtn);
      expect(screen.getByText('Simulate Provider Webhook Callback')).toBeDefined();
    });
  });

  describe('ApiExplorerPage All Tabs Navigation', () => {
    it('renders all 11 tabs and smoothly switches between tabs', async () => {
      renderWithProviders(<ApiExplorerPage />);

      expect(screen.getByText('Organizations CRUD')).toBeDefined();
      expect(screen.getByText('Dynamic Config CRUD')).toBeDefined();
      expect(screen.getByText('RBAC Roles CRUD')).toBeDefined();
      expect(screen.getByText(/Notifications & Outbox/i)).toBeDefined();
      expect(screen.getByText('Orders CRUD')).toBeDefined();
      expect(screen.getByText('Inventory CRUD')).toBeDefined();
      expect(screen.getByText('Assets CRUD')).toBeDefined();
      expect(screen.getByText('Transactions CRUD')).toBeDefined();
      expect(screen.getByText('Scheduler CRUD')).toBeDefined();
      expect(screen.getByText(/MFA & Cryptographic Keys/i)).toBeDefined();
      expect(screen.getByText('Tenant Data Records')).toBeDefined();

      // Click Orders CRUD tab
      const ordersTabBtn = screen.getByRole('tab', { name: /Orders CRUD/i });
      fireEvent.click(ordersTabBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Order/i })).toBeDefined();
      });

      // Click Inventory CRUD tab
      const invTabBtn = screen.getByRole('tab', { name: /Inventory CRUD/i });
      fireEvent.click(invTabBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Stock/i })).toBeDefined();
      });

      // Click Assets CRUD tab
      const assetsTabBtn = screen.getByRole('tab', { name: /Assets CRUD/i });
      fireEvent.click(assetsTabBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Register Asset/i })).toBeDefined();
      });

      // Click Transactions CRUD tab
      const txnTabBtn = screen.getByRole('tab', { name: /Transactions CRUD/i });
      fireEvent.click(txnTabBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Initiate Payment/i })).toBeDefined();
      });

      // Click Scheduler CRUD tab
      const schedTabBtn = screen.getByRole('tab', { name: /Scheduler CRUD/i });
      fireEvent.click(schedTabBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Register Job/i })).toBeDefined();
      });

      // Click MFA & Cryptographic Keys tab
      const mfaTabBtn = screen.getByRole('tab', { name: /MFA & Cryptographic Keys/i });
      fireEvent.click(mfaTabBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Re-Verify Session/i })).toBeDefined();
      });
    });
  });
});
