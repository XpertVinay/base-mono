import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../core/i18n';
import { TenantContext } from '../core/tenant/TenantContext';
import { DEFAULT_TENANT, DEMO_TENANTS } from '../core/tenant/registry';
import { useAuthStore } from '../core/auth/authStore';
import { SidebarNav } from '../components/navigation/SidebarNav';

function renderSidebarNav(initialEntries = ['/']) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TenantContext.Provider
        value={{
          tenant: DEFAULT_TENANT,
          tenantSlug: DEFAULT_TENANT.identity.slug,
          status: 'resolved',
          availableTenants: Object.values(DEMO_TENANTS),
          switchTenant: vi.fn(),
          isFeatureEnabled: () => true,
        }}
      >
        <MemoryRouter initialEntries={initialEntries}>
          <SidebarNav />
        </MemoryRouter>
      </TenantContext.Provider>
    </I18nextProvider>
  );
}

describe('SidebarNav Component & Grouped RBAC Layout', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: {
        id: 'usr_admin_1',
        email: 'admin@apexhealth.demo',
        name: 'Dr. Sarah Connor',
        role: 'ADMIN',
        tenantId: 'ten_apex_health_01',
      },
      token: 'mock_token',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('renders all grouped navigation menus for ADMIN role', () => {
    renderSidebarNav();

    // Verify Group Headers
    expect(screen.getByText(/Organization Management/i)).toBeInTheDocument();
    expect(screen.getByText(/User Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Role Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();

    // Verify Admin Items are visible
    expect(screen.getByText(/Tenants & Multi-Tenancy/i)).toBeInTheDocument();
    expect(screen.getByText(/OIDC \/ SAML Providers/i)).toBeInTheDocument();
    expect(screen.getByText(/Feature Modules/i)).toBeInTheDocument();
  });

  it('collapses and expands a group when clicking its header', () => {
    renderSidebarNav();

    const orgHeader = screen.getByRole('button', { name: /Organization Management/i });
    expect(orgHeader).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    fireEvent.click(orgHeader);
    expect(orgHeader).toHaveAttribute('aria-expanded', 'false');

    // Click to expand again
    fireEvent.click(orgHeader);
    expect(orgHeader).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides Role Management group and Admin items when switching to standard USER role', () => {
    renderSidebarNav();

    // Switch role to USER using the interactive role preview simulator
    const userRoleBtn = screen.getByRole('button', { name: /^USER$/i });
    fireEvent.click(userRoleBtn);

    // After switching to USER role:
    // Role Management should not be present
    expect(screen.queryByText(/Role Management/i)).not.toBeInTheDocument();

    // Admin-only items should not be present
    expect(screen.queryByText(/Tenants & Multi-Tenancy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/OIDC \/ SAML Providers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Feature Modules/i)).not.toBeInTheDocument();

    // But User Management and Settings should remain accessible
    expect(screen.getByText(/User Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();
  });

  it('highlights the specific tab-based nav item on /iam?tab=tenants', () => {
    renderSidebarNav(['/iam?tab=tenants']);

    const tenantsLink = screen.getByText(/Tenants & Multi-Tenancy/i).closest('a');
    expect(tenantsLink).toHaveAttribute('href', '/iam?tab=tenants');

    const profileLink = screen.getByText(/User Directory/i).closest('a');
    expect(profileLink).toHaveAttribute('href', '/iam?tab=profile');
  });
});

