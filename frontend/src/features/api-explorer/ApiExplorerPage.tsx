import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Sliders,
  ShieldCheck,
  Bell,
  Database,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Activity,
  RefreshCw,
  Send,
  ChevronRight,
} from 'lucide-react';
import { organizationsApi, OrganizationDto, CreateOrganizationPayload } from '../../core/api/services/organizationsApi';
import { configApi, SetConfigPayload } from '../../core/api/services/configApi';
import { rbacApi, CreateRolePayload } from '../../core/api/services/rbacApi';
import { notificationsApi, SendNotificationPayload } from '../../core/api/services/notificationsApi';
import { recordsApi } from '../../core/api/services/recordsApi';
import { apiClient } from '../../core/api/client';
import { useApiTrafficStore } from '../../core/api/trafficStore';
import { useTenant } from '../../core/tenant/TenantContext';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Badge } from '../../components/ui/Badge/Badge';
import { Spinner } from '../../components/ui/Spinner/Spinner';
import { Modal } from '../../components/ui/Modal/Modal';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui/Table/Table';
import styles from './ApiExplorerPage.module.css';

type ExplorerTab = 'organizations' | 'config' | 'rbac' | 'notifications' | 'records';

export const ApiExplorerPage: React.FC = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const { toggleDrawer, records: trafficRecords } = useApiTrafficStore();

  const [activeTab, setActiveTab] = useState<ExplorerTab>('organizations');

  // Ping Health state
  const [healthStatus, setHealthStatus] = useState<{ status: string; durationMs: number; time: string } | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Search & Filter States
  const [orgSearch, setOrgSearch] = useState('');
  const [orgTier, setOrgTier] = useState<string>('all');
  const [configSearch, setConfigSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');

  // Modals
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationDto | null>(null);
  const [orgFormData, setOrgFormData] = useState<CreateOrganizationPayload>({
    name: '',
    slug: '',
    domain: '',
    industry: 'technology',
    tier: 'STARTER',
    ownerEmail: '',
  });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configFormData, setConfigFormData] = useState<SetConfigPayload>({
    key: '',
    value: '',
    target: 'ALL',
    description: '',
  });

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState<CreateRolePayload>({
    name: '',
    description: '',
    permissions: ['records:read', 'records:write'],
  });

  // Notification form
  const [notifFormData, setNotifFormData] = useState<SendNotificationPayload>({
    recipient: 'admin@enterprise.local',
    channel: 'EMAIL',
    subject: 'Operational Telemetry Test Alert',
    body: 'Automated notification test executed via Frontend Swagger Explorer.',
    provider: 'SENDGRID',
    dryRun: true,
  });

  // 1. Health Ping
  const handlePingBackend = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await apiClient.get<any>('/health');
      const durationMs = Math.round(performance.now() - start);
      setHealthStatus({
        status: res.data?.status === true || res.data?.data?.status ? 'HEALTHY (200 OK)' : 'OK',
        durationMs,
        time: new Date().toLocaleTimeString(),
      });
    } catch (e: any) {
      const durationMs = Math.round(performance.now() - start);
      setHealthStatus({
        status: `OFFLINE / FALLBACK: ${e.message}`,
        durationMs,
        time: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsPinging(false);
    }
  };

  // 2. Organizations Queries & Mutations
  const { data: orgsData = [], isLoading: isOrgsLoading } = useQuery({
    queryKey: ['explorer-organizations', orgSearch, orgTier],
    queryFn: async () => {
      const res = await organizationsApi.list({
        search: orgSearch || undefined,
        tier: orgTier !== 'all' ? (orgTier as any) : undefined,
      });
      return res.data;
    },
  });

  const saveOrgMutation = useMutation({
    mutationFn: async () => {
      if (editingOrg) {
        await organizationsApi.update(editingOrg.id, orgFormData);
      } else {
        await organizationsApi.create(orgFormData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explorer-organizations'] });
      setIsOrgModalOpen(false);
      setEditingOrg(null);
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async (id: string) => {
      await organizationsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explorer-organizations'] });
    },
  });

  // 3. Dynamic Config Queries & Mutations
  const { data: configsData = [], isLoading: isConfigsLoading } = useQuery({
    queryKey: ['explorer-configs'],
    queryFn: async () => {
      const res = await configApi.list();
      return res.data;
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: SetConfigPayload) => {
      await configApi.set(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explorer-configs'] });
      setIsConfigModalOpen(false);
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (key: string) => {
      await configApi.delete(key);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explorer-configs'] });
    },
  });

  // 4. RBAC Roles Queries & Mutations
  const { data: rolesData = [], isLoading: isRolesLoading } = useQuery({
    queryKey: ['explorer-roles', roleSearch],
    queryFn: async () => {
      const res = await rbacApi.listRoles({ search: roleSearch || undefined });
      return res.data;
    },
  });

  const saveRoleMutation = useMutation({
    mutationFn: async (payload: CreateRolePayload) => {
      await rbacApi.createRole(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explorer-roles'] });
      setIsRoleModalOpen(false);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      await rbacApi.deleteRole(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explorer-roles'] });
    },
  });

  // 5. Notifications Queries & Mutations
  const { data: notificationsData = [], isLoading: isNotifsLoading } = useQuery({
    queryKey: ['explorer-notifications'],
    queryFn: async () => {
      const res = await notificationsApi.list();
      return res.data;
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (payload: SendNotificationPayload) => {
      await notificationsApi.send(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explorer-notifications'] });
    },
  });

  // 6. Records Query
  const { data: recordsData = [], isLoading: isRecordsLoading } = useQuery({
    queryKey: ['explorer-records', tenant.identity.slug],
    queryFn: async () => {
      const res = await recordsApi.list({ tenantId: tenant.identity.id });
      return res.data;
    },
  });

  return (
    <div className={styles.container}>
      {/* Breadcrumbs */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <span>Workspace</span>
        <ChevronRight size={13} />
        <span className={styles.breadcrumbActive}>API Operations &amp; CRUD Workbench</span>
      </nav>

      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>API Operations &amp; Live CRUD Workbench</h1>
          <p className={styles.subtitle}>
            Interactive CRUD operations and telemetric communication testing for{' '}
            <code>http://localhost:4000/api-docs/</code>
          </p>
        </div>

        <div className={styles.headerActions}>
          <a
            href="http://localhost:4000/api-docs/"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Button variant="outline" size="sm" leftIcon={<ExternalLink size={14} />}>
              Open Swagger UI (:4000)
            </Button>
          </a>

          <Button
            variant="primary"
            size="sm"
            onClick={toggleDrawer}
            leftIcon={<Activity size={14} />}
          >
            Traffic Inspector ({trafficRecords.length})
          </Button>
        </div>
      </div>

      {/* Health Check Banner */}
      <div className={styles.healthBanner}>
        <div className={styles.healthLeft}>
          <span className={styles.healthDot} />
          <div>
            <div className={styles.healthText}>
              <strong>Target Ingress Gateway:</strong> <code>http://localhost:4000</code> &bull; Unified REST &amp; gRPC
            </div>
            {healthStatus && (
              <div className={styles.healthMeta}>
                Status: {healthStatus.status} | Roundtrip Latency: {healthStatus.durationMs}ms | Checked: {healthStatus.time}
              </div>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handlePingBackend}
          disabled={isPinging}
          leftIcon={<RefreshCw size={13} className={isPinging ? 'animate-spin' : ''} />}
        >
          {isPinging ? 'Testing…' : 'Ping Gateway'}
        </Button>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'organizations'}
          className={`${styles.tabBtn} ${activeTab === 'organizations' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('organizations')}
        >
          <Building2 size={16} /> Organizations CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'config'}
          className={`${styles.tabBtn} ${activeTab === 'config' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <Sliders size={16} /> Dynamic Config CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rbac'}
          className={`${styles.tabBtn} ${activeTab === 'rbac' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('rbac')}
        >
          <ShieldCheck size={16} /> RBAC Roles CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notifications'}
          className={`${styles.tabBtn} ${activeTab === 'notifications' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={16} /> Notifications &amp; Outbox
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'records'}
          className={`${styles.tabBtn} ${activeTab === 'records' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('records')}
        >
          <Database size={16} /> Tenant Data Records
        </button>
      </div>

      {/* Section Content */}
      <div className={styles.sectionCard}>
        {/* TAB 1: ORGANIZATIONS */}
        {activeTab === 'organizations' && (
          <>
            <div className={styles.sectionHeader}>
              <div className={styles.searchFilterRow}>
                <Input
                  placeholder="Search organizations..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  style={{ maxWidth: 280 }}
                />
                <select
                  value={orgTier}
                  onChange={(e) => setOrgTier(e.target.value)}
                  className={styles.formSelect}
                >
                  <option value="all">All Tiers</option>
                  <option value="STARTER">Starter</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setEditingOrg(null);
                  setOrgFormData({
                    name: '',
                    slug: '',
                    domain: '',
                    industry: 'technology',
                    tier: 'STARTER',
                    ownerEmail: '',
                  });
                  setIsOrgModalOpen(true);
                }}
              >
                Create Organization
              </Button>
            </div>

            {isOrgsLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spinner size={32} /></div>
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
                  {orgsData.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell style={{ fontWeight: 600 }}>{org.name}</TableCell>
                      <TableCell style={{ fontFamily: 'monospace', fontSize: 12 }}>{org.slug}</TableCell>
                      <TableCell>{org.industry}</TableCell>
                      <TableCell><Badge variant="primary">{org.tier}</Badge></TableCell>
                      <TableCell><Badge variant={org.status === 'ACTIVE' ? 'success' : 'neutral'}>{org.status}</Badge></TableCell>
                      <TableCell style={{ color: 'var(--color-muted)', fontSize: 12 }}>{org.domain || '—'}</TableCell>
                      <TableCell>
                        <div className={styles.actionsCell}>
                          <button
                            className={styles.actionIconBtn}
                            title="Edit Organization"
                            onClick={() => {
                              setEditingOrg(org);
                              setOrgFormData({
                                name: org.name,
                                slug: org.slug,
                                domain: org.domain || '',
                                industry: org.industry,
                                tier: org.tier,
                              });
                              setIsOrgModalOpen(true);
                            }}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                            title="Delete Organization"
                            onClick={() => deleteOrgMutation.mutate(org.id)}
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
          </>
        )}

        {/* TAB 2: DYNAMIC CONFIG */}
        {activeTab === 'config' && (
          <>
            <div className={styles.sectionHeader}>
              <div className={styles.searchFilterRow}>
                <Input
                  placeholder="Filter configuration key..."
                  value={configSearch}
                  onChange={(e) => setConfigSearch(e.target.value)}
                  style={{ maxWidth: 280 }}
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setConfigFormData({ key: '', value: '', target: 'ALL', description: '' });
                  setIsConfigModalOpen(true);
                }}
              >
                Set Dynamic Config Key
              </Button>
            </div>

            {isConfigsLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spinner size={32} /></div>
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
                  {configsData
                    .filter((c) => !configSearch || c.key.toLowerCase().includes(configSearch.toLowerCase()))
                    .map((cfg) => (
                      <TableRow key={cfg.key}>
                        <TableCell style={{ fontWeight: 700, fontFamily: 'monospace' }}>{cfg.key}</TableCell>
                        <TableCell style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{cfg.value}</TableCell>
                        <TableCell><Badge variant="neutral">{cfg.target || 'ALL'}</Badge></TableCell>
                        <TableCell style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{cfg.description || '—'}</TableCell>
                        <TableCell style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                          {cfg.updatedAt ? new Date(cfg.updatedAt).toLocaleTimeString() : '—'}
                        </TableCell>
                        <TableCell>
                          <div className={styles.actionsCell}>
                            <button
                              className={styles.actionIconBtn}
                              title="Edit Config"
                              onClick={() => {
                                setConfigFormData({
                                  key: cfg.key,
                                  value: cfg.value,
                                  target: cfg.target || 'ALL',
                                  description: cfg.description || '',
                                });
                                setIsConfigModalOpen(true);
                              }}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                              title="Delete Config"
                              onClick={() => deleteConfigMutation.mutate(cfg.key)}
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
          </>
        )}

        {/* TAB 3: RBAC ROLES */}
        {activeTab === 'rbac' && (
          <>
            <div className={styles.sectionHeader}>
              <div className={styles.searchFilterRow}>
                <Input
                  placeholder="Search roles..."
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  style={{ maxWidth: 280 }}
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setRoleFormData({ name: '', description: '', permissions: ['records:read'] });
                  setIsRoleModalOpen(true);
                }}
              >
                Create Custom Role
              </Button>
            </div>

            {isRolesLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spinner size={32} /></div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Role Name</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Description</TableHeaderCell>
                    <TableHeaderCell>Permissions</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rolesData.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell style={{ fontWeight: 700 }}>{role.name}</TableCell>
                      <TableCell>
                        <Badge variant={role.isSystem ? 'neutral' : 'warning'}>
                          {role.isSystem ? 'System' : 'Custom'}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ fontSize: 13 }}>{role.description || '—'}</TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(role.permissions || []).slice(0, 3).map((p) => (
                            <span
                              key={p}
                              style={{
                                fontSize: 10,
                                fontFamily: 'monospace',
                                padding: '1px 5px',
                                background: '#f1f5f9',
                                borderRadius: 3,
                              }}
                            >
                              {p}
                            </span>
                          ))}
                          {(role.permissions || []).length > 3 && (
                            <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
                              +{(role.permissions || []).length - 3} more
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={styles.actionsCell}>
                          {!role.isSystem && (
                            <button
                              className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                              title="Delete Role"
                              onClick={() => deleteRoleMutation.mutate(role.id)}
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
          </>
        )}

        {/* TAB 4: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700 }}>
                Dispatch Multi-Channel Notification
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Test adapter dispatching (SendGrid, Twilio, FCM, Meta Cloud, or Mock DRY-Run).
              </p>
            </div>

            <form
              className={styles.dispatchForm}
              onSubmit={(e) => {
                e.preventDefault();
                sendNotificationMutation.mutate(notifFormData);
              }}
            >
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Channel</label>
                <select
                  value={notifFormData.channel}
                  onChange={(e) => setNotifFormData({ ...notifFormData, channel: e.target.value as any })}
                  className={styles.formSelect}
                >
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PUSH">Push</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Recipient</label>
                <input
                  type="text"
                  value={notifFormData.recipient}
                  onChange={(e) => setNotifFormData({ ...notifFormData, recipient: e.target.value })}
                  className={styles.formInput}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Subject</label>
                <input
                  type="text"
                  value={notifFormData.subject}
                  onChange={(e) => setNotifFormData({ ...notifFormData, subject: e.target.value })}
                  className={styles.formInput}
                  required
                />
              </div>

              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.formLabel}>Message Body</label>
                <textarea
                  value={notifFormData.body}
                  onChange={(e) => setNotifFormData({ ...notifFormData, body: e.target.value })}
                  className={styles.formTextarea}
                  required
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={notifFormData.dryRun}
                    onChange={(e) => setNotifFormData({ ...notifFormData, dryRun: e.target.checked })}
                  />
                  <span>Simulate in DRY-RUN mode (records to developer outbox without hitting external provider)</span>
                </label>

                <Button
                  type="submit"
                  variant="primary"
                  leftIcon={<Send size={14} />}
                  disabled={sendNotificationMutation.isPending}
                >
                  {sendNotificationMutation.isPending ? 'Dispatching…' : 'Dispatch Notification'}
                </Button>
              </div>
            </form>

            <div style={{ marginTop: 20 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700 }}>
                Sent Logs &amp; DRY-Run Outbox
              </h4>
              {isNotifsLoading ? (
                <Spinner size={24} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Recipient</TableHeaderCell>
                      <TableHeaderCell>Channel</TableHeaderCell>
                      <TableHeaderCell>Subject</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Mode</TableHeaderCell>
                      <TableHeaderCell>Provider</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {notificationsData.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell style={{ fontWeight: 600 }}>{n.recipient}</TableCell>
                        <TableCell><Badge variant="primary">{n.channel}</Badge></TableCell>
                        <TableCell>{n.subject}</TableCell>
                        <TableCell><Badge variant={n.status === 'DELIVERED' ? 'success' : 'warning'}>{n.status}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={n.isDryRun ? 'neutral' : 'success'}>
                            {n.isDryRun ? 'DRY-RUN' : 'LIVE'}
                          </Badge>
                        </TableCell>
                        <TableCell style={{ fontSize: 12, color: 'var(--color-muted)' }}>{n.provider || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}

        {/* TAB 5: TENANT RECORDS */}
        {activeTab === 'records' && (
          <>
            <div className={styles.sectionHeader}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Entity Records for active tenant: <code>{tenant.identity.displayName}</code> ({recordsData.length} records)
              </span>
            </div>

            {isRecordsLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spinner size={32} /></div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Title</TableHeaderCell>
                    <TableHeaderCell>Category</TableHeaderCell>
                    <TableHeaderCell>Priority</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recordsData.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell style={{ fontWeight: 600 }}>{rec.title}</TableCell>
                      <TableCell style={{ color: 'var(--color-text-secondary)' }}>{rec.category}</TableCell>
                      <TableCell><Badge variant="primary">{rec.priority.toUpperCase()}</Badge></TableCell>
                      <TableCell><Badge variant="success">{rec.status.toUpperCase()}</Badge></TableCell>
                      <TableCell style={{ fontWeight: 700 }}>${rec.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </div>

      {/* Modal: Organization Create/Edit */}
      <Modal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        title={editingOrg ? 'Edit Organization' : 'Create Organization'}
      >
        <form
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            saveOrgMutation.mutate();
          }}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Organization Name</label>
            <input
              type="text"
              className={styles.formInput}
              value={orgFormData.name}
              onChange={(e) => setOrgFormData({ ...orgFormData, name: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Slug</label>
            <input
              type="text"
              className={styles.formInput}
              value={orgFormData.slug}
              onChange={(e) => setOrgFormData({ ...orgFormData, slug: e.target.value })}
              placeholder="e.g. acme-corp"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Industry</label>
            <input
              type="text"
              className={styles.formInput}
              value={orgFormData.industry}
              onChange={(e) => setOrgFormData({ ...orgFormData, industry: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tier</label>
            <select
              value={orgFormData.tier}
              onChange={(e) => setOrgFormData({ ...orgFormData, tier: e.target.value as any })}
              className={styles.formSelect}
            >
              <option value="FREE">Free</option>
              <option value="STARTER">Starter</option>
              <option value="PROFESSIONAL">Professional</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Custom Domain</label>
            <input
              type="text"
              className={styles.formInput}
              value={orgFormData.domain || ''}
              onChange={(e) => setOrgFormData({ ...orgFormData, domain: e.target.value })}
              placeholder="e.g. portal.acme.com"
            />
          </div>

          <div className={styles.modalFooter}>
            <Button variant="outline" type="button" onClick={() => setIsOrgModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saveOrgMutation.isPending}>
              {saveOrgMutation.isPending ? 'Saving…' : 'Save Organization'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Dynamic Config Set */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Set Dynamic System Configuration"
      >
        <form
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            saveConfigMutation.mutate(configFormData);
          }}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Config Key (SCREAMING_SNAKE_CASE)</label>
            <input
              type="text"
              className={styles.formInput}
              value={configFormData.key}
              onChange={(e) => setConfigFormData({ ...configFormData, key: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Value</label>
            <input
              type="text"
              className={styles.formInput}
              value={configFormData.value}
              onChange={(e) => setConfigFormData({ ...configFormData, value: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Target</label>
            <select
              value={configFormData.target}
              onChange={(e) => setConfigFormData({ ...configFormData, target: e.target.value as any })}
              className={styles.formSelect}
            >
              <option value="ALL">ALL (Frontend &amp; Backend)</option>
              <option value="BACKEND">BACKEND Only</option>
              <option value="FRONTEND">FRONTEND Only</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <input
              type="text"
              className={styles.formInput}
              value={configFormData.description || ''}
              onChange={(e) => setConfigFormData({ ...configFormData, description: e.target.value })}
            />
          </div>

          <div className={styles.modalFooter}>
            <Button variant="outline" type="button" onClick={() => setIsConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saveConfigMutation.isPending}>
              {saveConfigMutation.isPending ? 'Saving…' : 'Save Configuration'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: RBAC Custom Role Create */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Create Custom Role"
      >
        <form
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            saveRoleMutation.mutate(roleFormData);
          }}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Role Name</label>
            <input
              type="text"
              className={styles.formInput}
              value={roleFormData.name}
              onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value.toUpperCase() })}
              placeholder="e.g. OPERATIONS_AUDITOR"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <input
              type="text"
              className={styles.formInput}
              value={roleFormData.description || ''}
              onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
              placeholder="Role description"
            />
          </div>

          <div className={styles.modalFooter}>
            <Button variant="outline" type="button" onClick={() => setIsRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saveRoleMutation.isPending}>
              {saveRoleMutation.isPending ? 'Creating…' : 'Create Role'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
