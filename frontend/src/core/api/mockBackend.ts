export interface EntityRecord {
  id: string;
  tenantId: string;
  title: string;
  category: string;
  amount: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'pending' | 'completed' | 'archived';
  notes: string;
  createdAt: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  industry: string;
  tier: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'DEACTIVATED';
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigRecord {
  key: string;
  value: string;
  description?: string;
  isEncrypted?: boolean;
  target?: 'BACKEND' | 'FRONTEND' | 'ALL';
  updatedAt?: string;
}

export interface RoleRecord {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  tenantId?: string;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  recipient: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP' | 'WEBHOOK';
  subject: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';
  provider?: string;
  providerMessageId?: string;
  isDryRun?: boolean;
  createdAt: string;
  sentAt?: string;
}

const INITIAL_RECORDS: Record<string, EntityRecord[]> = {
  'apex-health': [
    {
      id: 'rec_hlth_101',
      tenantId: 'ten_apex_health_01',
      title: 'MRI Scan & Diagnostic Workup #8921',
      category: 'Diagnostic Radiology',
      amount: 1450.0,
      priority: 'high',
      status: 'active',
      notes: 'Contrast study completed. Awaiting radiologist review.',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'rec_hlth_102',
      tenantId: 'ten_apex_health_01',
      title: 'ICU Telemetry Monitoring Ward B',
      category: 'Critical Care',
      amount: 3200.0,
      priority: 'critical',
      status: 'active',
      notes: 'Continuous hemodynamic telemetry streaming normal.',
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
      id: 'rec_hlth_103',
      tenantId: 'ten_apex_health_01',
      title: 'Pharmaceutical Formulary Batch #774',
      category: 'Pharmacy Supply',
      amount: 875.5,
      priority: 'medium',
      status: 'completed',
      notes: 'Cold-chain shipment verified at 3.2°C.',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ],
  'nexus-logistics': [
    {
      id: 'rec_log_201',
      tenantId: 'ten_nexus_logistics_02',
      title: 'Intermodal Freight Waybill #NX-9982',
      category: 'Cross-Border Transit',
      amount: 4850.0,
      priority: 'high',
      status: 'active',
      notes: 'Customs cleared at Port of Hamburg. ETA 18:00.',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'rec_log_202',
      tenantId: 'ten_nexus_logistics_02',
      title: 'Cold Storage Container Telemetry #RF-44',
      category: 'Temperature Controlled',
      amount: 2200.0,
      priority: 'critical',
      status: 'active',
      notes: 'Sensor alarm resolved. Core temp steady at -18°C.',
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
    {
      id: 'rec_log_203',
      tenantId: 'ten_nexus_logistics_02',
      title: 'Fleet Preventive Maintenance Inspection #TR-12',
      category: 'Fleet Operations',
      amount: 980.0,
      priority: 'low',
      status: 'completed',
      notes: 'Brake pads and tire rotation signed off.',
      createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    },
  ],
  'aura-fintech': [
    {
      id: 'rec_fin_301',
      tenantId: 'ten_aura_fintech_03',
      title: 'Institutional Liquidity Facility Tranche A',
      category: 'Private Credit',
      amount: 250000.0,
      priority: 'critical',
      status: 'active',
      notes: 'Smart contract escrow lock verified on-chain.',
      createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    },
    {
      id: 'rec_fin_302',
      tenantId: 'ten_aura_fintech_03',
      title: 'Cross-Currency FX Hedge EUR/USD',
      category: 'Derivatives',
      amount: 85000.0,
      priority: 'high',
      status: 'completed',
      notes: 'Settled via Fedwire clearing gateway.',
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
    {
      id: 'rec_fin_303',
      tenantId: 'ten_aura_fintech_03',
      title: 'High-Yield Municipal Bond Allocation',
      category: 'Fixed Income',
      amount: 45000.0,
      priority: 'medium',
      status: 'active',
      notes: 'Coupon yield 4.85% accrued monthly.',
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
  ],
};

const INITIAL_ORGANIZATIONS: OrganizationRecord[] = [
  {
    id: 'org_apex_01',
    name: 'Apex Health Systems',
    slug: 'apex-health',
    domain: 'health.apex.global',
    industry: 'healthcare',
    tier: 'ENTERPRISE',
    status: 'ACTIVE',
    branding: { primaryColor: '#0ea5e9', secondaryColor: '#0284c7' },
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'org_nexus_02',
    name: 'Nexus Supply Chain Logistics',
    slug: 'nexus-logistics',
    domain: 'nexus-logistics.io',
    industry: 'logistics',
    tier: 'PROFESSIONAL',
    status: 'ACTIVE',
    branding: { primaryColor: '#f97316', secondaryColor: '#ea580c' },
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'org_aura_03',
    name: 'Aura Capital Markets',
    slug: 'aura-fintech',
    domain: 'auracapital.finance',
    industry: 'fintech',
    tier: 'ENTERPRISE',
    status: 'ACTIVE',
    branding: { primaryColor: '#10b981', secondaryColor: '#059669' },
    createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

const INITIAL_CONFIGS: ConfigRecord[] = [
  {
    key: 'ACTIVE_PAYMENT_GATEWAY',
    value: 'STRIPE_PROD_V3',
    description: 'Primary payment processor integration for transaction settlement',
    target: 'BACKEND',
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'ENABLE_MFA_ENFORCEMENT',
    value: 'true',
    description: 'Mandatory TOTP / WebAuthn MFA gate for elevated roles',
    target: 'ALL',
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'AUDIT_RETENTION_DAYS',
    value: '365',
    description: 'Retention threshold for immutable security audit stream',
    target: 'BACKEND',
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'MAX_BATCH_INGESTION_SIZE',
    value: '500',
    description: 'Batch processing threshold for async message consumer queues',
    target: 'BACKEND',
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'DEFAULT_THEME_ACCENT',
    value: 'emerald',
    description: 'Default client UI color theme token',
    target: 'FRONTEND',
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_ROLES: RoleRecord[] = [
  {
    id: 'role_admin',
    name: 'ADMIN',
    description: 'Full platform administration, security management, and tenant provisioning',
    isSystem: true,
    permissions: ['*'],
    createdAt: new Date(Date.now() - 86400000 * 100).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role_support',
    name: 'SUPPORT',
    description: 'Support technician access with audit inspection and read-only directory',
    isSystem: true,
    permissions: ['audit:read', 'users:read', 'records:read'],
    createdAt: new Date(Date.now() - 86400000 * 80).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role_user',
    name: 'USER',
    description: 'Standard tenant collaborator with read and write permissions to tenant workspace',
    isSystem: true,
    permissions: ['records:create', 'records:read', 'records:update'],
    createdAt: new Date(Date.now() - 86400000 * 70).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role_custom_auditor',
    name: 'COMPLIANCE_AUDITOR',
    description: 'Custom compliance inspector role with real-time audit stream access',
    isSystem: false,
    permissions: ['audit:read', 'telemetry:read', 'reports:export'],
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_NOTIFICATIONS: NotificationRecord[] = [
  {
    id: 'notif_1',
    recipient: 'compliance@enterprise.local',
    channel: 'EMAIL',
    subject: 'Security Audit: RS256 Key Rotation Completed',
    body: 'Automated cryptographic key rotation executed with zero downtime.',
    status: 'DELIVERED',
    provider: 'SENDGRID',
    providerMessageId: 'sg_msg_9821389',
    isDryRun: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    sentAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'notif_2',
    recipient: '+15550192834',
    channel: 'SMS',
    subject: 'MFA OTP Verification',
    body: 'Your single-use authorization token is 849-201. Valid for 5 minutes.',
    status: 'SENT',
    provider: 'TWILIO',
    providerMessageId: 'tw_msg_338910',
    isDryRun: true,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    sentAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

// In-Memory state
const recordsMemory = { ...INITIAL_RECORDS };
let organizationsMemory = [...INITIAL_ORGANIZATIONS];
let configsMemory = [...INITIAL_CONFIGS];
let rolesMemory = [...INITIAL_ROLES];
let notificationsMemory = [...INITIAL_NOTIFICATIONS];

export const mockBackend = {
  // --- Records ---
  getRecords(tenantSlug: string): EntityRecord[] {
    return recordsMemory[tenantSlug] || [];
  },

  getRecord(tenantSlug: string, recordId: string): EntityRecord | undefined {
    const list = recordsMemory[tenantSlug] || [];
    return list.find((r) => r.id === recordId);
  },

  createRecord(tenantSlug: string, record: Omit<EntityRecord, 'id' | 'createdAt'>): EntityRecord {
    const newRecord: EntityRecord = {
      ...record,
      id: `rec_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
    };
    if (!recordsMemory[tenantSlug]) {
      recordsMemory[tenantSlug] = [];
    }
    recordsMemory[tenantSlug] = [newRecord, ...recordsMemory[tenantSlug]];
    return newRecord;
  },

  updateRecord(
    tenantSlug: string,
    recordId: string,
    updates: Partial<Omit<EntityRecord, 'id' | 'createdAt' | 'tenantId'>>
  ): EntityRecord | undefined {
    if (!recordsMemory[tenantSlug]) {
      return undefined;
    }
    const index = recordsMemory[tenantSlug].findIndex((r) => r.id === recordId);
    if (index === -1) {
      return undefined;
    }
    const updated: EntityRecord = {
      ...recordsMemory[tenantSlug][index]!,
      ...updates,
    };
    recordsMemory[tenantSlug][index] = updated;
    return updated;
  },

  deleteRecord(tenantSlug: string, recordId: string): void {
    if (recordsMemory[tenantSlug]) {
      recordsMemory[tenantSlug] = recordsMemory[tenantSlug].filter((r) => r.id !== recordId);
    }
  },

  // --- Organizations CRUD ---
  getOrganizations(query?: { search?: string; status?: string; tier?: string }): OrganizationRecord[] {
    return organizationsMemory.filter((org) => {
      if (query?.status && org.status !== query.status) return false;
      if (query?.tier && org.tier !== query.tier) return false;
      if (query?.search) {
        const s = query.search.toLowerCase();
        return org.name.toLowerCase().includes(s) || org.slug.toLowerCase().includes(s);
      }
      return true;
    });
  },

  getOrganization(idOrSlug: string): OrganizationRecord | undefined {
    return organizationsMemory.find((o) => o.id === idOrSlug || o.slug === idOrSlug);
  },

  createOrganization(data: Partial<OrganizationRecord>): OrganizationRecord {
    const slug = data.slug || data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'org';
    const newOrg: OrganizationRecord = {
      id: `org_${Date.now().toString(36)}`,
      name: data.name || 'New Organization',
      slug,
      domain: data.domain || null,
      industry: data.industry || 'technology',
      tier: (data.tier as OrganizationRecord['tier']) || 'STARTER',
      status: (data.status as OrganizationRecord['status']) || 'ACTIVE',
      branding: data.branding,
      settings: data.settings || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    organizationsMemory = [newOrg, ...organizationsMemory];
    return newOrg;
  },

  updateOrganization(id: string, updates: Partial<OrganizationRecord>): OrganizationRecord | undefined {
    const idx = organizationsMemory.findIndex((o) => o.id === id || o.slug === id);
    if (idx === -1) return undefined;
    const updated: OrganizationRecord = {
      ...organizationsMemory[idx]!,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    organizationsMemory[idx] = updated;
    return updated;
  },

  deleteOrganization(id: string): boolean {
    const beforeLen = organizationsMemory.length;
    organizationsMemory = organizationsMemory.filter((o) => o.id !== id && o.slug !== id);
    return organizationsMemory.length < beforeLen;
  },

  // --- Config CRUD ---
  getConfigs(): ConfigRecord[] {
    return [...configsMemory];
  },

  getConfig(key: string): ConfigRecord | undefined {
    return configsMemory.find((c) => c.key === key);
  },

  setConfig(payload: { key: string; value: string; description?: string; target?: ConfigRecord['target'] }): ConfigRecord {
    const idx = configsMemory.findIndex((c) => c.key === payload.key);
    const updated: ConfigRecord = {
      key: payload.key,
      value: payload.value,
      description: payload.description,
      target: payload.target || 'ALL',
      updatedAt: new Date().toISOString(),
    };
    if (idx !== -1) {
      configsMemory[idx] = updated;
    } else {
      configsMemory = [updated, ...configsMemory];
    }
    return updated;
  },

  deleteConfig(key: string): boolean {
    const beforeLen = configsMemory.length;
    configsMemory = configsMemory.filter((c) => c.key !== key);
    return configsMemory.length < beforeLen;
  },

  // --- Roles (RBAC) CRUD ---
  getRoles(query?: { search?: string; isSystem?: boolean }): RoleRecord[] {
    return rolesMemory.filter((r) => {
      if (query?.isSystem !== undefined && r.isSystem !== query.isSystem) return false;
      if (query?.search && !r.name.toLowerCase().includes(query.search.toLowerCase())) return false;
      return true;
    });
  },

  getRole(id: string): RoleRecord | undefined {
    return rolesMemory.find((r) => r.id === id);
  },

  createRole(payload: { name: string; description?: string; permissions?: string[] }): RoleRecord {
    const newRole: RoleRecord = {
      id: `role_${Date.now().toString(36)}`,
      name: payload.name.toUpperCase(),
      description: payload.description,
      isSystem: false,
      permissions: payload.permissions || ['records:read'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rolesMemory = [newRole, ...rolesMemory];
    return newRole;
  },

  updateRole(id: string, updates: Partial<RoleRecord>): RoleRecord | undefined {
    const idx = rolesMemory.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    const updated: RoleRecord = {
      ...rolesMemory[idx]!,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    rolesMemory[idx] = updated;
    return updated;
  },

  deleteRole(id: string): boolean {
    const beforeLen = rolesMemory.length;
    rolesMemory = rolesMemory.filter((r) => r.id !== id);
    return rolesMemory.length < beforeLen;
  },

  // --- Notifications ---
  getNotifications(): NotificationRecord[] {
    return [...notificationsMemory];
  },

  sendNotification(payload: {
    recipient: string;
    channel: NotificationRecord['channel'];
    subject: string;
    body: string;
    provider?: string;
    dryRun?: boolean;
  }): NotificationRecord {
    const newNotif: NotificationRecord = {
      id: `notif_${Date.now().toString(36)}`,
      recipient: payload.recipient,
      channel: payload.channel,
      subject: payload.subject,
      body: payload.body,
      status: payload.dryRun ? 'SENT' : 'DELIVERED',
      provider: payload.provider || (payload.channel === 'EMAIL' ? 'SENDGRID' : 'TWILIO'),
      providerMessageId: `msg_${Math.random().toString(36).substring(2, 9)}`,
      isDryRun: Boolean(payload.dryRun),
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    };
    notificationsMemory = [newNotif, ...notificationsMemory];
    return newNotif;
  },
};
