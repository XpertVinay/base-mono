import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { RoleSwitcher } from './RoleSwitcher';
import { renderWithProviders } from '../../test/test-utils';
import { useAuthStore } from '../../core/auth/authStore';

describe('RoleSwitcher Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'usr_test_1',
        name: 'Alex Admin',
        email: 'alex@example.com',
        role: 'ADMIN',
        tenantId: 'ten_apex_health_01',
      },
    });
  });

  it('displays the current normalized enterprise role label', () => {
    renderWithProviders(<RoleSwitcher />);

    expect(screen.getByText('Tenant Admin')).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: /simulate role preview \(rbac\)/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the dropdown and lists all 4 enterprise roles', () => {
    renderWithProviders(<RoleSwitcher />);

    const trigger = screen.getByRole('button', { name: /simulate role preview \(rbac\)/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: /simulate role/i });
    expect(listbox).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getAllByText('Tenant Admin')[0]).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
  });

  it('selects a new role and invokes callback', () => {
    const handleRoleChange = vi.fn();
    renderWithProviders(<RoleSwitcher onRoleChange={handleRoleChange} />);

    const trigger = screen.getByRole('button', { name: /simulate role preview \(rbac\)/i });
    fireEvent.click(trigger);

    const superAdminOption = screen.getByRole('option', { name: /super admin/i });
    fireEvent.click(superAdminOption);

    expect(handleRoleChange).toHaveBeenCalledWith('SUPER_ADMIN');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Super Admin')).toBeInTheDocument();

    // Verify auth store user tenant was updated to 'default' for SUPER_ADMIN
    const currentUser = useAuthStore.getState().user;
    expect(currentUser?.tenantId).toBe('default');
  });

  it('closes dropdown when Escape key is pressed', () => {
    renderWithProviders(<RoleSwitcher />);

    const trigger = screen.getByRole('button', { name: /simulate role preview \(rbac\)/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
