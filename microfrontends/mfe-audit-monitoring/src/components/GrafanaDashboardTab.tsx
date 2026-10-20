import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, AlertTriangle, Monitor, Sparkles } from 'lucide-react';
import { MetricsSummary } from '../types.js';

interface GrafanaDashboardTabProps {
  grafanaUrl?: string;
  metrics: MetricsSummary;
}

export const GrafanaDashboardTab: React.FC<GrafanaDashboardTabProps> = ({
  grafanaUrl = 'http://localhost:3000',
  metrics
}) => {
  const [activePanel, setActivePanel] = useState<'OVERVIEW' | 'ERRORS' | 'SECURITY'>('OVERVIEW');
  const [useLiveIframe, setUseLiveIframe] = useState(false);

  const fullGrafanaUrl = `${grafanaUrl}/d/audit-telemetry-dashboard/microservices-audit-telemetry-shield?orgId=1&refresh=5s&kiosk`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Grafana Navigation & Control Bar */}
      <div
        className="amfe-glass-card"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--amfe-radius-sm)',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(249, 115, 22, 0.4)'
            }}
          >
            <Monitor size={18} style={{ color: '#ffffff' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#ffffff' }}>
                Grafana Visual Dashboard Portal
              </h3>
              <span className="amfe-badge amfe-badge-warn">v10.3 Provisioned</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--amfe-text-muted)' }}>
              UID: <span className="amfe-mono">audit-telemetry-dashboard</span> • Anonymous Viewer Enabled
            </span>
          </div>
        </div>

        {/* Panel Tabs and Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--amfe-radius-sm)', padding: 3 }}>
            <button
              className={`amfe-tab-btn ${activePanel === 'OVERVIEW' ? 'active' : ''}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              onClick={() => setActivePanel('OVERVIEW')}
            >
              System Health
            </button>
            <button
              className={`amfe-tab-btn ${activePanel === 'ERRORS' ? 'active' : ''}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              onClick={() => setActivePanel('ERRORS')}
            >
              Errors & Churn
            </button>
            <button
              className={`amfe-tab-btn ${activePanel === 'SECURITY' ? 'active' : ''}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
              onClick={() => setActivePanel('SECURITY')}
            >
              Security Audits
            </button>
          </div>

          <button
            className="amfe-btn"
            style={{ fontSize: '0.78rem' }}
            onClick={() => setUseLiveIframe(!useLiveIframe)}
          >
            {useLiveIframe ? 'View Enhanced Native Panels' : 'Switch to Live IFrame'}
          </button>

          <a
            href={fullGrafanaUrl}
            target="_blank"
            rel="noreferrer"
            className="amfe-btn amfe-btn-primary"
            style={{ textDecoration: 'none', fontSize: '0.78rem' }}
          >
            <ExternalLink size={13} />
            <span>Open in Grafana</span>
          </a>
        </div>
      </div>

      {/* Main Visual Display */}
      {useLiveIframe ? (
        <div className="amfe-glass-card amfe-grafana-container" style={{ padding: '0.75rem' }}>
          <iframe
            src={fullGrafanaUrl}
            className="amfe-grafana-frame"
            title="Embedded Grafana Dashboard"
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Native High-Fidelity Grafana Mirror with Live Annotations */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {/* Panel 1: Gauge */}
            <div className="amfe-glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <span className="amfe-drawer-label">LIVE CUSTOMER RISK GAUGE</span>
              <div style={{ position: 'relative', width: 180, height: 100, margin: '1rem auto 0 auto' }}>
                <svg viewBox="0 0 180 100" style={{ width: '100%', height: '100%' }}>
                  <path
                    d="M 20 90 A 70 70 0 0 1 160 90"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="14"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 20 90 A 70 70 0 0 1 160 90"
                    fill="none"
                    stroke={metrics.riskScore > 40 ? '#ef4444' : metrics.riskScore > 20 ? '#f59e0b' : '#10b981'}
                    strokeWidth="14"
                    strokeDasharray="220"
                    strokeDashoffset={220 - (220 * Math.min(100, metrics.riskScore)) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
                    {metrics.riskScore}%
                  </span>
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--amfe-text-muted)', display: 'block', marginTop: '0.5rem' }}>
                Threshold: Alerts trigger at &gt;30%
              </span>
            </div>

            {/* Panel 2: Total Events Stat */}
            <div className="amfe-glass-card" style={{ padding: '1.25rem' }}>
              <span className="amfe-drawer-label">AUDIT EVENT VELOCITY (1M)</span>
              <p style={{ fontSize: '2.4rem', fontWeight: 800, color: '#38bdf8', margin: '0.5rem 0' }}>
                {(metrics.totalEvents / 60).toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--amfe-text-dim)' }}>ops/s</span>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#10b981' }}>
                <ShieldCheck size={14} />
                <span>Zero drop-rate recorded in RabbitMQ bus</span>
              </div>
            </div>

            {/* Panel 3: Critical Anomaly Counter */}
            <div className="amfe-glass-card" style={{ padding: '1.25rem' }}>
              <span className="amfe-drawer-label">CRITICAL LOGS REQUIRING ATTENTION</span>
              <p style={{ fontSize: '2.4rem', fontWeight: 800, color: metrics.criticalCount > 0 ? '#ef4444' : '#10b981', margin: '0.5rem 0' }}>
                {metrics.criticalCount}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--amfe-text-muted)' }}>
                <AlertTriangle size={14} style={{ color: metrics.criticalCount > 0 ? '#ef4444' : '#10b981' }} />
                <span>{metrics.criticalCount > 0 ? 'Urgent mitigations needed' : 'All service thresholds stable'}</span>
              </div>
            </div>
          </div>

          {/* Grafana Annotations Overlay Timeline */}
          <div className="amfe-glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#ffffff' }}>
                  Grafana Dashboard Annotation Markers (Audit $\leftrightarrow$ Metric Spikes)
                </span>
              </div>
              <span className="amfe-mono" style={{ fontSize: '0.75rem', color: 'var(--amfe-text-dim)' }}>
                Scraped via /api/v1/audit/grafana/annotations
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {[
                { time: '2m ago', title: '[CRITICAL] ORDER_CHECKOUT_FAILED', text: 'Stripe webhook gateway connection timeout (ord-883921)', tag: 'checkout-failure' },
                { time: '7m ago', title: '[CRITICAL] AUTH_BRUTE_FORCE_DETECTED', text: '24 attempts from IP 185.220.101.5 on root@enterprise.internal', tag: 'security-anomaly' },
                { time: '14m ago', title: '[WARN] INVENTORY_STOCK_DEPLETED', text: 'SKU quantum-ultra down to 2 units in warehouse wh-eu-central-1', tag: 'inventory' }
              ].map((ann, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderLeft: '3px solid #ef4444',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0 var(--amfe-radius-sm) var(--amfe-radius-sm) 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#ffffff', display: 'block' }}>
                      {ann.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--amfe-text-muted)' }}>
                      {ann.text}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="amfe-badge amfe-badge-critical" style={{ fontSize: '0.68rem' }}>
                      {ann.tag}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--amfe-text-dim)', marginTop: 2 }}>
                      {ann.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
