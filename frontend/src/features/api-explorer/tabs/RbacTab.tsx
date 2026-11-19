import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShieldCheck, RefreshCw } from 'lucide-react';
import {
  rbacApi,
  CreateRolePayload,
} from '../../../core/api/services/rbacApi';
import { extractApiServiceError } from '../../../core/api/envelope';
import { sanitizeString } from '../../../utils/sanitize';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Spinner } from '../../../components/ui/Spinner/Spinner';
import { Modal } from '../../../components/ui/Modal/Modal';
import { Alert } from '../../../components/ui/Alert/Alert';
import { toast } from '../../../components/ui/Toast';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../../components/ui/Table/Table';
import styles from './Tabs.module.css';

export const RbacTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateRolePayload>({
    name: '',
    description: '',
    permissions: ['records:read', 'records:write'],
  });

  const {
    data: roles = [],
    isLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['explorer-roles', search],
    queryFn: async () => {
      const res = await rbacApi.listRoles({ search: search || undefined });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateRolePayload) => {
      return rbacApi.createRole({
        name: sanitizeString(payload.name).toUpperCase(),
        description: payload.description ? sanitizeString(payload.description) : undefined,
        permissions: payload.permissions,
      });
    },
    onSuccess: (res) => {
      toast.success(`Role "${res.data.name}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-roles'] });
      setIsModalOpen(false);
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Role creation failed: ${apiErr.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return rbacApi.deleteRole(id);
    },
    onSuccess: () => {
      toast.success('Role deleted');
      queryClient.invalidateQueries({ queryKey: ['explorer-roles'] });
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      toast.error(`Delete failed: ${apiErr.message}`);
    },
  });

  const availablePermissions = [
    'records:read',
    'records:write',
    'records:delete',
    'orders:create',
    'orders:cancel',
    'assets:upload',
    'assets:delete',
    'iam:mfa:manage',
    'config:write',
  ];

  return (
    <div className={styles.tabContainer}>
      {actionError && (
        <Alert variant="error" title="Action Error">
          {actionError}
        </Alert>
      )}

      {queryError && (
        <Alert variant="error" title="Failed to Load Roles">
          {extractApiServiceError(queryError).message}
        </Alert>
      )}

      <div className={styles.sectionHeader}>
        <div className={styles.searchFilterRow}>
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
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

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => {
            setFormData({
              name: '',
              description: '',
              permissions: ['records:read', 'records:write'],
            });
            setIsModalOpen(true);
          }}
        >
          Create Role
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : roles.length === 0 ? (
        <div className={styles.emptyState}>
          <ShieldCheck size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No RBAC roles configured.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Role Name</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Permissions</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell style={{ fontWeight: 700 }}>{role.name}</TableCell>
                <TableCell>
                  <Badge variant={role.isSystem ? 'neutral' : 'primary'}>
                    {role.isSystem ? 'SYSTEM' : 'CUSTOM'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 400 }}>
                    {role.permissions?.map((p) => (
                      <Badge key={p} variant="neutral">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{role.description || '—'}</TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    {!role.isSystem && (
                      <button
                        type="button"
                        className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                        title="Delete Role"
                        onClick={() => deleteMutation.mutate(role.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create Role Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create RBAC Role"
      >
        <form
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(formData);
          }}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Role Identifier (UPPERCASE) *</label>
            <input
              className={styles.formInput}
              required
              placeholder="e.g. BILLING_SPECIALIST"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <input
              className={styles.formInput}
              placeholder="Operational responsibilities..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Assigned Permissions</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 4 }}>
              {availablePermissions.map((perm) => (
                <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.permissions?.includes(perm)}
                    onChange={(e) => {
                      const cur = formData.permissions || [];
                      if (e.target.checked) {
                        setFormData({ ...formData, permissions: [...cur, perm] });
                      } else {
                        setFormData({ ...formData, permissions: cur.filter((p) => p !== perm) });
                      }
                    }}
                  />
                  <span>{perm}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.modalFooter}>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Create Role
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
