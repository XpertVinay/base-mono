import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import '../../../core/i18n';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockTenantAdmin } from '../../fixtures/authFixtures';

describe('Tier 2: Empty States, Zero Search Results & 404 Fallbacks', () => {
  it('displays empty state illustration and message when search query yields zero matches', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    const mainArea = await screen.findByRole('main');
    const searchInput = within(mainArea).getByPlaceholderText('Search...');
    expect(searchInput).toBeInTheDocument();

    // Type a search string that cannot match any record
    fireEvent.change(searchInput, { target: { value: 'zzzz_unmatched_record_9999' } });

    // Empty state should be rendered
    await waitFor(() => {
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });
    // Table rows should be gone
    expect(screen.queryByTitle('Edit Record')).not.toBeInTheDocument();
  });

  it('renders 404 NotFoundPage when navigating to an undefined application route', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/an-invalid-and-nonexistent-subpath-999',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // 404 page presentation
    expect(await screen.findByRole('heading', { name: /Page Not Found/i })).toBeInTheDocument();
    expect(
      screen.getByText(/The page or entity you requested does not exist or has been relocated within the service catalog\./i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Return to Dashboard/i })).toBeInTheDocument();
  });

  it('navigates back to home dashboard when clicking Return to Dashboard on 404 page', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/unknown-route-deep-404',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    const returnDashboardBtn = await screen.findByRole('button', { name: /Return to Dashboard/i });
    fireEvent.click(returnDashboardBtn);

    // Dashboard page renders
    await waitFor(() => {
      expect(screen.getAllByText('HEALTHCARE')[0]).toBeInTheDocument();
      expect(screen.getByText(/Unified operational metrics and live telemetry/i)).toBeInTheDocument();
    });
  });

  it('restores table records when clearing the unmatched search query', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    const mainArea = await screen.findByRole('main');
    const searchInput = within(mainArea).getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'zzzz_no_match' } });

    await waitFor(() => {
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByText('No records found')).not.toBeInTheDocument();
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });
  });

  it('renders zero captured calls initially in telemetry state without crashing', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    const trafficBtn = await screen.findByRole('button', { name: /API Traffic Inspector/i });
    expect(trafficBtn).toBeInTheDocument();
  });
});
