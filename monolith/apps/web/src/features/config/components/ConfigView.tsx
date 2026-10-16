import React, { useEffect, useState } from 'react';
import { AppConfigDto } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { useAuth } from '../../../shared/hooks/useAuth.js';
import { Settings, ToggleLeft, ToggleRight, Plus, CreditCard, CheckCircle2 } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchConfigs = async () => {
    const res = await apiClient.get<AppConfigDto[]>('/api/config');
    if (res.success && res.data) {
      setConfigs(res.data);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

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
      description: 'Active payment gateway adapter (STRIPE, PAYPAL, RAZORPAY, MOCK)'
    });
    if (res.success) {
      setMsg(`Active Payment Gateway switched to ${gatewayId}. All future transactions will route through this adapter.`);
      await fetchConfigs();
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
      description: cfg.description
    });
    if (res.success) {
      setMsg(`Config '${cfg.key}' updated to ${toggled}`);
      await fetchConfigs();
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
      description: newDesc
    });
    if (res.success) {
      setMsg(`Config '${newKey}' added successfully!`);
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      await fetchConfigs();
    } else {
      alert(res.error?.message || 'Failed to save config');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Settings size={22} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Runtime Configuration & Feature Flags</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Dynamic platform settings validated at runtime. Modifications are secured with role-based authorization (ADMIN required).
        </p>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', background: 'var(--status-success-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--status-success)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {msg}
        </div>
      )}

      {/* Payment Gateway Adapter Switcher */}
      <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--brand-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={20} color="var(--brand-accent)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Payment Gateway Adapter Selection</h3>
          </div>
          <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>
            DB FLAG: ACTIVE_PAYMENT_GATEWAY
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
                    ● ACTIVE IN DATABASE
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
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
            Active Settings ({configs.length})
          </h3>
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
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{cfg.key}</div>
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

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
              <Plus size={16} /> Save Runtime Setting
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
