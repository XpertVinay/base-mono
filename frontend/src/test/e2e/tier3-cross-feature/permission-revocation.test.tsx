import { describe, it, expect } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { useAuthStore } from '../../../core/auth/authStore';
import { mockTenantAdmin } from '../../fixtures/authFixtures';

describe('Tier 3: Mid-Session Permission Revocation & State Demotion', () => {
  it('dynamically demotes user permissions mid-session and hides privileged navigation links', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Initially Admin: has access to Admin management items
    expect(await screen.findByText('Tenants & Multi-Tenancy')).toBeInTheDocument();
    expect(screen.getByText('OIDC / SAML Providers')).toBeInTheDocument();

    // Simulate mid-session permission revocation (e.g., token downgrade or admin revocation)
    act(() => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setUser({
          ...currentUser,
          role: 'USER',
        });
      }
    });

    // Privileged links should immediately disappear from DOM
    await waitFor(() => {
      expect(screen.queryByText('Tenants & Multi-Tenancy')).not.toBeInTheDocument();
      expect(screen.queryByText('OIDC / SAML Providers')).not.toBeInTheDocument();
      expect(screen.queryByText('User Directory')).not.toBeInTheDocument();
    });
  });

  it('triggers immediate redirect to /login when session is revoked or logout is executed', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Confirm authenticated records page is loaded
    expect(await screen.findByText('Record Title')).toBeInTheDocument();

    // Revoke session via logout
    await act(async () => {
      await useAuthStore.getState().logout({ allSessions: true });
    });

    // Should immediately transition to /login
    await waitFor(() => {
      expect(screen.getByText('Single Sign-On Enforced')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /New Record/i })).not.toBeInTheDocument();
    });
  });

  it('blocks access if user session tenant binding is revoked to an incompatible tenant', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin, // initially ten_apex_health_01 on apex-health
      initialTenantSlug: 'apex-health',
    });

    expect(await screen.findByText('Record Title')).toBeInTheDocument();

    // Modify user tenantId to another tenant mid-session
    act(() => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setUser({
          ...currentUser,
          tenantId: 'ten_nexus_logistics_02',
          tenantSlug: 'nexus-logistics',
        });
      }
    });

    // ProtectedRoute detects cross-tenant mismatch and redirects
    await waitFor(() => {
      expect(screen.getByText('Single Sign-On Enforced')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /New Record/i })).not.toBeInTheDocument();
    });
  });
});
