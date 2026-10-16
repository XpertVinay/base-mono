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

const recordsMemory = { ...INITIAL_RECORDS };

export const mockBackend = {
  getRecords(tenantSlug: string): EntityRecord[] {
    return recordsMemory[tenantSlug] || [];
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

  deleteRecord(tenantSlug: string, recordId: string): void {
    if (recordsMemory[tenantSlug]) {
      recordsMemory[tenantSlug] = recordsMemory[tenantSlug].filter((r) => r.id !== recordId);
    }
  },
};
