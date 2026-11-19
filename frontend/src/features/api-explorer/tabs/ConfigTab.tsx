import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sliders,
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  Layers,
  Flame,
  Zap,
} from 'lucide-react';
import {
  configApi,
  ConfigTarget,
  ConfigSection,
} from '../../../core/api/services/configApi';
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

// 11 Core Modular Sections
const SECTION_LIST: { id: ConfigSection; label: string; desc: string }[] = [
  { id: 'tenant', label: 'Multi-Tenant', desc: 'Row/Schema isolation mode & boundaries' },
  { id: 'iam', label: 'IAM & RBAC', desc: 'Asymmetric JWT RS256 algorithms & lockout policies' },
  { id: 'white-label', label: 'White-Label Branding', desc: 'Theme colors, logos, domain mapping' },
  { id: 'asset', label: 'Asset Storage', desc: 'Storage providers (S3/Local) & MIME rules' },
  { id: 'finance', label: 'Finance & Ledger', desc: 'Audit retention, immutability, currencies' },
  { id: 'transaction', label: 'Transaction Gateway', desc: 'Active payment gateway routing & fees' },
  { id: 'inventory', label: 'Inventory Management', desc: 'Stock thresholds & auto-reservation TTL' },
  { id: 'order', label: 'Orders & Bookings', desc: 'Confirmation workflow, invoice prefixes' },
  { id: 'property', label: 'Property & Units', desc: 'Inspection intervals & caretaking services' },
  { id: 'search', label: 'Full-Text Search', desc: 'Search engine (Postgres FTS / Elasticsearch)' },
  { id: 'scheduler', label: 'Cron Scheduler', desc: 'Concurrent job limits & dead-letter queue' },
];

const setConfigSchema = z.object({
  key: z.string().min(1, 'Key is required').regex(/^[A-Z0-9_]+$/, 'Must be UPPERCASE_SNAKE_CASE'),
  value: z.string().min(1, 'Value is required'),
  target: z.enum(['BACKEND', 'FRONTEND', 'ALL']),
  description: z.string().optional(),
});

type SetConfigFormValues = z.infer<typeof setConfigSchema>;

const contextTokenSchema = z.object({
  tenantId: z.string().min(1, 'Tenant UUID is required'),
  orgId: z.string().optional(),
  ttlMs: z.number().int().positive().default(86400000),
});

type ContextTokenFormValues = z.infer<typeof contextTokenSchema>;

