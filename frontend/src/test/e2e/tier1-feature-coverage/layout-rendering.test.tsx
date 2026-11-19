import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import '../../../core/i18n';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockTenantAdmin } from '../../fixtures/authFixtures';

describe('Tier 1: Layout Architecture, Header Controls & Dynamic Branding', () => {
  it('renders standard AppLayout shell with topbar, search, and action buttons', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Topbar brand and status pill
    const brandElements = await screen.findAllByText('Apex Health Systems');
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
    const industryPills = screen.getAllByText('HEALTHCARE');
    expect(industryPills.length).toBeGreaterThanOrEqual(1);

    // Global search bar
    expect(screen.getByPlaceholderText('Search portal, entities, docs...')).toBeInTheDocument();

    // Header utility buttons
    expect(screen.getByRole('button', { name: /API Traffic Inspector/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Documentation/i })).toBeInTheDocument();
  });

  it('renders workspace switcher card showing current tenant in sidebar', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    expect(await screen.findByText('Workspace & Operations')).toBeInTheDocument();
    const workspaceCards = screen.getAllByText('Apex Health Systems');
    expect(workspaceCards.length).toBeGreaterThanOrEqual(1);
  });

  it('renders enterprise footer with legal copyright and compliance links', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    expect(await screen.findByText(/Apex Clinical Innovations Inc\./i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Support/i })).toHaveAttribute(
      'href',
      'https://apexhealth.demo/support'
    );
    expect(screen.getByRole('link', { name: /Terms/i })).toHaveAttribute(
      'href',
      'https://apexhealth.demo/terms'
    );
    expect(screen.getByRole('link', { name: /Privacy/i })).toHaveAttribute(
      'href',
      'https://apexhealth.demo/privacy'
    );
  });

  it('dynamically adapts branding, legal name, and industry for Nexus Logistics tenant', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: {
        ...mockTenantAdmin,
        tenantId: 'ten_nexus_logistics_02',
        tenantSlug: 'nexus-logistics',
      },
      initialTenantSlug: 'nexus-logistics',
    });

    // Verifies tenant dynamic replacement
    const brandElements = await screen.findAllByText('Nexus Fleet Logistics');
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
    const industryPills = screen.getAllByText('LOGISTICS');
    expect(industryPills.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Nexus Global Freight Transport Ltd\./i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Support/i })).toHaveAttribute(
      'href',
      'https://nexuslogistics.demo/help'
    );
  });

  it('renders contextual breadcrumb navigation trail across deep pages', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    const breadcrumbNavs = await screen.findAllByRole('navigation', { name: /Breadcrumb/i });
    expect(breadcrumbNavs.length).toBeGreaterThanOrEqual(1);
    const pageBreadcrumb =
      breadcrumbNavs.find((b) => b.textContent?.includes('Dynamic Entity Explorer')) || breadcrumbNavs[0]!;
    expect(pageBreadcrumb).toHaveTextContent('Workspace');
    expect(pageBreadcrumb).toHaveTextContent('Dynamic Entity Explorer');
  });
});
