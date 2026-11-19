import { describe, it, expect } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockCustomerUser } from '../../fixtures/authFixtures';

describe('Tier 4: Persona Scenario — Customer Self-Service Portal Journey', () => {
  it('executes customer flow: dashboard -> self-service records submission -> session management -> clean sign out', async () => {
    // 1. Customer logs in and views tenant portal dashboard
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockCustomerUser,
      initialTenantSlug: 'apex-health',
    });

    // Verify dashboard renders
    expect((await screen.findAllByText('HEALTHCARE'))[0]).toBeInTheDocument();
    expect(
      screen.getByText('Apex Health Systems — Unified operational metrics and live telemetry')
    ).toBeInTheDocument();

    // Verify Customer role boundaries DURING active session (before logout)
    expect(screen.queryByText('Tenants & Multi-Tenancy')).not.toBeInTheDocument();
    expect(screen.queryByText('OIDC / SAML Providers')).not.toBeInTheDocument();
    expect(screen.queryByText('Feature Modules')).not.toBeInTheDocument();
    expect(screen.queryByText('User Directory')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit & Observability')).not.toBeInTheDocument();

    // 2. Client-side navigate to Records to submit self-service service intake via sidebar link
    const recordsLink = screen.getByRole('link', { name: /Data Records/i });
    fireEvent.click(recordsLink);

    expect(await screen.findByText('Record Title')).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /New Record/i });
    fireEvent.click(addBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const categoryInput = screen.getByPlaceholderText(/Critical Care/i);
    const amountInput = screen.getByLabelText(/Valuation \/ Cost/i);

    const clientRequestTitle = `Outpatient Telehealth Consultation #${Date.now().toString(36)}`;
    fireEvent.change(titleInput, { target: { value: clientRequestTitle } });
    fireEvent.change(categoryInput, { target: { value: 'Consultation' } });
    fireEvent.change(amountInput, { target: { value: '150' } });

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    // Verifies service record is recorded and displayed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(clientRequestTitle)).toBeInTheDocument();
    });

    // 3. Client-side navigate to SSO Sessions via sidebar link and trigger sign out
    const sessionsLink = screen.getByRole('link', { name: /Active SSO Sessions/i });
    fireEvent.click(sessionsLink);

    const signOutBtn = await screen.findByRole('button', { name: /SLO Sign Out/i });
    expect(signOutBtn).toBeInTheDocument();
    fireEvent.click(signOutBtn);

    // Sign out directs customer safely back to Login screen
    await waitFor(() => {
      expect(screen.getByText('Single Sign-On Enforced')).toBeInTheDocument();
    });

    // 4. Verify Customer has zero access to admin sections after logout
    expect(screen.queryByText('Tenants & Multi-Tenancy')).not.toBeInTheDocument();
    expect(screen.queryByText('OIDC / SAML Providers')).not.toBeInTheDocument();
    expect(screen.queryByText('Feature Modules')).not.toBeInTheDocument();
  });
});
