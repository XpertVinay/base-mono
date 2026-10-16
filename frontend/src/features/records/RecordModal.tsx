import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { entityRecordSchema, EntityRecordFormData } from './recordSchema';
import { Modal } from '../../components/ui/Modal/Modal';
import { Input } from '../../components/ui/Input/Input';
import { Select } from '../../components/ui/Select/Select';
import { Button } from '../../components/ui/Button/Button';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EntityRecordFormData) => Promise<void>;
  isLoading?: boolean;
}

export const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSubmit, isLoading = false }) => {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntityRecordFormData>({
    resolver: zodResolver(entityRecordSchema),
    defaultValues: {
      title: '',
      category: '',
      amount: 1000,
      priority: 'medium',
      status: 'active',
      notes: '',
    },
  });

  const handleFormSubmit = async (data: EntityRecordFormData) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('records.addNew')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit(handleFormSubmit)} isLoading={isLoading}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <Input
          label={t('records.name')}
          placeholder="e.g. Diagnostic Workup or Freight Waybill"
          error={errors.title?.message}
          required
          {...register('title')}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
          <Input
            label={t('records.category')}
            placeholder="e.g. Critical Care or Intermodal"
            error={errors.category?.message}
            required
            {...register('category')}
          />

          <Input
            label={t('records.amount')}
            type="number"
            step="0.01"
            error={errors.amount?.message}
            required
            {...register('amount')}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
          <Select label={t('records.priority')} error={errors.priority?.message} {...register('priority')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>

          <Select label={t('common.status')} error={errors.status?.message} {...register('status')}>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        <Input
          label={t('records.notes')}
          placeholder="Telemetry logs or notes..."
          error={errors.notes?.message}
          {...register('notes')}
        />
      </form>
    </Modal>
  );
};
