import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { AppRoutes } from '../../../routes';
import { mockTenantAdmin } from '../../fixtures/authFixtures';

describe('Tier 3: Full CRUD Round-Trip Lifecycle & Query Cache Synchronization', () => {
  it('executes Create -> Read -> Update -> Delete lifecycle with full cache synchronization', async () => {
    const uniqueTitle = `Specialized Oncology Workup #${Date.now().toString(36)}`;
    const updatedTitle = `${uniqueTitle} (Amended Protocol)`;

    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    // --- PHASE 1: READ INITIAL STATE ---
    expect(await screen.findByText('Record Title')).toBeInTheDocument();
    const initialRows = await screen.findAllByRole('row');
    const initialCount = initialRows.length;

    // --- PHASE 2: CREATE NEW RECORD ---
    const addBtn = screen.getByRole('button', { name: /New Record/i });
    fireEvent.click(addBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const categoryInput = screen.getByPlaceholderText(/Critical Care/i);
    const amountInput = screen.getByLabelText(/Valuation \/ Cost/i);

    fireEvent.change(titleInput, { target: { value: uniqueTitle } });
    fireEvent.change(categoryInput, { target: { value: 'Oncology' } });
    fireEvent.change(amountInput, { target: { value: '5200' } });

    const saveBtn = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveBtn);

    // Verify record added to table & row count increased
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(uniqueTitle)).toBeInTheDocument();
    });

    await waitFor(() => {
      const rowsAfterCreate = screen.getAllByRole('row');
      expect(rowsAfterCreate.length).toBe(initialCount + 1);
    });

    // --- PHASE 3: UPDATE (EDIT) RECORD ---
    const targetRow = screen.getByText(uniqueTitle).closest('tr');
    expect(targetRow).not.toBeNull();

    const editBtn = targetRow!.querySelector('button[title="Edit Record"]');
    expect(editBtn).not.toBeNull();
    fireEvent.click(editBtn!);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Edit Record/i })).toBeInTheDocument();

    const editTitleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    fireEvent.change(editTitleInput, { target: { value: updatedTitle } });

    const editSaveBtn = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(editSaveBtn);

    // Verify row updated with new title
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(updatedTitle)).toBeInTheDocument();
      expect(screen.queryByText(uniqueTitle)).not.toBeInTheDocument();
    });

    // --- PHASE 4: DELETE RECORD ---
    const updatedRow = screen.getByText(updatedTitle).closest('tr');
    expect(updatedRow).not.toBeNull();

    const deleteBtn = updatedRow!.querySelector('button[title="Delete"]');
    expect(deleteBtn).not.toBeNull();
    fireEvent.click(deleteBtn!);

    // Verify row removed and count restored
    await waitFor(() => {
      expect(screen.queryByText(updatedTitle)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      const rowsAfterDelete = screen.getAllByRole('row');
      expect(rowsAfterDelete.length).toBe(initialCount);
    });
  });

  it('maintains active search filter state and correctly scopes results after CRUD creation', async () => {
    const filterKeyword = 'Orthopedic';
    const newRecordTitle = `${filterKeyword} Hip Arthroscopy #AR-33`;

    renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    const mainArea = await screen.findByRole('main');
    const searchInput = within(mainArea).getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: filterKeyword } });

    // Initially no matching record for this unique keyword
    await waitFor(() => {
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });

    // Create record matching the active search filter
    const addBtn = screen.getByRole('button', { name: /New Record/i });
    fireEvent.click(addBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const categoryInput = screen.getByPlaceholderText(/Critical Care/i);
    fireEvent.change(titleInput, { target: { value: newRecordTitle } });
    fireEvent.change(categoryInput, { target: { value: 'Surgery' } });

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    // Form closes and the matching record immediately surfaces through the active search filter
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(newRecordTitle)).toBeInTheDocument();
      expect(screen.queryByText('No records found')).not.toBeInTheDocument();
    });
  });

  it('preserves query cache isolation per tenant slug when managing records', async () => {
    const { queryClient } = renderWithProviders(<AppRoutes />, {
      initialRoute: '/records',
      currentUser: mockTenantAdmin,
      initialTenantSlug: 'apex-health',
    });

    await screen.findByText('Record Title');

    // Query cache should have records keyed specifically by tenant slug
    const cacheState = queryClient.getQueryState(['records', 'apex-health']);
    expect(cacheState).toBeDefined();
    expect(cacheState?.status).toBe('success');

    // Other tenant cache should remain uninstantiated
    const nexusCacheState = queryClient.getQueryState(['records', 'nexus-logistics']);
    expect(nexusCacheState).toBeUndefined();
  });
});
