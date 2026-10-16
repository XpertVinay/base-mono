import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Database } from 'lucide-react';
import { useTenant } from '../../core/tenant/TenantContext';
import { apiClient } from '../../core/api/client';
import { EntityRecord } from '../../core/api/mockBackend';
import { formatCurrency, formatDate } from '../../core/i18n/formatters';
import { RecordModal } from './RecordModal';
import { EntityRecordFormData } from './recordSchema';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Badge } from '../../components/ui/Badge/Badge';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui/Table/Table';
import styles from './RecordsPage.module.css';

export const RecordsPage: React.FC = () => {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const queryKey = ['records', tenant.identity.slug];

  // Fetch records via typed API client with X-Tenant-ID
  const { data: records = [], isLoading } = useQuery<EntityRecord[]>({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get<EntityRecord[]>('/records', {
        tenantId: tenant.identity.id,
      });
      return response.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (formData: EntityRecordFormData) => {
      await apiClient.post<EntityRecord>(
        '/records',
        {
          ...formData,
          tenantId: tenant.identity.id,
        },
        { tenantId: tenant.identity.id }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (recordId: string) => {
      await apiClient.delete(`/records/${recordId}`, {
        tenantId: tenant.identity.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const filteredRecords = records.filter(
    (r) =>
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPriorityBadgeVariant = (priority: EntityRecord['priority']) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'primary';
      case 'low':
      default:
        return 'neutral';
    }
  };

  const getStatusBadgeVariant = (status: EntityRecord['status']) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'primary';
      case 'pending':
        return 'warning';
      case 'archived':
      default:
        return 'neutral';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>{t('records.title')}</h1>
          <p className={styles.subtitle}>{t('records.subtitle')}</p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus size={16} />}
        >
          {t('records.addNew')}
        </Button>
      </div>

      <div className={styles.searchBar}>
        <Input
          placeholder={t('common.search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '340px' }}
        />
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
          <Spinner size={32} />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-2xl)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border)',
          }}
        >
          <Database size={40} style={{ color: 'var(--color-muted)', marginBottom: '8px' }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('common.noData')}
          </p>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t('records.name')}</TableHeaderCell>
              <TableHeaderCell>{t('records.category')}</TableHeaderCell>
              <TableHeaderCell>{t('records.priority')}</TableHeaderCell>
              <TableHeaderCell>{t('common.status')}</TableHeaderCell>
              <TableHeaderCell>{t('records.amount')}</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>{t('common.actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRecords.map((rec) => (
              <TableRow key={rec.id}>
                <TableCell style={{ fontWeight: 600 }}>{rec.title}</TableCell>
                <TableCell style={{ color: 'var(--color-text-secondary)' }}>{rec.category}</TableCell>
                <TableCell>
                  <Badge variant={getPriorityBadgeVariant(rec.priority)} withDot>
                    {rec.priority.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(rec.status)}>
                    {rec.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell style={{ fontWeight: 700 }}>
                  {formatCurrency(rec.amount, tenant.localization)}
                </TableCell>
                <TableCell style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-muted)' }}>
                  {formatDate(rec.createdAt, tenant.localization)}
                </TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    <button
                      className={styles.deleteButton}
                      title={t('common.delete')}
                      onClick={() => deleteMutation.mutate(rec.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <RecordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        isLoading={createMutation.isPending}
      />
    </div>
  );
};
