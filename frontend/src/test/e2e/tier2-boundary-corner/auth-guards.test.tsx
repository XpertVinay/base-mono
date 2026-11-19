import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import '../../../core/i18n';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockTenantAdmin } from '../../fixtures/authFixtures';

describe('Tier 2: Declarative Route & Session Auth Guards', () => {
  it('redirects unauthenticated user from protected /records route to /login', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: null,
      initialTenantSlug: 'apex-health',
    });

    // Should redirect to LoginPage
    expect(await screen.findByText('Single Sign-On Enforced')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    // Protected content should NOT be rendered
    expect(screen.queryByRole('button', { name: /New Record/i })).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user from protected /iam route to /login', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/iam',
      currentUser: null,
      initialTenantSlug: 'apex-health',
    });

    expect(await screen.findByText('Single Sign-On Enforced')).toBeInTheDocument();
    expect(screen.queryByText('IAM Control Plane')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user from protected /settings route to /login', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/settings',
      currentUser: null,
      initialTenantSlug: 'apex-health',
    });

    expect(await screen.findByText('Single Sign-On Enforced')).toBeInTheDocument();
    expect(screen.queryByText('Profile Settings')).not.toBeInTheDocument();
  });

  it('permits unauthenticated access to public auth routes /login and /register', async () => {
    const { unmount } = renderWithProviders(<AppRoutes />, {
      initialRoute: '/login',
      currentUser: null,
      initialTenantSlug: 'apex-health',
    });

    expect(await screen.findByText('Single Sign-On Enforced')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('user@enterprise.local')).toBeInTheDocument();

    unmount();

    renderWithProviders(<AppRoutes />, {
      initialRoute: '/register',
      currentUser: null,
      initialTenantSlug: 'apex-health',
    });

    expect(await screen.findByText('Single Sign-On Enforced')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('user@enterprise.local')).toBeInTheDocument();
  });

  it('permits authenticated user immediate access to protected routes without redirect', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Must render protected records page immediately
    expect(await screen.findByText('Record Title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Record/i })).toBeInTheDocument();
    // Must NOT show login card
    expect(screen.queryByText('Single Sign-On Enforced')).not.toBeInTheDocument();
  });
});
