import { describe, it, expect } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import '../../../core/i18n';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockTenantAdmin } from '../../fixtures/authFixtures';

describe('Tier 1: CRUD Happy Path Operations (List, Filter, Create, Edit, Delete)', () => {
  it('renders records table with column headers and initial backend records', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Check localized table headers
    expect(await screen.findByText('Record Title')).toBeInTheDocument();
    expect(screen.getByText('Category / Vertical')).toBeInTheDocument();
    expect(screen.getByText('Priority Level')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Valuation / Cost')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Verify initial records rendered from mockBackend
    const rows = await screen.findAllByRole('row');
    expect(rows.length).toBeGreaterThan(1); // 1 header row + data rows
  });

  it('filters data table rows interactively using the search input', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    const mainArea = await screen.findByRole('main');
    const searchInput = within(mainArea).getByPlaceholderText('Search...');
    expect(searchInput).toBeInTheDocument();

    // Type a specific query matching records
    fireEvent.change(searchInput, { target: { value: 'ICU' } });

    // Table should filter to matching record
    await waitFor(() => {
      expect(screen.getByText(/ICU Telemetry Monitoring/i)).toBeInTheDocument();
    });
  });

  it('creates a new record through modal form and adds it to the list', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Click "New Record" button
    const addBtn = await screen.findByRole('button', { name: /New Record/i });
    fireEvent.click(addBtn);

    // Modal opens
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /New Record/i })).toBeInTheDocument();

    // Fill form
    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const categoryInput = screen.getByPlaceholderText(/Critical Care/i);
    const amountInput = screen.getByLabelText(/Valuation \/ Cost/i);

    fireEvent.change(titleInput, { target: { value: 'Pediatric Cardiac Screening #PC-901' } });
    fireEvent.change(categoryInput, { target: { value: 'Cardiology' } });
    fireEvent.change(amountInput, { target: { value: '2400' } });

    // Submit
    const saveBtn = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveBtn);

    // Modal closes and new record is displayed in table
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Pediatric Cardiac Screening #PC-901')).toBeInTheDocument();
    });
  });

  it('edits an existing record and updates the table row display', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Find first Edit button
    const editButtons = await screen.findAllByTitle('Edit Record');
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]!);

    // Modal opens populated with data
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Edit Record/i })).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const originalValue = (titleInput as HTMLInputElement).value;
    const amendedValue = `${originalValue} (Updated)`;

    fireEvent.change(titleInput, { target: { value: amendedValue } });

    // Submit edit
    const saveBtn = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveBtn);

    // Modal closes and updated text is in document
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(amendedValue)).toBeInTheDocument();
    });
  });

  it('deletes a record and removes it from the table', async () => {
    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // Wait for records to render
    const initialRows = await screen.findAllByRole('row');
    const deleteButtons = screen.getAllByTitle(/Delete/i);
    expect(deleteButtons.length).toBeGreaterThan(0);

    // Trigger delete on last item
    const lastDeleteBtn = deleteButtons[deleteButtons.length - 1]!;
    fireEvent.click(lastDeleteBtn);

    // Row count decreases
    await waitFor(() => {
      const remainingRows = screen.getAllByRole('row');
      expect(remainingRows.length).toBeLessThan(initialRows.length);
    });
  });
});
