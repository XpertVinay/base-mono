import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit3, Building2, RefreshCw } from 'lucide-react';
import {
  organizationsApi,
  OrganizationDto,
  OrganizationTier,
  CreateOrganizationPayload,
} from '../../../core/api/services/organizationsApi';
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

export const OrganizationsTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateOrganizationPayload>({
    name: '',
    slug: '',
    domain: '',
    industry: 'technology',
    tier: 'STARTER',
    ownerEmail: '',
  });

  const {
    data: organizations = [],
    isLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['explorer-organizations', search, tierFilter],
    queryFn: async () => {
      const params = {
        search: search || undefined,
        tier: tierFilter !== 'all' ? (tierFilter as OrganizationTier) : undefined,
      };
      const res = await organizationsApi.list(params);
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: CreateOrganizationPayload) => {
      const sanitized = {
        name: sanitizeString(payload.name),
        slug: sanitizeString(payload.slug),
        domain: payload.domain ? sanitizeString(payload.domain) : undefined,
        industry: sanitizeString(payload.industry),
        tier: payload.tier,
        ownerEmail: payload.ownerEmail ? sanitizeString(payload.ownerEmail) : undefined,
      };
      if (editingOrg) {
        return organizationsApi.update(editingOrg.id, sanitized);
      }
      return organizationsApi.create(sanitized);
    },
    onSuccess: (res) => {
      toast.success(`Organization "${res.data.name}" saved successfully!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-organizations'] });
      setIsModalOpen(false);
      setEditingOrg(null);
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Save failed: ${apiErr.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return organizationsApi.delete(id);
    },
    onSuccess: () => {
      toast.success('Organization deleted');
      queryClient.invalidateQueries({ queryKey: ['explorer-organizations'] });
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      toast.error(`Delete failed: ${apiErr.message}`);
    },
  });

  return (
    <div className={styles.tabContainer}>
      {actionError && (
        <Alert variant="error" title="Action Error">
          {actionError}
        </Alert>
      )}

      {queryError && (
        <Alert variant="error" title="Failed to Load Organizations">
          {extractApiServiceError(queryError).message}
        </Alert>
      )}

      <div className={styles.sectionHeader}>
        <div className={styles.searchFilterRow}>
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className={styles.formSelect}
            aria-label="Filter organizations by tier"
          >
            <option value="all">All Tiers</option>
            <option value="STARTER">Starter</option>
            <option value="PROFESSIONAL">Professional</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
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
            setEditingOrg(null);
            setFormData({
              name: '',
              slug: '',
              domain: '',
              industry: 'technology',
              tier: 'STARTER',
              ownerEmail: '',
            });
            setIsModalOpen(true);
          }}
        >
          Create Organization
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : organizations.length === 0 ? (
        <div className={styles.emptyState}>
          <Building2 size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No organizations found.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Slug / ID</TableHeaderCell>
              <TableHeaderCell>Industry</TableHeaderCell>
              <TableHeaderCell>Tier</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Domain</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell style={{ fontWeight: 600 }}>{org.name}</TableCell>
                <TableCell style={{ fontFamily: 'monospace', fontSize: 12 }}>{org.slug}</TableCell>
                <TableCell>{org.industry}</TableCell>
                <TableCell>
                  <Badge variant="primary">{org.tier}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={org.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {org.status}
                  </Badge>
                </TableCell>
                <TableCell style={{ color: 'var(--color-muted)', fontSize: 12 }}>
                  {org.domain || '—'}
                </TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    <button
                      type="button"
                      className={styles.actionIconBtn}
                      title="Edit Organization"
                      onClick={() => {
                        setEditingOrg(org);
                        setFormData({
                          name: org.name,
                          slug: org.slug,
                          domain: org.domain || '',
                          industry: org.industry,
                          tier: org.tier,
                        });
                        setIsModalOpen(true);
                      }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                      title="Delete Organization"
                      onClick={() => deleteMutation.mutate(org.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create / Edit Organization Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingOrg ? `Edit: ${editingOrg.name}` : 'Create Organization'}
      >
        <form
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(formData);
          }}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Organization Name *</label>
            <input
              className={styles.formInput}
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Slug Identifier *</label>
              <input
                className={styles.formInput}
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Domain Mapping</label>
              <input
                className={styles.formInput}
                value={formData.domain || ''}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Industry</label>
              <select
                className={styles.formSelect}
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              >
                <option value="technology">Technology</option>
                <option value="healthcare">Healthcare</option>
                <option value="fintech">Fintech</option>
                <option value="logistics">Logistics</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Subscription Tier</label>
              <select
                className={styles.formSelect}
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as OrganizationTier })}
              >
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              {editingOrg ? 'Update Organization' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
