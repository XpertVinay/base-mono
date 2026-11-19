import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '../../../core/i18n';
import { renderWithProviders } from '../../test-utils';
import { RecordModal } from '../../../features/records/RecordModal';
import { entityRecordSchema } from '../../../features/records/recordSchema';

describe('Tier 2: Schema-Driven Form & Boundary Input Validation', () => {
  it('validates schema directly: enforces minimum lengths and non-negative constraints', () => {
    // 1. Title too short
    const shortTitleResult = entityRecordSchema.safeParse({
      title: 'ab',
      category: 'Cardiology',
      amount: 100,
      priority: 'high',
      status: 'active',
    });
    expect(shortTitleResult.success).toBe(false);
    if (!shortTitleResult.success) {
      expect(shortTitleResult.error.errors[0]?.message).toBe(
        'Title must be at least 3 characters'
      );
    }

    // 2. Category too short
    const shortCategoryResult = entityRecordSchema.safeParse({
      title: 'Valid Title Here',
      category: 'C',
      amount: 100,
      priority: 'high',
      status: 'active',
    });
    expect(shortCategoryResult.success).toBe(false);
    if (!shortCategoryResult.success) {
      expect(shortCategoryResult.error.errors[0]?.message).toBe('Category is required');
    }

    // 3. Negative amount
    const negativeAmountResult = entityRecordSchema.safeParse({
      title: 'Valid Title Here',
      category: 'Cardiology',
      amount: -25,
      priority: 'high',
      status: 'active',
    });
    expect(negativeAmountResult.success).toBe(false);
    if (!negativeAmountResult.success) {
      expect(negativeAmountResult.error.errors[0]?.message).toBe('Amount must be non-negative');
    }

    // 4. Notes exceeding 500 characters
    const longNotesResult = entityRecordSchema.safeParse({
      title: 'Valid Title Here',
      category: 'Cardiology',
      amount: 500,
      priority: 'medium',
      status: 'active',
      notes: 'x'.repeat(501),
    });
    expect(longNotesResult.success).toBe(false);
    if (!longNotesResult.success) {
      expect(longNotesResult.error.errors[0]?.message).toBe(
        'Notes cannot exceed 500 characters'
      );
    }
  });

  it('displays Zod validation error when submitting title shorter than 3 characters in UI', async () => {
    const handleSubmit = vi.fn();
    renderWithProviders(
      <RecordModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={handleSubmit}
      />
    );

    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const categoryInput = screen.getByPlaceholderText(/Critical Care/i);
    const saveBtn = screen.getByRole('button', { name: /Save/i });

    // Set title with only 2 characters
    fireEvent.change(titleInput, { target: { value: 'AB' } });
    fireEvent.change(categoryInput, { target: { value: 'Valid Category' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('displays validation error when category field is left empty in UI', async () => {
    const handleSubmit = vi.fn();
    renderWithProviders(
      <RecordModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={handleSubmit}
      />
    );

    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const categoryInput = screen.getByPlaceholderText(/Critical Care/i);
    const saveBtn = screen.getByRole('button', { name: /Save/i });

    fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
    fireEvent.change(categoryInput, { target: { value: '' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Category is required')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('displays validation error when amount is negative in UI', async () => {
    const handleSubmit = vi.fn();
    renderWithProviders(
      <RecordModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={handleSubmit}
      />
    );

    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const categoryInput = screen.getByPlaceholderText(/Critical Care/i);
    const amountInput = screen.getByLabelText(/Valuation \/ Cost/i);
    const saveBtn = screen.getByRole('button', { name: /Save/i });

    fireEvent.change(titleInput, { target: { value: 'Emergency Stent Placement' } });
    fireEvent.change(categoryInput, { target: { value: 'Cardiology' } });
    fireEvent.change(amountInput, { target: { value: '-100' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Amount must be non-negative')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('successfully submits and calls onSubmit handler when all fields are valid', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    renderWithProviders(
      <RecordModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const titleInput = screen.getByPlaceholderText(/Diagnostic Workup/i);
    const categoryInput = screen.getByPlaceholderText(/Critical Care/i);
    const amountInput = screen.getByLabelText(/Valuation \/ Cost/i);
    const notesInput = screen.getByPlaceholderText(/Telemetry logs/i);
    const saveBtn = screen.getByRole('button', { name: /Save/i });

    fireEvent.change(titleInput, { target: { value: 'Valid Clinical Order' } });
    fireEvent.change(categoryInput, { target: { value: 'Radiology' } });
    fireEvent.change(amountInput, { target: { value: '850.50' } });
    fireEvent.change(notesInput, { target: { value: 'Standard protocol notes' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Valid Clinical Order',
          category: 'Radiology',
          amount: 850.5,
          notes: 'Standard protocol notes',
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
