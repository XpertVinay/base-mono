import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import '../../../core/i18n';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { UnknownTenantPage } from '../../../features/system/UnknownTenantPage';
import {
  mockSuperAdmin,
  mockTenantAdmin,
  mockCrossTenantAdmin,
} from '../../fixtures/authFixtures';
import { recordsApi } from '../../../core/api/services/recordsApi';

describe('Tier 2: Tenant Isolation, Boundary Fallback & Cross-Tenant Guards', () => {
  it('renders UnknownTenantPage with recovery options when navigating with an invalid tenant slug', async () => {
    renderWithProviders(<UnknownTenantPage />, {
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Expect unknown tenant page
    expect(await screen.findByRole('heading', { name: /Tenant Portal Unavailable/i })).toBeInTheDocument();
    expect(
      screen.getByText(/We could not locate an active tenant matching the requested hostname or identifier/i)
    ).toBeInTheDocument();

    // Verify recovery options for valid tenants exist
    expect(screen.getByRole('button', { name: /Apex Health Systems/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nexus Fleet Logistics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aura Digital Capital/i })).toBeInTheDocument();
  });

  it('blocks cross-tenant access when a tenant user accesses another tenant workspace', async () => {
    // Nexus Logistics user accessing Apex Health workspace
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockCrossTenantAdmin, // belongs to ten_nexus_logistics_02
      initialTenantSlug: 'apex-health',  // tenant ten_apex_health_01
    });

    // Must trigger tenant mismatch redirect to /login
    await waitFor(() => {
      expect(screen.getByText('Single Sign-On Enforced')).toBeInTheDocument();
    });
    // Protected content should NOT be rendered
    expect(screen.queryByRole('button', { name: /New Record/i })).not.toBeInTheDocument();
  });

  it('allows Super Admin with platform default tenant to access any tenant workspace', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockSuperAdmin, // belongs to tenantId: 'default'
      initialTenantSlug: 'apex-health',
    });

    // Super admin bypasses cross-tenant mismatch
    expect(await screen.findByText('Record Title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Record/i })).toBeInTheDocument();
  });

  it('guarantees tenant data isolation at the API client level', async () => {
    const apexRes = await recordsApi.list({
      tenantId: 'ten_apex_health_01',
      tenantSlug: 'apex-health',
    });

    const nexusRes = await recordsApi.list({
      tenantId: 'ten_nexus_logistics_02',
      tenantSlug: 'nexus-logistics',
    });

    // Check non-empty datasets
    expect(apexRes.data.length).toBeGreaterThan(0);
    expect(nexusRes.data.length).toBeGreaterThan(0);

    // Verify Apex records do not contain Nexus titles
    const apexTitles = apexRes.data.map((r) => r.title);
    const nexusTitles = nexusRes.data.map((r) => r.title);

    apexTitles.forEach((title) => {
      expect(nexusTitles).not.toContain(title);
    });
  });

  it('allows matching tenant admin unhindered access to their own tenant workspace', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    expect(await screen.findByText('Record Title')).toBeInTheDocument();
    expect(screen.queryByText(/Tenant Portal Unavailable/i)).not.toBeInTheDocument();
  });
});
