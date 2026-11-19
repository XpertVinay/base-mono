import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { renderWithProviders } from '../../test/test-utils';
import { useAuthStore } from '../../core/auth/authStore';

describe('Sidebar Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'usr_side_1',
        name: 'Jordan Lee',
        email: 'jordan@example.com',
        role: 'ADMIN',
        tenantId: 'ten_apex_health_01',
      },
    });
  });

  it('renders expanded mode with logo text, full navigation labels, and collapse toggle', () => {
    const handleToggle = vi.fn();
    renderWithProviders(
      <Sidebar
        collapsed={false}
        onToggleCollapse={handleToggle}
        mobileOpen={false}
        onCloseMobile={vi.fn()}
      />
    );

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');

    // Toggle button should offer collapsing
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(collapseBtn).toBeInTheDocument();
    fireEvent.click(collapseBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);

    // Full labels should be visible
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
  });

  it('renders collapsed rail mode with data-collapsed="true" and expand toggle button', () => {
    const handleToggle = vi.fn();
    renderWithProviders(
      <Sidebar
        collapsed={true}
        onToggleCollapse={handleToggle}
        mobileOpen={false}
        onCloseMobile={vi.fn()}
      />
    );

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    // Toggle button should offer expanding
    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
    expect(expandBtn).toBeInTheDocument();
    fireEvent.click(expandBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);

    // Labels are hidden in rail mode
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('handles mobile drawer open and backdrop close trigger', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <Sidebar
        collapsed={false}
        mobileOpen={true}
        onCloseMobile={handleClose}
      />
    );

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
    expect(sidebar).toHaveAttribute('data-mobile-open', 'true');

    const backdrop = screen.getByTestId('sidebar-backdrop');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: /close navigation/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('triggers logout when sign out button is clicked', () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');
    renderWithProviders(
      <Sidebar
        collapsed={false}
        mobileOpen={false}
        onCloseMobile={vi.fn()}
      />
    );

    const logoutBtn = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutBtn);
    expect(logoutSpy).toHaveBeenCalled();
  });
});
