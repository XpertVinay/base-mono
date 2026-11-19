import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, RefreshCw } from 'lucide-react';
import { recordsApi } from '../../../core/api/services/recordsApi';
import { useTenant } from '../../../core/tenant/TenantContext';
import { extractApiServiceError } from '../../../core/api/envelope';
import { Button } from '../../../components/ui/Button/Button';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Spinner } from '../../../components/ui/Spinner/Spinner';
import { Alert } from '../../../components/ui/Alert/Alert';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../../components/ui/Table/Table';
import styles from './Tabs.module.css';

export const RecordsTab: React.FC = () => {
  const { tenant } = useTenant();

  const {
    data: records = [],
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ['explorer-records', tenant.identity.slug],
    queryFn: async () => {
      const res = await recordsApi.list({ tenantId: tenant.identity.id });
      return res.data;
    },
  });

  return (
    <div className={styles.tabContainer}>
      {error && (
        <Alert variant="error" title="Failed to Load Entity Records">
          {extractApiServiceError(error).message}
        </Alert>
      )}

      <div className={styles.sectionHeader}>
        <div style={{ fontSize: 13, color: '#464555' }}>
          Entity Records for active tenant: <strong>{tenant.identity.displayName}</strong> ({records.length} records)
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          leftIcon={<RefreshCw size={13} className={isRefetching ? 'animate-spin' : ''} />}
        >
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : records.length === 0 ? (
        <div className={styles.emptyState}>
          <Database size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No entity records found for active tenant.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Title</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Priority</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Amount</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((rec) => (
              <TableRow key={rec.id}>
                <TableCell style={{ fontWeight: 600 }}>{rec.title}</TableCell>
                <TableCell style={{ color: 'var(--color-text-secondary, #464555)' }}>
                  {rec.category}
                </TableCell>
                <TableCell>
                  <Badge variant="primary">{rec.priority?.toUpperCase()}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="success">{rec.status?.toUpperCase()}</Badge>
                </TableCell>
                <TableCell style={{ fontWeight: 700 }}>${Number(rec.amount || 0).toFixed(2)}</TableCell>
                <TableCell>{rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
