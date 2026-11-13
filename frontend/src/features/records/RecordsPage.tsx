import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Edit3, Database, ChevronRight, Activity, ServerCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../core/tenant/TenantContext';
import { recordsApi } from '../../core/api/services/recordsApi';
import { EntityRecord } from '../../core/api/mockBackend';
import { formatCurrency, formatDate } from '../../core/i18n/formatters';
import { RecordModal } from './RecordModal';
import { EntityRecordFormData } from './recordSchema';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Badge } from '../../components/ui/Badge/Badge';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import { useApiTrafficStore } from '../../core/api/trafficStore';
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
  const { toggleDrawer, records: trafficRecords } = useApiTrafficStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EntityRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const queryKey = ['records', tenant.identity.slug];

  // Fetch records via typed API client with X-Tenant-ID
  const { data: records = [], isLoading } = useQuery<EntityRecord[]>({
    queryKey,
    queryFn: async () => {
      const response = await recordsApi.list({
        tenantId: tenant.identity.id,
        tenantSlug: tenant.identity.slug,
      });
      return response.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (formData: EntityRecordFormData) => {
      await recordsApi.create(formData, {
        tenantId: tenant.identity.id,
        tenantSlug: tenant.identity.slug,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntityRecordFormData> }) => {
      await recordsApi.update(id, data, {
        tenantId: tenant.identity.id,
        tenantSlug: tenant.identity.slug,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (recordId: string) => {
      await recordsApi.delete(recordId, {
        tenantId: tenant.identity.id,
        tenantSlug: tenant.identity.slug,
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
      {/* Breadcrumb Navigation */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <span>Workspace</span>
        <ChevronRight size={13} className={styles.breadcrumbSeparator} />
        <span className={styles.breadcrumbActive}>{t('records.title')}</span>
      </nav>

      <div className={styles.headerBar}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>{t('records.title')}</h1>
          <p className={styles.subtitle}>{t('records.subtitle')}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/api-operations" style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="sm" leftIcon={<ServerCog size={15} />}>
              API CRUD Workbench
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleDrawer}
            leftIcon={<Activity size={15} />}
          >
            Traffic ({trafficRecords.length})
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              setEditingRecord(null);
              setIsModalOpen(true);
            }}
            leftIcon={<Plus size={16} />}
          >
            {t('records.addNew')}
          </Button>
        </div>
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
                      className={styles.editButton}
                      title="Edit Record"
                      onClick={() => setEditingRecord(rec)}
                    >
                      <Edit3 size={16} />
                    </button>
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
        isOpen={isModalOpen || Boolean(editingRecord)}
        initialData={editingRecord}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
        }}
        onSubmit={async (data) => {
          if (editingRecord) {
            await updateMutation.mutateAsync({ id: editingRecord.id, data });
          } else {
            await createMutation.mutateAsync(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};
