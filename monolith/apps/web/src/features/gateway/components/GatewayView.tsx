import React, { useEffect, useState } from 'react';
import { ServiceHealthDto, ApiRouteInfoDto } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { Server, Database, RefreshCw, Cpu, Layers } from 'lucide-react';

export const GatewayView: React.FC = () => {
  const [health, setHealth] = useState<ServiceHealthDto | null>(null);
  const [routes, setRoutes] = useState<ApiRouteInfoDto[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHealthAndRoutes = async () => {
    setLoading(true);
    const healthRes = await apiClient.get<ServiceHealthDto>('/health');
    if (healthRes.success && healthRes.data) {
      setHealth(healthRes.data);
    } 

    const routesRes = await apiClient.get<ApiRouteInfoDto[]>('/api/gateway/routes');
    if (routesRes.success && routesRes.data) {
      setRoutes(routesRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealthAndRoutes();
    const interval = setInterval(fetchHealthAndRoutes, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span className="pulse-indicator" style={{ background: health?.status === 'UP' ? 'var(--status-success)' : 'var(--status-warning)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Gateway Health & Telemetry</h2>
            <span className={`badge ${health?.status === 'UP' ? 'badge-success' : 'badge-warning'}`}>
              {health?.status || 'CHECKING'}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Real-time liveness, PostgreSQL readiness, memory profile, and in-process modular routing.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchHealthAndRoutes} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Subsystem Health Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Core System */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>RUNTIME</span>
            <Server size={18} color="var(--brand-primary)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '4px' }}>Node.js / Express</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Uptime: <strong>{health?.uptimeSeconds ?? 0}s</strong> | Version: {health?.version || '1.0.0'}
          </div>
        </div>

        {/* Database Health */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>PERSISTENCE POOL</span>
            <Database size={18} color="var(--brand-accent)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.5rem', fontWeight: 700, marginBottom: '4px' }}>
            PostgreSQL 16
            <span className={`badge ${health?.checks?.database?.status === 'UP' ? 'badge-success' : 'badge-warning'}`}>
              {health?.checks?.database?.status || 'READY'}
            </span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Latency: <strong>{health?.checks?.database?.responseTimeMs ?? 1}ms</strong> | Pool isolation
          </div>
        </div>

        {/* Memory Profile */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>PROCESS FOOTPRINT</span>
            <Cpu size={18} color="var(--brand-secondary)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '4px' }}>Unified Monolith</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {health?.checks?.memory?.message || 'Stable heap consumption'}
          </div>
        </div>
      </div>

      {/* Module Route Directory */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Layers size={20} color="var(--brand-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>In-Process Modular Routing Directory</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
          Every business module exposes an isolated router mounted under an explicit API prefix without inter-module network overhead.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {routes.map(r => (
            <div
              key={r.module}
              style={{
                padding: '12px 16px',
                background: 'rgba(15, 23, 42, 0.4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.module}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.prefix}</div>
              </div>
              <span className="badge badge-success">{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
