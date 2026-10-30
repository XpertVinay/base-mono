import React, { useEffect, useState } from 'react';
import { AppConfigDto, ConfigTarget } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { useAuth } from '../../../shared/hooks/useAuth.js';
import { clientConfigCache } from '../services/config-cache.service.js';
import {
  Settings,
  ToggleLeft,
  ToggleRight,
  Plus,
  CreditCard,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Trash2,
  Layers
} from 'lucide-react';

const SUPPORTED_GATEWAYS = [
  { id: 'STRIPE', label: 'Stripe', desc: 'SCA & PaymentIntents Card Processing' },
  { id: 'PAYPAL', label: 'PayPal', desc: 'PayPal Checkout & Orders v2 Capture' },
  { id: 'RAZORPAY', label: 'Razorpay', desc: 'Cards, NetBanking & UPI' },
  { id: 'MOCK', label: 'Mock Provider', desc: 'Deterministic Sandbox Provider' }
];

export const ConfigView: React.FC = () => {
  const { isAdmin } = useAuth();
  const [configs, setConfigs] = useState<AppConfigDto[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTarget, setNewTarget] = useState<ConfigTarget>('ALL');
  const [newIsEncrypted, setNewIsEncrypted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Cache stats states
  const [beCacheStats, setBeCacheStats] = useState<any>(null);
  const [feCacheStats, setFeCacheStats] = useState(clientConfigCache.getStats());

  const fetchConfigs = async () => {
    const res = await apiClient.get<AppConfigDto[]>('/api/config');
    if (res.success && res.data) {
      setConfigs(res.data);
    }
  };

  const fetchCacheStats = async () => {
    if (isAdmin) {
      const res = await apiClient.get<any>('/api/config/cache/stats');
      if (res.success && res.data) {
        setBeCacheStats(res.data);
      }
    }
    setFeCacheStats(clientConfigCache.getStats());
  };

  useEffect(() => {
    fetchConfigs();
    fetchCacheStats();
    // Preload client configs in frontend cache
    clientConfigCache.fetchConfigs();
  }, [isAdmin]);

  const activeGateway = (
    configs.find(c => c.key.toUpperCase() === 'ACTIVE_PAYMENT_GATEWAY')?.value || 'STRIPE'
  ).toUpperCase();

  const handleSelectGateway = async (gatewayId: string) => {
    if (!isAdmin) {
      alert('Only administrators with ROLE=ADMIN can alter runtime configuration.');
      return;
    }
    setLoading(true);
    const res = await apiClient.post('/api/config', {
      key: 'ACTIVE_PAYMENT_GATEWAY',
      value: gatewayId,
      description: 'Active payment gateway adapter (STRIPE, PAYPAL, RAZORPAY, MOCK)',
      target: 'ALL'
    });
    if (res.success) {
      setMsg(`Active Payment Gateway switched to ${gatewayId}. In-memory BE and FE caches updated.`);
      clientConfigCache.invalidate();
      await fetchConfigs();
      await fetchCacheStats();
    } else {
      alert(res.error?.message || 'Failed to update payment gateway config');
    }
    setLoading(false);
  };

  const handleToggle = async (cfg: AppConfigDto) => {
    if (!isAdmin) {
      alert('Only administrators with ROLE=ADMIN can alter runtime configuration.');
      return;
    }
    const toggled = cfg.value.toLowerCase() === 'true' ? 'false' : 'true';
    const res = await apiClient.post('/api/config', {
      key: cfg.key,
      value: toggled,
      description: cfg.description,
      target: cfg.target || 'ALL',
      isEncrypted: cfg.isEncrypted
    });
    if (res.success) {
      setMsg(`Config '${cfg.key}' updated to ${toggled}. Cache invalidated across BE & FE.`);
      clientConfigCache.invalidate();
      await fetchConfigs();
      await fetchCacheStats();
    } else {
      alert(res.error?.message || 'Update failed');
    }
  };

  const handleAddConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Admin authorization required');
      return;
    }
    setLoading(true);
    const res = await apiClient.post('/api/config', {
      key: newKey,
      value: newValue,
      description: newDesc,
      target: newTarget,
      isEncrypted: newIsEncrypted
    });
    if (res.success) {
      setMsg(`Config '${newKey}' added successfully and cached!`);
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      setNewTarget('ALL');
      setNewIsEncrypted(false);
      clientConfigCache.invalidate();
      await fetchConfigs();
      await fetchCacheStats();
    } else {
      alert(res.error?.message || 'Failed to save config');
    }
    setLoading(false);
  };

  const handlePurgeBackendCache = async () => {
    if (!isAdmin) return;
    setLoading(true);
    const res = await apiClient.post('/api/config/cache/invalidate', {});
    if (res.success) {
      setMsg('Backend in-memory configuration cache purged successfully.');
      await fetchCacheStats();
    }
    setLoading(false);
  };

  const handleSyncFrontendCache = async () => {
    setLoading(true);
    clientConfigCache.invalidate();
    await clientConfigCache.fetchConfigs(true);
    setFeCacheStats(clientConfigCache.getStats());
    setMsg('Frontend configuration cache synchronized with backend.');
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Settings size={22} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Configuration Management & Multi-Tier Caching</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Database-backed configurations with high-performance in-memory caching on the Backend and local storage stale-while-revalidate caching on the Frontend.
        </p>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', background: 'var(--status-success-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--status-success)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {msg}
        </div>
      )}

      {/* Caching Architecture Status Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Backend Cache Card */}
        <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} color="#6366f1" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Backend Cache (In-Memory)</h3>
            </div>
            <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>O(1) Memory</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Decorates Postgres repository with automatic TTL expiration, pre-warming on boot, and write-through cache invalidation.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cache Hits:</span>{' '}
              <strong style={{ color: '#10b981' }}>{beCacheStats?.hits ?? 0}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cache Misses:</span>{' '}
              <strong style={{ color: '#f59e0b' }}>{beCacheStats?.misses ?? 0}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Hit Ratio:</span>{' '}
              <strong>{beCacheStats ? `${(beCacheStats.hitRatio * 100).toFixed(1)}%` : 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cached Keys:</span>{' '}
              <strong style={{ color: '#6366f1' }}>{beCacheStats?.size ?? configs.length}</strong>
            </div>
          </div>
          {isAdmin && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePurgeBackendCache}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}
            >
              <Trash2 size={14} /> Purge BE In-Memory Cache
            </button>
          )}
        </div>

        {/* Frontend Cache Card */}
        <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#10b981" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Frontend Cache (Client & LocalStorage)</h3>
            </div>
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Zero-Latency</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Caches client-facing configs (FRONTEND & ALL) in memory and persistent storage using Stale-While-Revalidate.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cached Items:</span>{' '}
              <strong style={{ color: '#10b981' }}>{feCacheStats.size}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Initialized:</span>{' '}
              <strong>{feCacheStats.isInitialized ? 'Yes' : 'Pending'}</strong>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--text-muted)' }}>Last Synced:</span>{' '}
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                {feCacheStats.lastFetchedAt ? new Date(feCacheStats.lastFetchedAt).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSyncFrontendCache}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}
          >
            <RefreshCw size={14} /> Sync FE Client Cache
          </button>
        </div>
      </div>

      {/* Payment Gateway Adapter Switcher */}
      <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--brand-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={20} color="var(--brand-accent)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Payment Gateway Adapter Selection</h3>
          </div>
          <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>
            CACHED FLAG: ACTIVE_PAYMENT_GATEWAY
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
          Switch the live payment gateway provider adapter below. The Transaction module dynamically routes incoming transactions without server restarts.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {SUPPORTED_GATEWAYS.map(gw => {
            const isSelected = activeGateway === gw.id;
            return (
              <div
                key={gw.id}
                onClick={() => handleSelectGateway(gw.id)}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                  cursor: isAdmin ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isSelected ? 'var(--brand-accent)' : 'var(--text-primary)' }}>
                    {gw.label}
                  </span>
                  {isSelected && <CheckCircle2 size={16} color="var(--status-success)" />}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {gw.desc}
                </div>
                {isSelected && (
                  <div style={{ marginTop: '8px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--status-success)' }}>
                    ● ACTIVE IN DB & CACHES
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        {/* Settings List */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Active Settings ({configs.length})
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={fetchConfigs} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {configs.map(cfg => (
              <div
                key={cfg.key}
                style={{
                  padding: '16px',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{cfg.key}</span>
                    <span
                      className="badge"
                      style={{
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        background: cfg.target === 'FRONTEND' ? 'rgba(16, 185, 129, 0.2)' : cfg.target === 'BACKEND' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                        color: cfg.target === 'FRONTEND' ? '#10b981' : cfg.target === 'BACKEND' ? '#f87171' : '#818cf8',
                        border: '1px solid currentColor'
                      }}
                    >
                      {cfg.target || 'ALL'}
                    </span>
                    {cfg.isEncrypted && (
                      <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        ENCRYPTED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cfg.description || 'No description'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Value: <strong style={{ color: 'var(--brand-accent)' }}>{cfg.value}</strong>
                  </div>
                </div>

                {cfg.value === 'true' || cfg.value === 'false' ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggle(cfg)}
                    title={isAdmin ? 'Toggle value' : 'Admin role required to modify'}
                  >
                    {cfg.value === 'true' ? <ToggleRight size={20} color="var(--status-success)" /> : <ToggleLeft size={20} color="var(--text-muted)" />}
                  </button>
                ) : (
                  <span className="badge badge-info">STRING</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add Configuration Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Add / Update Setting</h3>
          {!isAdmin && (
            <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--status-warning)', fontSize: '0.825rem', marginBottom: '16px' }}>
              Note: You are currently signed in as a standard user. Register or sign in with role <strong>ADMIN</strong> in the IAM tab to save changes.
            </div>
          )}

          <form onSubmit={handleAddConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Setting Key
              </label>
              <input
                type="text"
                required
                placeholder="ENABLE_BETA_PAYMENT"
                className="input-field"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Setting Value
              </label>
              <input
                type="text"
                required
                placeholder="true"
                className="input-field"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Description
              </label>
              <input
                type="text"
                placeholder="Toggle beta payment features"
                className="input-field"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Target / Scope
                </label>
                <select
                  className="input-field"
                  value={newTarget}
                  onChange={e => setNewTarget(e.target.value as ConfigTarget)}
                >
                  <option value="ALL">ALL (BE & FE Cache)</option>
                  <option value="FRONTEND">FRONTEND (Client Cache)</option>
                  <option value="BACKEND">BACKEND (Server Only)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '22px' }}>
                <input
                  type="checkbox"
                  id="isEncrypted"
                  checked={newIsEncrypted}
                  onChange={e => setNewIsEncrypted(e.target.checked)}
                />
                <label htmlFor="isEncrypted" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Is Encrypted
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
              <Plus size={16} /> Save Runtime Setting
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
