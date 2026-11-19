import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { ErrorLayout } from './ErrorLayout';
import { renderWithProviders } from '../test/test-utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ErrorLayout Component', () => {
  it('renders HTTP 403 access denied layout with default messaging and badge', () => {
    renderWithProviders(<ErrorLayout statusCode={403} />);

    expect(screen.getByText('HTTP 403')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Access Denied' })).toBeInTheDocument();
    expect(
      screen.getByText(/your account role does not have sufficient permissions/i)
    ).toBeInTheDocument();
  });

  it('renders HTTP 404 page not found layout with default messaging', () => {
    renderWithProviders(<ErrorLayout statusCode={404} />);

    expect(screen.getByText('HTTP 404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeInTheDocument();
    expect(
      screen.getByText(/the page or entity you requested does not exist/i)
    ).toBeInTheDocument();
  });

  it('renders HTTP 500 server error layout with default messaging', () => {
    renderWithProviders(<ErrorLayout statusCode={500} />);

    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Server Error' })).toBeInTheDocument();
    expect(
      screen.getByText(/an unexpected system error occurred while processing your request/i)
    ).toBeInTheDocument();
  });

  it('supports custom title, message, and action text', () => {
    renderWithProviders(
      <ErrorLayout
        statusCode={403}
        title="Restricted Tenant Resource"
        message="Only platform Super Admins may view cross-tenant telemetry."
        actionText="Back to Safety"
      />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Restricted Tenant Resource' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Only platform Super Admins may view cross-tenant telemetry.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Safety' })).toBeInTheDocument();
  });

  it('invokes onAction callback when action button is clicked', () => {
    const handleAction = vi.fn();
    renderWithProviders(<ErrorLayout statusCode={404} onAction={handleAction} />);

    const actionBtn = screen.getByRole('button', { name: /return to dashboard/i });
    fireEvent.click(actionBtn);

    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('navigates to "/" when onAction is not provided', () => {
    mockNavigate.mockClear();
    renderWithProviders(<ErrorLayout statusCode={404} />);

    const actionBtn = screen.getByRole('button', { name: /return to dashboard/i });
    fireEvent.click(actionBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
