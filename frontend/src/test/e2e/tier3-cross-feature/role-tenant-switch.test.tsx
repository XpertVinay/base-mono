import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockTenantAdmin } from '../../fixtures/authFixtures';

describe('Tier 3: Pairwise Combinations — Role Simulator & Multi-Tenant Switching', () => {
  it('switches tenant dynamically via Header TenantSwitcher and updates branding across shell', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Verify initial Apex Health branding
    expect(await screen.findByText('Apex Health Systems')).toBeInTheDocument();
    expect(screen.getByText('HEALTHCARE')).toBeInTheDocument();

    // Trigger TenantSwitcher dropdown in Header
    const switcherBtn = screen.getByRole('button', { name: /Switch Workspace \/ Tenant/i });
    expect(switcherBtn).toBeInTheDocument();
    fireEvent.click(switcherBtn);

    // Find and select Nexus Fleet Logistics option
    const nexusOption = await screen.findByRole('option', { name: /Nexus Fleet Logistics/i });
    expect(nexusOption).toBeInTheDocument();
    fireEvent.click(nexusOption);

    // Header and footer must immediately reflect Nexus Fleet Logistics
    await waitFor(() => {
      expect(screen.getByText('Nexus Fleet Logistics')).toBeInTheDocument();
      expect(screen.getByText('LOGISTICS')).toBeInTheDocument();
      expect(screen.getByText(/Nexus Global Freight Transport Ltd\./i)).toBeInTheDocument();
    });
  });

  it('interactively toggles RBAC roles via Header RoleSwitcher simulator and dynamically updates navigation tree', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Initially Admin: all admin links visible
    expect(await screen.findByText('Tenants & Multi-Tenancy')).toBeInTheDocument();
    expect(screen.getByText('OIDC / SAML Providers')).toBeInTheDocument();
    expect(screen.getByText('Feature Modules')).toBeInTheDocument();

    // 1. Click RoleSwitcher trigger in Header and switch to SUPPORT
    const roleSwitcherTrigger = screen.getByRole('button', { name: /Simulate Role Preview/i });
    fireEvent.click(roleSwitcherTrigger);

    const supportOption = await screen.findByRole('option', { name: /Support/i });
    fireEvent.click(supportOption);

    // Dynamic update: Admin links hide, Support links stay
    await waitFor(() => {
      expect(screen.queryByText('Tenants & Multi-Tenancy')).not.toBeInTheDocument();
      expect(screen.queryByText('OIDC / SAML Providers')).not.toBeInTheDocument();
      expect(screen.queryByText('Feature Modules')).not.toBeInTheDocument();
      expect(screen.getByText('User Directory')).toBeInTheDocument();
      expect(screen.getByText('Audit & Observability')).toBeInTheDocument();
    });

    // 2. Click RoleSwitcher trigger and switch to CUSTOMER
    fireEvent.click(screen.getByRole('button', { name: /Simulate Role Preview/i }));
    const customerOption = await screen.findByRole('option', { name: /Customer/i });
    fireEvent.click(customerOption);

    // Dynamic update: User Directory and Audit also hide
    await waitFor(() => {
      expect(screen.queryByText('User Directory')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit & Observability')).not.toBeInTheDocument();
      expect(screen.queryByText('Roles & Permissions')).not.toBeInTheDocument();
      // Basic workspace remains accessible
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // 3. Re-elevate to TENANT_ADMIN simulation
    fireEvent.click(screen.getByRole('button', { name: /Simulate Role Preview/i }));
    const adminOption = await screen.findByRole('option', { name: /Tenant Admin/i });
    fireEvent.click(adminOption);

    // Full admin menu restored
    await waitFor(() => {
      expect(screen.getByText('Tenants & Multi-Tenancy')).toBeInTheDocument();
      expect(screen.getByText('OIDC / SAML Providers')).toBeInTheDocument();
      expect(screen.getByText('Feature Modules')).toBeInTheDocument();
    });
  });

  it('simultaneously changes active tenant and simulates role downgrade without crashing', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // 1. Switch to Aura Fintech via TenantSwitcher
    const switcherBtn = await screen.findByRole('button', { name: /Switch Workspace \/ Tenant/i });
    fireEvent.click(switcherBtn);

    const auraOption = await screen.findByRole('option', { name: /Aura Digital Capital/i });
    fireEvent.click(auraOption);

    await waitFor(() => {
      expect(screen.getByText('Aura Digital Capital')).toBeInTheDocument();
      expect(screen.getByText('FINTECH')).toBeInTheDocument();
    });

    // 2. Toggle role to CUSTOMER via RoleSwitcher
    const roleBtn = screen.getByRole('button', { name: /Simulate Role Preview/i });
    fireEvent.click(roleBtn);

    const customerOption = await screen.findByRole('option', { name: /Customer/i });
    fireEvent.click(customerOption);

    // Aura branding persists, and navigation is customer-scoped
    await waitFor(() => {
      expect(screen.getByText('Aura Digital Capital')).toBeInTheDocument();
      expect(screen.queryByText('Tenants & Multi-Tenancy')).not.toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
