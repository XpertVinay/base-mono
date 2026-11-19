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

  // --- Orders CRUD ---
  getOrders(status?: string): MockOrderRecord[] {
    if (!ordersMemory) {
      ordersMemory = [...INITIAL_ORDERS];
    }
    return ordersMemory.filter((o) => !status || status === 'all' || o.status === status);
  },

  getOrder(id: string): MockOrderRecord | undefined {
    if (!ordersMemory) ordersMemory = [...INITIAL_ORDERS];
    return ordersMemory.find((o) => o.id === id || o.orderNumber === id);
  },

  createOrder(payload: {
    items?: Array<{ productId?: string; sku?: string; name?: string; quantity?: number; unitPrice?: number }>;
    currency?: string;
    shippingAddress?: unknown;
    billingAddress?: unknown;
  }): MockOrderRecord {
    if (!ordersMemory) ordersMemory = [...INITIAL_ORDERS];
    const items: MockOrderItem[] = (payload.items || []).map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 99.0;
      return {
        productId: item.productId || `prod_${idx + 1}`,
        sku: item.sku || `SKU-${item.productId || idx + 1}`,
        name: item.name || `Product ${item.productId || idx + 1}`,
        quantity: qty,
        unitPrice: price,
        totalPrice: qty * price,
      };
    });
    const subtotal = items.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const totalAmount = subtotal + tax;

    const newOrder: MockOrderRecord = {
      id: `ord_${Date.now().toString(36)}`,
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      userId: 'usr_admin_101',
      tenantId: 'ten_apex_health_01',
      status: 'PENDING',
      items,
      subtotal,
      tax,
      totalAmount,
      currency: payload.currency || 'USD',
      shippingAddress: payload.shippingAddress,
      billingAddress: payload.billingAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ordersMemory = [newOrder, ...ordersMemory];
    return newOrder;
  },

  cancelOrder(id: string, reason?: string): MockOrderRecord | undefined {
    if (!ordersMemory) ordersMemory = [...INITIAL_ORDERS];
    const idx = ordersMemory.findIndex((o) => o.id === id || o.orderNumber === id);
    if (idx === -1) return undefined;
    const updated: MockOrderRecord = {
      ...ordersMemory[idx]!,
      status: 'CANCELLED',
      cancellationReason: reason || 'Customer request',
      updatedAt: new Date().toISOString(),
    };
    ordersMemory[idx] = updated;
    return updated;
  },

  // --- Inventory CRUD ---
  getInventory(search?: string): MockInventoryRecord[] {
    if (!inventoryMemory) inventoryMemory = [...INITIAL_INVENTORY];
    return inventoryMemory.filter((item) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        item.sku.toLowerCase().includes(s) ||
        item.productId.toLowerCase().includes(s) ||
        (item.name && item.name.toLowerCase().includes(s))
      );
    });
  },

  getStock(productId: string): MockInventoryRecord | undefined {
    if (!inventoryMemory) inventoryMemory = [...INITIAL_INVENTORY];
    return inventoryMemory.find((i) => i.productId === productId || i.sku === productId);
  },

  addStock(payload: { productId: string; sku?: string; name?: string; quantity: number; warehouseId?: string }): MockInventoryRecord {
    if (!inventoryMemory) inventoryMemory = [...INITIAL_INVENTORY];
    const idx = inventoryMemory.findIndex((i) => i.productId === payload.productId || i.sku === payload.sku);
    const qty = Number(payload.quantity) || 0;
    if (idx !== -1) {
      const existing = inventoryMemory[idx]!;
      const updated: MockInventoryRecord = {
        ...existing,
        quantity: existing.quantity + qty,
        availableQuantity: existing.availableQuantity + qty,
        updatedAt: new Date().toISOString(),
      };
      inventoryMemory[idx] = updated;
      return updated;
    } else {
      const newItem: MockInventoryRecord = {
        id: `inv_${Date.now().toString(36)}`,
        productId: payload.productId,
        sku: payload.sku || `SKU-${payload.productId}`,
        name: payload.name || `Inventory Item ${payload.sku || payload.productId}`,
        quantity: qty,
        reservedQuantity: 0,
        availableQuantity: qty,
        warehouseId: payload.warehouseId || 'wh_central_01',
        updatedAt: new Date().toISOString(),
      };
      inventoryMemory = [newItem, ...inventoryMemory];
      return newItem;
    }
  },

  reserveStock(payload: { productId: string; quantity: number; reservationTtlMinutes?: number }): { reserved: boolean; expiresAt: string } {
    if (!inventoryMemory) inventoryMemory = [...INITIAL_INVENTORY];
    const idx = inventoryMemory.findIndex((i) => i.productId === payload.productId);
    const qty = Number(payload.quantity) || 1;
    if (idx !== -1 && inventoryMemory[idx]!.availableQuantity >= qty) {
      inventoryMemory[idx] = {
        ...inventoryMemory[idx]!,
        reservedQuantity: inventoryMemory[idx]!.reservedQuantity + qty,
        availableQuantity: inventoryMemory[idx]!.availableQuantity - qty,
        updatedAt: new Date().toISOString(),
      };
    }
    const ttlMinutes = payload.reservationTtlMinutes || 15;
    return {
      reserved: true,
      expiresAt: new Date(Date.now() + ttlMinutes * 60000).toISOString(),
    };
  },

  releaseStock(payload: { productId: string; quantity: number }): { released: boolean } {
    if (!inventoryMemory) inventoryMemory = [...INITIAL_INVENTORY];
    const idx = inventoryMemory.findIndex((i) => i.productId === payload.productId);
    const qty = Number(payload.quantity) || 1;
    if (idx !== -1) {
      inventoryMemory[idx] = {
        ...inventoryMemory[idx]!,
        reservedQuantity: Math.max(0, inventoryMemory[idx]!.reservedQuantity - qty),
        availableQuantity: inventoryMemory[idx]!.availableQuantity + qty,
        updatedAt: new Date().toISOString(),
      };
    }
    return { released: true };
  },

  // --- Assets CRUD ---
  getAssets(mimeType?: string): MockAssetRecord[] {
    if (!assetsMemory) assetsMemory = [...INITIAL_ASSETS];
    return assetsMemory.filter((a) => !mimeType || mimeType === 'all' || a.mimeType.includes(mimeType));
  },

  getAsset(id: string): MockAssetRecord | undefined {
    if (!assetsMemory) assetsMemory = [...INITIAL_ASSETS];
    return assetsMemory.find((a) => a.id === id);
  },

  createAsset(payload: {
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
    url?: string;
    metadata?: Record<string, unknown>;
  }): MockAssetRecord {
    if (!assetsMemory) assetsMemory = [...INITIAL_ASSETS];
    const newAsset: MockAssetRecord = {
      id: `ast_${Date.now().toString(36)}`,
      name: payload.name || 'document.pdf',
      mimeType: payload.mimeType || 'application/pdf',
      sizeBytes: Number(payload.sizeBytes) || 204800,
      url: payload.url || `https://storage.cdn.enterprise.local/assets/${payload.name || 'file'}`,
      storageProvider: 'LOCAL',
      bucket: 'enterprise-media-vault',
      key: `uploads/${Date.now()}_${payload.name || 'file'}`,
      ownerId: 'usr_admin_101',
      tenantId: 'ten_apex_health_01',
      metadata: payload.metadata || {},
      createdAt: new Date().toISOString(),
    };
    assetsMemory = [newAsset, ...assetsMemory];
    return newAsset;
  },

  deleteAsset(id: string): boolean {
    if (!assetsMemory) assetsMemory = [...INITIAL_ASSETS];
    const beforeLen = assetsMemory.length;
    assetsMemory = assetsMemory.filter((a) => a.id !== id);
    return assetsMemory.length < beforeLen;
  },

  // --- Transactions CRUD ---
  getTransactions(filter?: { gateway?: string; status?: string }): MockTransactionRecord[] {
    if (!transactionsMemory) transactionsMemory = [...INITIAL_TRANSACTIONS];
    return transactionsMemory.filter((t) => {
      if (filter?.gateway && filter.gateway !== 'all' && t.gateway !== filter.gateway) return false;
      if (filter?.status && filter.status !== 'all' && t.status !== filter.status) return false;
      return true;
    });
  },

  getTransaction(id: string): MockTransactionRecord | undefined {
    if (!transactionsMemory) transactionsMemory = [...INITIAL_TRANSACTIONS];
    return transactionsMemory.find((t) => t.id === id || t.gatewayTransactionId === id);
  },

  initiatePayment(payload: {
    orderId?: string;
    amount: number;
    currency?: string;
    gateway?: string;
    paymentMethod?: string;
  }): { transactionId: string; status: string; gateway: string; approvalUrl?: string; clientSecret?: string } {
    if (!transactionsMemory) transactionsMemory = [...INITIAL_TRANSACTIONS];
    const newTxn: MockTransactionRecord = {
      id: `txn_${Date.now().toString(36)}`,
      orderId: payload.orderId || `ord_${Date.now().toString().slice(-4)}`,
      amount: Number(payload.amount) || 100.0,
      currency: payload.currency || 'USD',
      gateway: payload.gateway || 'STRIPE',
      gatewayTransactionId: `gw_${payload.gateway || 'stripe'}_${Math.random().toString(36).slice(2, 9)}`,
      status: 'PENDING',
      paymentMethod: payload.paymentMethod || 'credit_card',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    transactionsMemory = [newTxn, ...transactionsMemory];
    return {
      transactionId: newTxn.id,
      status: 'PENDING',
      gateway: newTxn.gateway,
      approvalUrl: payload.gateway === 'PAYPAL' ? 'https://www.sandbox.paypal.com/checkoutnow' : undefined,
      clientSecret: `pi_test_${newTxn.id}_secret`,
    };
  },

  refundPayment(id: string, payload?: { reason?: string }): { refunded: boolean; transactionId: string } {
    if (!transactionsMemory) transactionsMemory = [...INITIAL_TRANSACTIONS];
    const idx = transactionsMemory.findIndex((t) => t.id === id);
    if (idx !== -1) {
      transactionsMemory[idx] = {
        ...transactionsMemory[idx]!,
        status: 'REFUNDED',
        refundReason: payload?.reason,
        updatedAt: new Date().toISOString(),
      };
    }
    return { refunded: true, transactionId: id };
  },

  // --- Scheduler CRUD ---
  getJobs(): MockJobRecord[] {
    if (!jobsMemory) jobsMemory = [...INITIAL_JOBS];
    return [...jobsMemory];
  },

  createJob(payload: {
    name?: string;
    cronExpression?: string;
    targetService?: string;
    targetEndpoint?: string;
    payload?: Record<string, unknown>;
    enabled?: boolean;
  }): MockJobRecord {
    if (!jobsMemory) jobsMemory = [...INITIAL_JOBS];
    const newJob: MockJobRecord = {
      id: `job_${Date.now().toString(36)}`,
      name: payload.name || 'Automated Sync Job',
      cronExpression: payload.cronExpression || '0 * * * *',
      targetService: payload.targetService || 'orders',
      targetEndpoint: payload.targetEndpoint || '/api/orders/reconcile',
      payload: payload.payload || {},
      enabled: payload.enabled !== false,
      createdAt: new Date().toISOString(),
      lastRunAt: undefined,
      nextRunAt: new Date(Date.now() + 3600000).toISOString(),
    };
    jobsMemory = [newJob, ...jobsMemory];
    return newJob;
  },

  triggerJob(id: string): { triggered: boolean; jobId: string } {
    if (!jobsMemory) jobsMemory = [...INITIAL_JOBS];
    const idx = jobsMemory.findIndex((j) => j.id === id);
    if (idx !== -1) {
      jobsMemory[idx] = {
        ...jobsMemory[idx]!,
        lastRunAt: new Date().toISOString(),
      };
    }
    return { triggered: true, jobId: id };
  },

  deleteJob(id: string): boolean {
    if (!jobsMemory) jobsMemory = [...INITIAL_JOBS];
    const beforeLen = jobsMemory.length;
    jobsMemory = jobsMemory.filter((j) => j.id !== id);
    return jobsMemory.length < beforeLen;
  },

  // --- IAM MFA & Cryptography ---
  mfaState: {
    mfaEnabled: false,
    secret: 'JBSWY3DPEHPK3PXP',
    verifiedAt: null as string | null,
    isMfaVerifiedSession: true,
  },

  getMfaStatus(): {
    mfaEnabled: boolean;
    verifiedAt: string | null;
    isMfaVerifiedSession: boolean;
    mfaMethod: string | null;
    lastUsedAt: string | null;
  } {
    return {
      mfaEnabled: this.mfaState.mfaEnabled,
      verifiedAt: this.mfaState.verifiedAt,
      isMfaVerifiedSession: this.mfaState.isMfaVerifiedSession,
      mfaMethod: this.mfaState.mfaEnabled ? 'TOTP' : null,
      lastUsedAt: this.mfaState.verifiedAt,
    };
  },

  setupMfa(): { secret: string; otpauthUrl: string; qrCode: string; recoveryCodes: string[] } {
    return {
      secret: this.mfaState.secret,
      otpauthUrl: `otpauth://totp/EnterprisePortal:admin@apex.health?secret=${this.mfaState.secret}&issuer=EnterprisePortal`,
      qrCode: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="100%" height="100%" fill="white"/><text x="10" y="70" font-size="12" fill="black">MFA QR Code</text></svg>`,
      recoveryCodes: ['REC-8921-X3', 'REC-4412-K9', 'REC-7731-P2', 'REC-1092-W7'],
    };
  },

  enableMfa(code: string, _secret: string): { enabled: boolean } {
    if (!code || code.length < 6) {
      throw new Error('Invalid 6-digit MFA verification code');
    }
    this.mfaState.mfaEnabled = true;
    this.mfaState.verifiedAt = new Date().toISOString();
    return { enabled: true };
  },

  verifyMfa(_token: string, code: string): { accessToken: string; refreshToken: string } {
    if (!code || code.length < 6) {
      throw new Error('Invalid 6-digit MFA verification code');
    }
    this.mfaState.verifiedAt = new Date().toISOString();
    return {
      accessToken: 'mock_jwt_token_mfa_verified',
      refreshToken: 'mock_refresh_token_mfa_verified',
    };
  },

  reverifyMfa(code: string): { reVerified: boolean; expiresAt: string } {
    if (!code || code.length < 6) {
      throw new Error('Invalid 6-digit MFA verification code');
    }
    this.mfaState.verifiedAt = new Date().toISOString();
    return {
      reVerified: true,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
  },

  getJwks(): { keys: Array<{ kty: string; use: string; kid: string; alg: string; n: string; e: string }> } {
    return {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          kid: 'solid-monolith-auth-key-2026',
          alg: 'RS256',
          n: 'u1G8e09f8d9fa89f0a8d0f8a09f80a9d8fa09d8f0a8d0fa98d0f',
          e: 'AQAB',
        },
      ],
    };
  },

  getPublicKey(): { publicKey: string; keyId: string; algorithm: string } {
    return {
      publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0X1rG9...
-----END PUBLIC KEY-----`,
      keyId: 'solid-monolith-auth-key-2026',
      algorithm: 'RS256',
    };
  },

  getMe(): { id: string; email: string; name: string; roles: string[]; mfaEnabled: boolean; tenantId: string } {
    return {
      id: 'usr_admin_101',
      email: 'admin@apex.health',
      name: 'System Administrator',
      roles: ['ADMIN'],
      mfaEnabled: this.mfaState.mfaEnabled,
      tenantId: 'ten_apex_health_01',
    };
  },

  getAuditLogs(): Array<{
    id: string;
    action: string;
    resource: string;
    ipAddress: string;
    status: string;
    timestamp: string;
  }> {
    return [
      {
        id: 'aud_1',
        action: 'MFA_VERIFIED',
        resource: 'iam:session',
        ipAddress: '127.0.0.1',
        status: 'SUCCESS',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: 'aud_2',
        action: 'TOKEN_ROTATION',
        resource: 'iam:refresh',
        ipAddress: '127.0.0.1',
        status: 'SUCCESS',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'aud_3',
        action: 'USER_LOGIN',
        resource: 'iam:login',
        ipAddress: '127.0.0.1',
        status: 'SUCCESS',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
  },

  // --- Modular Section Configs ---
  sectionsMemory: {
    tenant: { multiTenancyEnabled: true, isolationMode: 'ROW_LEVEL', enforceTenantIsolation: true, maxTenants: 50 },
    iam: { jwtAlgorithm: 'RS256', jwtExpiresIn: '15m', bcryptSaltRounds: 12, mfaEnabled: true, maxLoginAttempts: 5 },
    'white-label': { brandName: 'Apex Health', companyName: 'Apex Health Systems Inc.', primaryColor: '#3525cd', portalTitle: 'Apex Health Portal' },
    asset: { storageProvider: 'LOCAL', bucketName: 'enterprise-media-vault', maxUploadSizeBytes: 104857600, virusScanningEnabled: true },
    finance: { defaultCurrency: 'USD', fiscalYearStartMonth: 1, taxRatePercentage: 8.5, ledgerImmutabilityStrict: true },
    transaction: { activePaymentGateway: 'STRIPE', enabledGateways: ['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK'], autoCapture: true },
    inventory: { stockTrackingEnabled: true, lowStockThreshold: 10, autoReserveOnOrder: true, reservationExpiryMinutes: 15 },
    order: { bookingConfirmationMode: 'AUTO', cancellationWindowHours: 24, invoicePrefix: 'INV-2026', minimumOrderAmount: 10.0 },
    property: { defaultInspectionIntervalDays: 90, caretakingServiceTypes: ['HVAC', 'Plumbing', 'Electrical'], enableVirtualTour: true },
    search: { searchEngine: 'POSTGRES_FTS', highlightEnabled: true, maxSearchResults: 50 },
    scheduler: { cronEngineEnabled: true, maxConcurrentJobs: 10, jobRetryLimit: 3, pollIntervalMs: 5000 },
  } as Record<string, Record<string, unknown>>,

  getSectionsSummary(): Record<string, Record<string, unknown>> {
    return { ...this.sectionsMemory };
  },

  getSection(section: string): Record<string, unknown> {
    return this.sectionsMemory[section] || {};
  },

  updateSection(section: string, payload: Record<string, unknown>): Record<string, unknown> {
    this.sectionsMemory[section] = {
      ...(this.sectionsMemory[section] || {}),
      ...payload,
    };
    return this.sectionsMemory[section]!;
  },

  cacheStats: {
    hits: 1420,
    misses: 85,
    size: 48,
    hitRate: 0.943,
    keys: ['config:client', 'config:sections', 'config:ACTIVE_PAYMENT_GATEWAY', 'config:ENABLE_MFA_ENFORCEMENT'],
    lastClearedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },

  getCacheStats(): {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
    keys: string[];
    lastClearedAt: string;
  } {
    return { ...this.cacheStats };
  },

  invalidateCache(payload?: { key?: string; all?: boolean }): {
    success: boolean;
    invalidatedKey: string;
    clearedCount: number;
    timestamp: string;
  } {
    this.cacheStats.size = payload?.all ? 0 : Math.max(0, this.cacheStats.size - 1);
    this.cacheStats.lastClearedAt = new Date().toISOString();
    return {
      success: true,
      invalidatedKey: payload?.key || (payload?.all ? 'ALL' : 'config:*'),
      clearedCount: payload?.all ? 48 : 1,
      timestamp: new Date().toISOString(),
    };
  },

  createContextToken(payload?: { tenantId?: string }): {
    contextToken: string;
    tenantId: string;
    expiresInSeconds: number;
  } {
    const tenantId = payload?.tenantId || '00000000-0000-0000-0000-000000000001';
    return {
      contextToken: `ctx_enc_${Buffer.from(JSON.stringify({ tenantId, exp: Date.now() + 86400000 })).toString('base64url')}`,
      tenantId,
      expiresInSeconds: 86400,
    };
  },

  // --- Notifications Extensions ---
  clearDryRunOutbox(): { cleared: boolean; count: number; message: string } {
    const beforeLen = notificationsMemory.filter((n) => n.isDryRun).length;
    notificationsMemory = notificationsMemory.filter((n) => !n.isDryRun);
    return { cleared: true, count: beforeLen, message: `Cleared ${beforeLen} simulated notifications` };
  },

  getNotificationConfig(): Record<string, unknown> {
    return {
      channels: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP', 'WEBHOOK'],
      providers: {
        SENDGRID: { enabled: true, priority: 1 },
        TWILIO: { enabled: true, priority: 2 },
        META_CLOUD: { enabled: false },
        MOCK: { enabled: true },
      },
      defaultChannelRouting: {
        EMAIL: 'SENDGRID',
        SMS: 'TWILIO',
        WHATSAPP: 'META_CLOUD',
        IN_APP: 'MOCK',
      },
      retryPolicy: { maxRetries: 3, backoffMs: 2000 },
    };
  },

  simulateWebhook(provider: string, payload: unknown): {
    handled: boolean;
    provider: string;
    eventId: string;
    status: string;
    payloadReceived: unknown;
  } {
    return {
      handled: true,
      provider,
      eventId: `wh_evt_${Date.now()}`,
      status: 'DELIVERED',
      payloadReceived: payload,
    };
  },

  sendBatchNotifications(
    notifications: Array<{
      recipient: string;
      channel: NotificationRecord['channel'];
      subject: string;
      body: string;
      provider?: string;
    }>,
    dryRun?: boolean
  ): {
    total: number;
    sentCount: number;
    failedCount: number;
    results: Array<{
      index: number;
      recipient: string;
      channel: string;
      success: boolean;
      notification: NotificationRecord;
    }>;
  } {
    const results = notifications.map((n, idx) => {
      const created = this.sendNotification({ ...n, dryRun });
      return {
        index: idx,
        recipient: n.recipient,
        channel: n.channel,
        success: true,
        notification: created,
      };
    });
    return {
      total: notifications.length,
      sentCount: notifications.length,
      failedCount: 0,
      results,
    };
  },
};

export interface MockOrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface MockOrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  tenantId: string;
  status: string;
  items: MockOrderItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  currency: string;
  shippingAddress?: unknown;
  billingAddress?: unknown;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

let ordersMemory: MockOrderRecord[] | null = null;
const INITIAL_ORDERS: MockOrderRecord[] = [
  {
    id: 'ord_101',
    orderNumber: 'ORD-2026-8921',
    userId: 'usr_patient_01',
    tenantId: 'ten_apex_health_01',
    status: 'CONFIRMED',
    items: [
      { productId: 'prod_mri_1', sku: 'MED-MRI-01', name: 'Contrast MRI Diagnostic Kit', quantity: 1, unitPrice: 450.0, totalPrice: 450.0 },
      { productId: 'prod_prep_2', sku: 'MED-PREP-02', name: 'Patient Preparation Tray', quantity: 2, unitPrice: 25.0, totalPrice: 50.0 },
    ],
    subtotal: 500.0,
    tax: 42.5,
    totalAmount: 542.5,
    currency: 'USD',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'ord_102',
    orderNumber: 'ORD-2026-8922',
    userId: 'usr_doc_02',
    tenantId: 'ten_apex_health_01',
    status: 'PROCESSING',
    items: [
      { productId: 'prod_ecg_4', sku: 'MED-ECG-04', name: 'Telemetry Electrode Pack (100pk)', quantity: 4, unitPrice: 65.0, totalPrice: 260.0 },
    ],
    subtotal: 260.0,
    tax: 22.1,
    totalAmount: 282.1,
    currency: 'USD',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
];

export interface MockInventoryRecord {
  id?: string;
  productId: string;
  sku: string;
  name?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  warehouseId?: string;
  updatedAt: string;
}

let inventoryMemory: MockInventoryRecord[] | null = null;
const INITIAL_INVENTORY: MockInventoryRecord[] = [
  {
    id: 'inv_1',
    productId: 'prod_mri_1',
    sku: 'MED-MRI-01',
    name: 'Contrast MRI Diagnostic Kit',
    quantity: 85,
    reservedQuantity: 12,
    availableQuantity: 73,
    warehouseId: 'wh_radiology_main',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv_2',
    productId: 'prod_prep_2',
    sku: 'MED-PREP-02',
    name: 'Patient Preparation Tray',
    quantity: 320,
    reservedQuantity: 24,
    availableQuantity: 296,
    warehouseId: 'wh_radiology_main',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv_3',
    productId: 'prod_ecg_4',
    sku: 'MED-ECG-04',
    name: 'Telemetry Electrode Pack (100pk)',
    quantity: 150,
    reservedQuantity: 18,
    availableQuantity: 132,
    warehouseId: 'wh_icu_supply',
    updatedAt: new Date().toISOString(),
  },
];

export interface MockAssetRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  storageProvider: string;
  bucket: string;
  key: string;
  ownerId: string;
  tenantId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

let assetsMemory: MockAssetRecord[] | null = null;
const INITIAL_ASSETS: MockAssetRecord[] = [
  {
    id: 'ast_101',
    name: 'radiology_scan_patient_8921.dcm',
    mimeType: 'application/dicom',
    sizeBytes: 15728640,
    url: 'https://storage.cdn.enterprise.local/assets/radiology_scan_8921.dcm',
    storageProvider: 'LOCAL',
    bucket: 'enterprise-media-vault',
    key: 'uploads/dicom/8921.dcm',
    ownerId: 'usr_admin_101',
    tenantId: 'ten_apex_health_01',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'ast_102',
    name: 'telemetry_protocol_2026.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1048576,
    url: 'https://storage.cdn.enterprise.local/assets/telemetry_protocol_2026.pdf',
    storageProvider: 'LOCAL',
    bucket: 'enterprise-media-vault',
    key: 'uploads/docs/protocol.pdf',
    ownerId: 'usr_admin_101',
    tenantId: 'ten_apex_health_01',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
];

export interface MockTransactionRecord {
  id: string;
  orderId?: string;
  amount: number;
  currency: string;
  gateway: string;
  gatewayTransactionId?: string;
  status: string;
  paymentMethod?: string;
  refundReason?: string;
  createdAt: string;
  updatedAt: string;
}

let transactionsMemory: MockTransactionRecord[] | null = null;
const INITIAL_TRANSACTIONS: MockTransactionRecord[] = [
  {
    id: 'txn_901',
    orderId: 'ord_101',
    amount: 542.5,
    currency: 'USD',
    gateway: 'STRIPE',
    gatewayTransactionId: 'ch_3N8x7K2eZvKYlo2C1g9JkL10',
    status: 'SUCCEEDED',
    paymentMethod: 'visa_ending_4242',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'txn_902',
    orderId: 'ord_102',
    amount: 282.1,
    currency: 'USD',
    gateway: 'PAYPAL',
    gatewayTransactionId: 'PAYID-MT7381920X',
    status: 'PENDING',
    paymentMethod: 'paypal_express',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

export interface MockJobRecord {
  id: string;
  name: string;
  cronExpression: string;
  targetService: string;
  targetEndpoint: string;
  payload?: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

let jobsMemory: MockJobRecord[] | null = null;
const INITIAL_JOBS: MockJobRecord[] = [
  {
    id: 'job_cron_01',
    name: 'Nightly Inventory Reconciliation',
    cronExpression: '0 2 * * *',
    targetService: 'inventory',
    targetEndpoint: '/api/v1/inventory/reconcile',
    enabled: true,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    lastRunAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    nextRunAt: new Date(Date.now() + 3600000 * 14).toISOString(),
  },
  {
    id: 'job_cron_02',
    name: 'Hourly Payment Gateway Settlement Audit',
    cronExpression: '0 * * * *',
    targetService: 'transactions',
    targetEndpoint: '/api/v1/transactions/settlement-check',
    enabled: true,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    lastRunAt: new Date(Date.now() - 1800000).toISOString(),
    nextRunAt: new Date(Date.now() + 1800000).toISOString(),
  },
];

