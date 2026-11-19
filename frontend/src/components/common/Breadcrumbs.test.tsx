import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Breadcrumbs } from './Breadcrumbs';
import { renderWithProviders } from '../../test/test-utils';

describe('Breadcrumbs Component', () => {
  it('renders root Home crumb on the root "/" route with aria-current="page"', () => {
    renderWithProviders(<Breadcrumbs />, { initialEntries: ['/'] });

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();

    const homeItem = screen.getByText('Home');
    expect(homeItem).toBeInTheDocument();

    const currentItem = screen.getByRole('listitem');
    expect(currentItem).toHaveTextContent('Home');
    expect(screen.getByText('Home').parentElement).toHaveAttribute('aria-current', 'page');
  });

  it('renders intermediate link and terminal current item for a single segment path', () => {
    renderWithProviders(<Breadcrumbs />, { initialEntries: ['/settings'] });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[0]).toHaveTextContent('Home');

    const current = screen.getByText('Settings');
    expect(current.parentElement).toHaveAttribute('aria-current', 'page');
  });

  it('renders multi-level breadcrumb path with registered friendly labels', () => {
    renderWithProviders(<Breadcrumbs />, { initialEntries: ['/iam/tenants'] });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[0]).toHaveTextContent('Home');

    expect(links[1]).toHaveAttribute('href', '/iam');
    expect(links[1]).toHaveTextContent('IAM & Access Control');

    const current = screen.getByText('Tenants');
    expect(current.parentElement).toHaveAttribute('aria-current', 'page');
  });

  it('formats dynamic numeric ID segments and action subpaths', () => {
    renderWithProviders(<Breadcrumbs />, { initialEntries: ['/records/123/edit'] });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveTextContent('Home');
    expect(links[1]).toHaveTextContent('Data Records');
    expect(links[2]).toHaveTextContent('#123');

    const current = screen.getByText('Edit');
    expect(current.parentElement).toHaveAttribute('aria-current', 'page');
  });

  it('formats prefixed entity IDs and long UUIDs cleanly', () => {
    renderWithProviders(<Breadcrumbs />, {
      initialEntries: ['/iam/ten_apex_health_01/roles'],
    });

    const links = screen.getAllByRole('link');
    expect(links[2]).toHaveTextContent('#ten_apex_health_01');

    const current = screen.getByText('Roles & Permissions');
    expect(current.parentElement).toHaveAttribute('aria-current', 'page');
  });

  it('renders custom separator when provided', () => {
    renderWithProviders(<Breadcrumbs separator={<span data-testid="custom-sep">/</span>} />, {
      initialEntries: ['/settings'],
    });

    const separator = screen.getByTestId('custom-sep');
    expect(separator).toBeInTheDocument();
  });
});
