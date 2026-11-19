import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockTenantAdmin, mockCrossTenantAdmin } from '../../fixtures/authFixtures';

describe('Tier 4: Persona Scenario — Tenant Admin Management Journey', () => {
  it('executes end-to-end tenant admin journey: settings profile -> IAM directory -> tenant CRUD operations', async () => {
    // 1. Tenant Admin inspects organization settings
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/settings',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Check organization settings renders Profile Settings
    expect(await screen.findByRole('heading', { name: /Profile Settings/i })).toBeInTheDocument();
    expect(screen.getByText(/Apex Health Systems/i)).toBeInTheDocument();

    // 2. Client-side navigate to IAM User Directory & Permissions tab via sidebar link
    const iamDirectoryLink = screen.getByRole('link', { name: /User Directory/i });
    fireEvent.click(iamDirectoryLink);

    // Verify IAM Control Plane renders
    expect(
      await screen.findByRole('heading', { name: /Authentication, Authorization & SSO Control Plane/i })
    ).toBeInTheDocument();

    // Verify Profile, JWT & RBAC tab and Authenticated IAM Profile card
    expect(screen.getByRole('tab', { name: /Profile, JWT & RBAC/i })).toBeInTheDocument();
    expect(await screen.findByText('Authenticated IAM Profile')).toBeInTheDocument();
    expect(screen.getByText('admin@apexhealth.demo')).toBeInTheDocument();
    expect(screen.getByText('Apex Tenant Admin')).toBeInTheDocument();

    // Verify RBAC Authorization Matrix is present
    expect(screen.getByText('RBAC Authorization Matrix')).toBeInTheDocument();

    // 3. Client-side navigate to Records Management via sidebar link
    const recordsLink = screen.getByRole('link', { name: /Data Records/i });
    fireEvent.click(recordsLink);

    expect(await screen.findByText('Record Title')).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /New Record/i });
    fireEvent.click(addBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const categoryInput = screen.getByPlaceholderText(/Critical Care/i);
    const amountInput = screen.getByLabelText(/Valuation \/ Cost/i);

    const recordTitle = `Critical Cardiology Assessment #${Date.now().toString(36)}`;
    fireEvent.change(titleInput, { target: { value: recordTitle } });
    fireEvent.change(categoryInput, { target: { value: 'Cardiology' } });
    fireEvent.change(amountInput, { target: { value: '3800' } });

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    // Record created and rendered
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(recordTitle)).toBeInTheDocument();
    });
  });

  it('strictly blocks cross-tenant boundary tampering between distinct tenant administrators', async () => {
    // Nexus admin attempting to access Apex Health tenant
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockCrossTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Blocked and redirected to /login
    await waitFor(() => {
      expect(screen.getByText('Single Sign-On Enforced')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /New Record/i })).not.toBeInTheDocument();
  });
});
