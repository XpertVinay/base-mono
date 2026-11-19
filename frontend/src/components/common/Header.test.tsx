import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Header } from './Header';
import { renderWithProviders } from '../../test/test-utils';
import { useAuthStore } from '../../core/auth/authStore';
import { useApiTrafficStore } from '../../core/api/trafficStore';

describe('Header Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'usr_head_1',
        name: 'Taylor Swift',
        email: 'taylor@example.com',
        role: 'ADMIN',
        tenantId: 'ten_apex_health_01',
      },
    });
  });

  it('renders search input, notifications, status pill, and user avatar', () => {
    renderWithProviders(<Header />);

    const banner = screen.getByRole('banner');
    expect(banner).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search portal, entities, docs\.\.\./i);
    expect(searchInput).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /documentation/i })).toBeInTheDocument();
    expect(screen.getAllByText('Apex Health Systems')[0]).toBeInTheDocument();
    expect(screen.getByText('TS')).toBeInTheDocument();
  });

  it('embeds TenantSwitcher and RoleSwitcher dropdowns', () => {
    renderWithProviders(<Header />);

    expect(screen.getByTestId('tenant-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('role-switcher')).toBeInTheDocument();
  });

  it('calls onToggleSidebar when desktop toggle button is clicked', () => {
    const handleToggle = vi.fn();
    renderWithProviders(
      <Header isSidebarCollapsed={false} onToggleSidebar={handleToggle} />
    );

    const toggleBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleMobileMenu when mobile menu button is clicked', () => {
    const handleMobileToggle = vi.fn();
    renderWithProviders(<Header onToggleMobileMenu={handleMobileToggle} />);

    const mobileBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
    fireEvent.click(mobileBtn);
    expect(handleMobileToggle).toHaveBeenCalledTimes(1);
  });

  it('triggers toggleDrawer when API traffic inspector button is clicked', () => {
    const toggleSpy = vi.spyOn(useApiTrafficStore.getState(), 'toggleDrawer');
    renderWithProviders(<Header />);

    const trafficBtn = screen.getByRole('button', { name: /api traffic inspector/i });
    fireEvent.click(trafficBtn);
    expect(toggleSpy).toHaveBeenCalled();
  });
});