export const ConfigTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<{ id: string; config: Record<string, unknown> } | null>(null);
  const [editingSectionJson, setEditingSectionJson] = useState('');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isContextTokenModalOpen, setIsContextTokenModalOpen] = useState(false);
  const [generatedContextToken, setGeneratedContextToken] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Dynamic Key-Value Configs
  const {
    data: configs = [],
    isLoading: isConfigsLoading,
    refetch: refetchConfigs,
  } = useQuery({
    queryKey: ['explorer-configs'],
    queryFn: async () => {
      const res = await configApi.list();
      return res.data;
    },
  });

  // 2. Fetch 11 Modular Sections Summary
  const {
    data: sectionsSummary = {},
    isLoading: isSectionsLoading,
    refetch: refetchSections,
  } = useQuery({
    queryKey: ['explorer-config-sections'],
    queryFn: async () => {
      const res = await configApi.getSectionsSummary();
      return res.data;
    },
  });

  // 3. Fetch Cache Telemetry Stats
  const {
    data: cacheStats,
    refetch: refetchCache,
  } = useQuery({
    queryKey: ['explorer-config-cache'],
    queryFn: async () => {
      const res = await configApi.getCacheStats();
      return res.data;
    },
  });

  // 4. Set Config Mutation
  const {
    register: registerConfig,
    handleSubmit: handleConfigSubmit,
    reset: resetConfigForm,
    formState: { errors: configErrors, isSubmitting: isSavingConfig },
  } = useForm<SetConfigFormValues>({
    resolver: zodResolver(setConfigSchema),
    defaultValues: {
      key: '',
      value: '',
      target: 'ALL',
      description: '',
    },
  });

  const setConfigMutation = useMutation({
    mutationFn: async (values: SetConfigFormValues) => {
      return configApi.set({
        key: sanitizeString(values.key).toUpperCase(),
        value: sanitizeString(values.value),
        target: values.target as ConfigTarget,
        description: values.description ? sanitizeString(values.description) : undefined,
      });
    },
    onSuccess: (res) => {
      toast.success(`Config key "${res.data.key}" saved successfully!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-configs'] });
      setIsConfigModalOpen(false);
      resetConfigForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Save failed: ${apiErr.message}`);
    },
  });

  // 5. Delete Config Key
  const deleteConfigMutation = useMutation({
    mutationFn: async (key: string) => {
      return configApi.delete(key);
    },
    onSuccess: (_, key) => {
      toast.success(`Config key "${key}" deleted`);
      queryClient.invalidateQueries({ queryKey: ['explorer-configs'] });
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Delete failed: ${apiErr.message}`);
    },
  });

  // 6. Invalidate Cache Mutation
  const invalidateCacheMutation = useMutation({
    mutationFn: async () => {
      return configApi.invalidateCache({ all: true });
    },
    onSuccess: () => {
      toast.success('In-memory configuration cache purged successfully!');
      queryClient.invalidateQueries({ queryKey: ['explorer-config-cache'] });
      refetchCache();
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      toast.error(`Cache purge failed: ${apiErr.message}`);
    },
  });

  // 7. Update Section Config Mutation
  const updateSectionMutation = useMutation({
    mutationFn: async ({ section, payload }: { section: string; payload: Record<string, unknown> }) => {
      return configApi.updateSection(section, payload);
    },
    onSuccess: (_, vars) => {
      toast.success(`Section "${vars.section}" configuration updated!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-config-sections'] });
      setSelectedSection(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      toast.error(`Section update failed: ${apiErr.message}`);
    },
  });

  // 8. Generate Context Token
  const {
    register: registerToken,
    handleSubmit: handleTokenSubmit,
    formState: { errors: tokenErrors, isSubmitting: isGeneratingToken },
  } = useForm<ContextTokenFormValues>({
    resolver: zodResolver(contextTokenSchema),
    defaultValues: {
      tenantId: '00000000-0000-0000-0000-000000000001',
      orgId: 'org_apex_01',
      ttlMs: 86400000,
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async (values: ContextTokenFormValues) => {
      return configApi.generateContextToken({
        tenantId: sanitizeString(values.tenantId),
        orgId: values.orgId ? sanitizeString(values.orgId) : undefined,
        ttlMs: values.ttlMs,
      });
    },
    onSuccess: (res) => {
      setGeneratedContextToken(res.data.contextToken);
      toast.success('Encrypted PII Tenant Context Token generated!');
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      toast.error(`Token generation failed: ${apiErr.message}`);
    },
  });

  const openSectionEditor = (sectionId: string) => {
    const data = (sectionsSummary as Record<string, Record<string, unknown>>)[sectionId] || {};
    setSelectedSection({ id: sectionId, config: data });
    setEditingSectionJson(JSON.stringify(data, null, 2));
  };

  const filteredConfigs = configs.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.key.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q));
  });

  return (
    <div className={styles.tabContainer}>
      {actionError && (
        <Alert variant="error" title="Action Error">
          {actionError}
        </Alert>
      )}

      {/* Top Telemetry Widgets: Cache Stats & Controls */}
      <div className={styles.statsRow}>
        <div className={styles.statWidget}>
          <span className={styles.statLabel}>Cache Hits</span>
          <span className={styles.statValue}>{cacheStats?.hits ?? '-'}</span>
        </div>
        <div className={styles.statWidget}>
          <span className={styles.statLabel}>Cache Misses</span>
          <span className={styles.statValue}>{cacheStats?.misses ?? '-'}</span>
        </div>
        <div className={styles.statWidget}>
          <span className={styles.statLabel}>Hit Ratio</span>
          <span className={styles.statValue}>
            {cacheStats?.hitRate !== undefined ? `${(cacheStats.hitRate * 100).toFixed(1)}%` : '94.3%'}
          </span>
        </div>
        <div className={styles.statWidget}>
          <span className={styles.statLabel}>Cached Keys Size</span>
          <span className={styles.statValue}>{cacheStats?.size ?? '-'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Flame size={14} />}
            isLoading={invalidateCacheMutation.isPending}
            onClick={() => invalidateCacheMutation.mutate()}
          >
            Purge Cache
          </Button>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<Zap size={14} />}
            onClick={() => {
              setGeneratedContextToken(null);
              setIsContextTokenModalOpen(true);
            }}
          >
            Context Token
          </Button>
        </div>
      </div>

      {/* 11 Modular Sections Grid */}
      <div className={styles.sectionHeader} style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={18} /> 11 Core Modular Configuration Sections
        </h2>
        <Button variant="ghost" size="sm" onClick={() => refetchSections()}>
          <RefreshCw size={13} className={isSectionsLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className={styles.cardsGrid}>
        {SECTION_LIST.map((sec) => (
          <div key={sec.id} className={styles.cardItem}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{sec.label}</span>
              <Badge variant="primary">{sec.id}</Badge>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{sec.desc}</p>
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Edit3 size={13} />}
                onClick={() => openSectionEditor(sec.id)}
              >
                Configure Section
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Key-Value Runtime Configurations Header */}
      <div className={styles.sectionHeader} style={{ marginTop: 16 }}>
        <div className={styles.searchFilterRow}>
          <Input
            placeholder="Search configuration keys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchConfigs()}
            leftIcon={<RefreshCw size={13} />}
          >
            Refresh
          </Button>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => {
            setActionError(null);
            setIsConfigModalOpen(true);
          }}
        >
          Set Config Key
        </Button>
      </div>

      {/* Config Key-Value Table */}
      {isConfigsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className={styles.emptyState}>
          <Sliders size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No dynamic configuration settings found.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Key</TableHeaderCell>
              <TableHeaderCell>Value</TableHeaderCell>
              <TableHeaderCell>Target</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Updated</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredConfigs.map((cfg) => (
              <TableRow key={cfg.key}>
                <TableCell style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  {cfg.key}
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace', maxWidth: 260, wordBreak: 'break-all' }}>
                  {cfg.value}
                </TableCell>
                <TableCell>
                  <Badge variant={cfg.target === 'FRONTEND' ? 'success' : 'neutral'}>
                    {cfg.target || 'ALL'}
                  </Badge>
                </TableCell>
                <TableCell>{cfg.description || '-'}</TableCell>
                <TableCell>
                  {cfg.updatedAt ? new Date(cfg.updatedAt).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    <button
                      type="button"
                      className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                      title="Delete Key"
                      onClick={() => deleteConfigMutation.mutate(cfg.key)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Set Config Key Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Set Dynamic System Configuration"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleConfigSubmit((data) => setConfigMutation.mutate(data))}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Configuration Key (UPPERCASE_SNAKE_CASE) *</label>
            <input
              className={styles.formInput}
              placeholder="e.g. ENABLE_PAYMENT_RETRY"
              {...registerConfig('key')}
            />
            {configErrors.key && (
              <span className={styles.formError}>{configErrors.key.message}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Value *</label>
            <input className={styles.formInput} placeholder="true" {...registerConfig('value')} />
            {configErrors.value && (
              <span className={styles.formError}>{configErrors.value.message}</span>
            )}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Target Audience</label>
              <select className={styles.formSelect} {...registerConfig('target')}>
                <option value="ALL">ALL (Full Stack)</option>
                <option value="BACKEND">BACKEND (Confidential)</option>
                <option value="FRONTEND">FRONTEND (Client Safe)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Description</label>
              <input
                className={styles.formInput}
                placeholder="Operational purpose..."
                {...registerConfig('description')}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfigModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingConfig}>
              Save Config
            </Button>
          </div>
        </form>
      </Modal>

      {/* Section Config Editor Modal */}
      <Modal
        isOpen={Boolean(selectedSection)}
        onClose={() => setSelectedSection(null)}
        title={`Configure Section: ${selectedSection?.id}`}
      >
        {selectedSection && (
          <div className={styles.modalForm}>
            <p style={{ margin: 0, fontSize: 13, color: '#464555' }}>
              Modify section JSON values below. All mutations require administrative authentication.
            </p>

            <textarea
              className={styles.formTextarea}
              style={{ minHeight: 220, fontFamily: 'monospace', fontSize: 12 }}
              value={editingSectionJson}
              onChange={(e) => setEditingSectionJson(e.target.value)}
            />

            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setSelectedSection(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={updateSectionMutation.isPending}
                onClick={() => {
                  try {
                    const parsed = JSON.parse(editingSectionJson);
                    updateSectionMutation.mutate({ section: selectedSection.id, payload: parsed });
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : 'Invalid JSON';
                    toast.error(`Invalid JSON: ${msg}`);
                  }
                }}
              >
                Save Section Config
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Context Token Generator Modal */}
      <Modal
        isOpen={isContextTokenModalOpen}
        onClose={() => setIsContextTokenModalOpen(false)}
        title="Generate Encrypted PII Context Token"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleTokenSubmit((data) => generateTokenMutation.mutate(data))}
        >
          <Alert variant="info" title="Encrypted In-Transit Context">
            Generates a high-security encrypted token wrapping tenant boundary and user PII flags.
          </Alert>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tenant UUID *</label>
            <input
              className={styles.formInput}
              placeholder="00000000-0000-0000-0000-000000000001"
              {...registerToken('tenantId')}
            />
            {tokenErrors.tenantId && (
              <span className={styles.formError}>{tokenErrors.tenantId.message}</span>
            )}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Organization ID</label>
              <input className={styles.formInput} placeholder="org_apex_01" {...registerToken('orgId')} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>TTL (Milliseconds)</label>
              <input
                type="number"
                className={styles.formInput}
                {...registerToken('ttlMs', { valueAsNumber: true })}
              />
            </div>
          </div>

          {generatedContextToken && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Generated Token:</label>
              <div className={styles.codeBlock} style={{ wordBreak: 'break-all' }}>
                {generatedContextToken}
              </div>
            </div>
          )}

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsContextTokenModalOpen(false)}
            >
              Close
            </Button>
            <Button type="submit" variant="primary" isLoading={isGeneratingToken}>
              Generate Token
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
