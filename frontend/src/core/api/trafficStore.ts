import { create } from 'zustand';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type TrafficMode = 'live' | 'mock' | 'failed';

export interface ApiTrafficRecord {
  id: string;
  timestamp: string;
  method: HttpMethod;
  url: string;
  endpoint: string;
  service: string;
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: string | unknown;
  mode: TrafficMode;
  curl: string;
  swaggerUrl: string;
}

export interface TrafficFilter {
  search: string;
  method: string;
  statusCategory: string; // 'all' | '2xx' | '4xx' | '5xx'
}

interface ApiTrafficState {
  records: ApiTrafficRecord[];
  activeRecordId: string | null;
  isDrawerOpen: boolean;
  connectionMode: 'auto' | 'live' | 'mock';
  filter: TrafficFilter;
  
  // Actions
  addRecord: (record: Omit<ApiTrafficRecord, 'id' | 'timestamp' | 'curl' | 'swaggerUrl'>) => ApiTrafficRecord;
  clearRecords: () => void;
  setActiveRecordId: (id: string | null) => void;
  setDrawerOpen: (isOpen: boolean) => void;
  toggleDrawer: () => void;
  setConnectionMode: (mode: 'auto' | 'live' | 'mock') => void;
  setFilter: (filter: Partial<TrafficFilter>) => void;
}

export function generateCurl(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: unknown
): string {
  const parts: string[] = [`curl -X ${method.toUpperCase()} "${url}"`];

  Object.entries(headers).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      // Avoid printing entire secret tokens in plain curl snippet if preferred, but keep standard Bearer syntax
      parts.push(`  -H "${key}: ${val}"`);
    }
  });

  if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
    const jsonStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    parts.push(`  -d '${jsonStr.replace(/'/g, `'\\''`)}'`);
  }

  return parts.join(' \\\n');
}

export function resolveSwaggerDocUrl(endpoint: string): string {
  const baseUrl = 'http://localhost:4000/api-docs';
  const cleanPath = endpoint.split('?')[0] || '';
  
  if (cleanPath.includes('/organizations')) return `${baseUrl}/#/Organization%20Service`;
  if (cleanPath.includes('/config')) return `${baseUrl}/#/Config%20Service`;
  if (cleanPath.includes('/rbac') || cleanPath.includes('/roles') || cleanPath.includes('/permissions')) {
    return `${baseUrl}/#/Roles%20(RBAC)`;
  }
  if (cleanPath.includes('/notifications')) return `${baseUrl}/#/Notifications`;
  if (cleanPath.includes('/assets')) return `${baseUrl}/#/Asset%20Service`;
  if (cleanPath.includes('/orders')) return `${baseUrl}/#/Order%20Service`;
  if (cleanPath.includes('/inventory')) return `${baseUrl}/#/Inventory%20Service`;
  if (cleanPath.includes('/transactions')) return `${baseUrl}/#/Transaction%20Service`;
  if (cleanPath.includes('/iam')) return `${baseUrl}/#/IAM%20Service`;
  if (cleanPath.includes('/health')) return `${baseUrl}/#/Health`;
  
  return baseUrl;
}

export function detectServiceTag(endpoint: string): string {
  const cleanPath = endpoint.toLowerCase().split('?')[0] || '';
  if (cleanPath.includes('/organizations')) return 'Organizations';
  if (cleanPath.includes('/config')) return 'Config';
  if (cleanPath.includes('/rbac') || cleanPath.includes('/roles') || cleanPath.includes('/permissions')) return 'RBAC';
  if (cleanPath.includes('/notifications')) return 'Notifications';
  if (cleanPath.includes('/assets')) return 'Assets';
  if (cleanPath.includes('/orders')) return 'Orders';
  if (cleanPath.includes('/inventory')) return 'Inventory';
  if (cleanPath.includes('/transactions')) return 'Transactions';
  if (cleanPath.includes('/records')) return 'Records';
  if (cleanPath.includes('/iam')) return 'IAM';
  if (cleanPath.includes('/audit')) return 'Audit';
  if (cleanPath.includes('/health')) return 'Health';
  return 'API';
}

const MAX_RECORDS = 100;

export const useApiTrafficStore = create<ApiTrafficState>((set) => ({
  records: [],
  activeRecordId: null,
  isDrawerOpen: false,
  connectionMode: 'auto',
  filter: {
    search: '',
    method: 'all',
    statusCategory: 'all',
  },

  addRecord: (partial) => {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    const curl = generateCurl(partial.method, partial.url, partial.headers, partial.requestBody);
    const swaggerUrl = resolveSwaggerDocUrl(partial.endpoint);

    const newRecord: ApiTrafficRecord = {
      ...partial,
      id,
      timestamp,
      curl,
      swaggerUrl,
    };

    set((state) => ({
      records: [newRecord, ...state.records].slice(0, MAX_RECORDS),
      // Automatically select if none selected
      activeRecordId: state.activeRecordId || id,
    }));

    return newRecord;
  },

  clearRecords: () => {
    set({ records: [], activeRecordId: null });
  },

  setActiveRecordId: (id) => {
    set({ activeRecordId: id });
  },

  setDrawerOpen: (isOpen) => {
    set({ isDrawerOpen: isOpen });
  },

  toggleDrawer: () => {
    set((state) => ({ isDrawerOpen: !state.isDrawerOpen }));
  },

  setConnectionMode: (mode) => {
    set({ connectionMode: mode });
  },

  setFilter: (newFilter) => {
    set((state) => ({ filter: { ...state.filter, ...newFilter } }));
  },
}));
