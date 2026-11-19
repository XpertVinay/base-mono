import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { TenantSwitcher } from './TenantSwitcher';
import { renderWithProviders } from '../../test/test-utils';

describe('TenantSwitcher Component', () => {
  it('displays the current active tenant name and industry tag', () => {
    renderWithProviders(<TenantSwitcher />, { initialSlug: 'apex-health' });

    expect(screen.getByText('Apex Health Systems')).toBeInTheDocument();
    expect(screen.getByText('HEALTHCARE')).toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /switch workspace \/ tenant/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles the dropdown menu when clicked', () => {
    renderWithProviders(<TenantSwitcher />, { initialSlug: 'apex-health' });

    const trigger = screen.getByRole('button', { name: /switch workspace \/ tenant/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: /available tenants/i });
    expect(listbox).toBeInTheDocument();

    // Verify demo tenants are listed
    expect(screen.getByText('Nexus Fleet Logistics')).toBeInTheDocument();
    expect(screen.getByText('Aura Digital Capital')).toBeInTheDocument();
  });

  it('switches the active tenant when an option is selected', () => {
    renderWithProviders(<TenantSwitcher />, { initialSlug: 'apex-health' });

    const trigger = screen.getByRole('button', { name: /switch workspace \/ tenant/i });
    fireEvent.click(trigger);

    const logisticsOption = screen.getByRole('option', { name: /nexus fleet logistics/i });
    fireEvent.click(logisticsOption);

    // Dropdown should be closed and trigger updated
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Nexus Fleet Logistics')).toBeInTheDocument();
    expect(screen.getByText('LOGISTICS')).toBeInTheDocument();
  });

  it('closes dropdown when Escape key is pressed', () => {
    renderWithProviders(<TenantSwitcher />, { initialSlug: 'apex-health' });

    const trigger = screen.getByRole('button', { name: /switch workspace \/ tenant/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
