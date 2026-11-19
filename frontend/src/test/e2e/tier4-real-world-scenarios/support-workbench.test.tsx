import { describe, it, expect } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockSupportUser } from '../../fixtures/authFixtures';

describe('Tier 4: Persona Scenario — Support Specialist Troubleshooting Workbench', () => {
  it('executes support workflow: profile verification -> records diagnostic -> audit telemetry -> zero admin leakage', async () => {
    // 1. Support user logs in and inspects permissions
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/iam?tab=profile',
      currentUser: mockSupportUser,
      initialTenantSlug: 'apex-health',
    });

    // Verify role identity is SUPPORT
    expect(await screen.findByText('support@apexhealth.demo')).toBeInTheDocument();
    expect(screen.getByText('Apex Support Specialist')).toBeInTheDocument();
    expect(screen.getAllByText(/SUPPORT/i).length).toBeGreaterThan(0);

    // Verify admin-only IAM tabs are NOT rendered for Support
    expect(screen.queryByText('Multi-Tenancy & Policies')).not.toBeInTheDocument();
    expect(screen.queryByText('OIDC / SAML Admin')).not.toBeInTheDocument();

    // 2. Client-side navigate to Data Records via sidebar link for operational diagnostic
    const recordsLink = screen.getByRole('link', { name: /Data Records/i });
    fireEvent.click(recordsLink);

    // Inspect records list
    expect(await screen.findByText('Record Title')).toBeInTheDocument();
    const mainArea = screen.getByRole('main');
    const searchInput = within(mainArea).getByPlaceholderText('Search...');
    expect(searchInput).toBeInTheDocument();

    // Search for existing record to diagnose
    fireEvent.change(searchInput, { target: { value: 'ICU' } });

    await waitFor(() => {
      expect(screen.getByText(/ICU Telemetry Monitoring/i)).toBeInTheDocument();
    });

    // 3. Client-side navigate to Audit & Security Observability via sidebar link
    const auditLink = screen.getByRole('link', { name: /Audit & Observability/i });
    fireEvent.click(auditLink);

    await waitFor(() => {
      expect(screen.getByText(/Audit Trails & Observability Shield/i)).toBeInTheDocument();
      expect(screen.getByText(/Observability Live/i)).toBeInTheDocument();
    });

    // 4. Verify ZERO administrative leakage: Admin-only controls must NOT be present
    expect(screen.queryByText('Tenants & Multi-Tenancy')).not.toBeInTheDocument();
    expect(screen.queryByText('OIDC / SAML Providers')).not.toBeInTheDocument();
    expect(screen.queryByText('Feature Modules')).not.toBeInTheDocument();
  });
});
