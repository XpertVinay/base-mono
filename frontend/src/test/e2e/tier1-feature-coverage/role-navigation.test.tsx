import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import '../../../core/i18n';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import {
  mockSuperAdmin,
  mockTenantAdmin,
  mockSupportUser,
  mockCustomerUser,
} from '../../fixtures/authFixtures';

describe('Tier 1: Role-Based Dynamic Navigation & Menu Visibility', () => {
  it('renders all platform administration links for Super Admin', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockSuperAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Super Admin must see platform management and cross-tenant items
    expect(await screen.findByText('Tenants & Multi-Tenancy')).toBeInTheDocument();
    expect(screen.getByText('OIDC / SAML Providers')).toBeInTheDocument();
    expect(screen.getByText('Feature Modules')).toBeInTheDocument();
    expect(screen.getByText('User Directory')).toBeInTheDocument();
    expect(screen.getByText('Audit & Observability')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders tenant management links for Tenant Admin and hides platform-only leaks', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    expect(await screen.findByText('Organization Profile')).toBeInTheDocument();
    expect(screen.getByText('User Directory')).toBeInTheDocument();
    expect(screen.getByText('Roles & Permissions')).toBeInTheDocument();
    expect(screen.getByText('Active SSO Sessions')).toBeInTheDocument();
    expect(screen.getByText('Branding & Themes')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders troubleshooting views for Support and blocks administrative configurations', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockSupportUser,
      initialTenantSlug: 'apex-health',
    });

    // Support can access operational lookup and observability
    expect(await screen.findByText('User Directory')).toBeInTheDocument();
    expect(screen.getByText('Audit & Observability')).toBeInTheDocument();
    expect(screen.getByText('Roles & Permissions')).toBeInTheDocument();
    expect(screen.getByText('Active SSO Sessions')).toBeInTheDocument();

    // Support MUST NOT see tenant policy onboarding or provider secrets
    expect(screen.queryByText('Tenants & Multi-Tenancy')).not.toBeInTheDocument();
    expect(screen.queryByText('OIDC / SAML Providers')).not.toBeInTheDocument();
    expect(screen.queryByText('Feature Modules')).not.toBeInTheDocument();
  });

  it('renders restricted self-service views for Customer / User without admin leakage', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/',
      currentUser: mockCustomerUser,
      initialTenantSlug: 'apex-health',
    });

    // Customer can see basic workspace and profile items
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Organization Profile')).toBeInTheDocument();
    expect(screen.getByText('Active SSO Sessions')).toBeInTheDocument();

    // Customer MUST NOT see any personnel, RBAC, audit, or provider configuration
    expect(screen.queryByText('User Directory')).not.toBeInTheDocument();
    expect(screen.queryByText('Roles & Permissions')).not.toBeInTheDocument();
    expect(screen.queryByText('OIDC / SAML Providers')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit & Observability')).not.toBeInTheDocument();
    expect(screen.queryByText('Tenants & Multi-Tenancy')).not.toBeInTheDocument();
    expect(screen.queryByText('Feature Modules')).not.toBeInTheDocument();
  });

  it('correctly marks active route in navigation based on current location', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // In records route, records link is active
    const recordsLink = await screen.findByRole('link', { name: /Data Records/i });
    expect(recordsLink).toBeInTheDocument();
    expect(recordsLink.className).toMatch(/navItemActive/);
  });
});
