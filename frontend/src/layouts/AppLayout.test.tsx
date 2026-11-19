import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { AppLayout } from './AppLayout';
import { renderWithProviders } from '../test/test-utils';
import { useAuthStore } from '../core/auth/authStore';

describe('AppLayout Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: {
        id: 'usr_app_1',
        name: 'Morgan Admin',
        email: 'morgan@example.com',
        role: 'ADMIN',
        tenantId: 'ten_apex_health_01',
      },
    });
  });

  it('renders all structural landmarks: navigation, banner, breadcrumbs, main, and footer', () => {
    renderWithProviders(
      <AppLayout>
        <div data-testid="dashboard-content">Operational Metrics View</div>
      </AppLayout>
    );

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
  });

  it('toggles sidebar collapse state and persists preference in localStorage', () => {
    renderWithProviders(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');

    // Find collapse button in header or sidebar
    const collapseBtns = screen.getAllByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(collapseBtns[0]!);

    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    expect(localStorage.getItem('enterprise_sidebar_collapsed')).toBe('true');

    // Click expand button to restore
    const expandBtns = screen.getAllByRole('button', { name: /expand sidebar/i });
    fireEvent.click(expandBtns[0]!);

    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    expect(localStorage.getItem('enterprise_sidebar_collapsed')).toBe('false');
  });

  it('toggles mobile drawer overlay when mobile hamburger button is clicked', () => {
    renderWithProviders(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    expect(sidebar).toHaveAttribute('data-mobile-open', 'false');

    const mobileBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
    fireEvent.click(mobileBtn);

    expect(sidebar).toHaveAttribute('data-mobile-open', 'true');
  });
});
