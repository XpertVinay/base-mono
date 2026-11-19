import { describe, it, expect } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockSuperAdmin } from '../../fixtures/authFixtures';

describe('Tier 4: Persona Scenario — Super Admin Platform Oversight Journey', () => {
  it('executes end-to-end platform oversight: dashboard telemetry -> multi-tenancy policies -> audit stream', async () => {
    // 1. Super Admin logs in and opens platform dashboard
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockSuperAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Verify platform overview dashboard renders
    expect(await screen.findByText('HEALTHCARE')).toBeInTheDocument();
    expect(screen.getByText(/Tenant ID: ten_apex_health_01/i)).toBeInTheDocument();
    expect(screen.getByText(/Unified operational metrics and live telemetry/i)).toBeInTheDocument();

    // 2. Client-side navigate to IAM Multi-Tenancy Control Plane via sidebar link
    const iamLink = screen.getByRole('link', { name: /Tenants & Multi-Tenancy/i });
    fireEvent.click(iamLink);

    // Verify Multi-Tenancy & Policies view renders for Super Admin
    expect(
      await screen.findByRole('heading', { name: /Authentication, Authorization & SSO Control Plane/i })
    ).toBeInTheDocument();

    const tenantsTab = screen.getByRole('tab', { name: /Multi-Tenancy & Policies/i });
    expect(tenantsTab).toBeInTheDocument();
    fireEvent.click(tenantsTab);

    // Verify Multi-Tenancy runtime configuration card
    expect(await screen.findByText('Multi-Tenancy Runtime Config')).toBeInTheDocument();

    // Verify Super Admin can view multi-tenant onboarding controls
    expect(screen.getByText(/Platform Admin: Onboard Tenant/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/globex/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Onboard Tenant/i })).toBeInTheDocument();

    // 3. Client-side navigate to Governance & Audit Stream via sidebar link
    const auditLink = screen.getByRole('link', { name: /Audit & Observability/i });
    fireEvent.click(auditLink);

    // Verify Audit & Observability is accessible
    await waitFor(() => {
      expect(screen.getByText(/Audit Trails & Observability Shield/i)).toBeInTheDocument();
      expect(screen.getByText(/Observability Live/i)).toBeInTheDocument();
    });
  });
});
