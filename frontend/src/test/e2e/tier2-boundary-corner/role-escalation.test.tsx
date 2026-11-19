import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { ProtectedRoute } from '../../../core/auth/ProtectedRoute';
import {
  mockSuperAdmin,
  mockTenantAdmin,
  mockSupportUser,
  mockCustomerUser,
} from '../../fixtures/authFixtures';

describe('Tier 2: Role Escalation & RBAC Boundary Enforcement', () => {
  it('blocks Customer / User from admin-gated routes with Access Denied view', async () => {
    renderWithProviders(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <div>Confidential Platform Admin Console</div>
      </ProtectedRoute>,
      {
        currentUser: mockCustomerUser,
        initialTenantSlug: 'apex-health',
      }
    );

    expect(await screen.findByRole('heading', { name: /Access Denied/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Your account role \(USER\) does not have permission/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Confidential Platform Admin Console')).not.toBeInTheDocument();
  });

  it('blocks Support Specialist from Admin-only gated routes', async () => {
    renderWithProviders(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <div>Tenant Encryption Key Vault</div>
      </ProtectedRoute>,
      {
        currentUser: mockSupportUser,
        initialTenantSlug: 'apex-health',
      }
    );

    expect(await screen.findByRole('heading', { name: /Access Denied/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Your account role \(SUPPORT\) does not have permission/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Tenant Encryption Key Vault')).not.toBeInTheDocument();
  });

  it('permits Tenant Admin to access Admin-gated route', async () => {
    renderWithProviders(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <div>Tenant Admin Policy Management</div>
      </ProtectedRoute>,
      {
        currentUser: mockTenantAdmin,
        initialTenantSlug: 'apex-health',
      }
    );

    expect(await screen.findByText('Tenant Admin Policy Management')).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
  });

  it('permits Support and Admin to access multi-role guarded views', async () => {
    renderWithProviders(
      <ProtectedRoute allowedRoles={['SUPPORT', 'ADMIN']}>
        <div>Operations Troubleshooting & Diagnostics</div>
      </ProtectedRoute>,
      {
        currentUser: mockSupportUser,
        initialTenantSlug: 'apex-health',
      }
    );

    expect(await screen.findByText('Operations Troubleshooting & Diagnostics')).toBeInTheDocument();
  });

  it('permits Super Admin platform-wide access across administrative boundaries', async () => {
    renderWithProviders(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <div>Global Multi-Tenancy Orchestrator</div>
      </ProtectedRoute>,
      {
        currentUser: mockSuperAdmin,
        initialTenantSlug: 'apex-health',
      }
    );

    expect(await screen.findByText('Global Multi-Tenancy Orchestrator')).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
  });
});
