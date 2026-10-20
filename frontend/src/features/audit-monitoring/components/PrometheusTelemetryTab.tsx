import React, { useState } from 'react';
import { Activity, Cpu, Play, Terminal } from 'lucide-react';
import { MetricsSummary } from '../types.js';

interface PrometheusTelemetryTabProps {
  metrics: MetricsSummary;
}

export const PrometheusTelemetryTab: React.FC<PrometheusTelemetryTabProps> = ({ metrics }) => {
  const [promQuery, setPromQuery] = useState('rate(audit_events_total[1m])');
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [isRunningQuery, setIsRunningQuery] = useState(false);

  const microservices = [
    { name: 'audit-service', port: 4011, status: 'UP', latency: '4ms', scrapeJob: 'audit-service' },
    { name: 'api-gateway', port: 4000, status: 'UP', latency: '2ms', scrapeJob: 'api-gateway' },
    { name: 'iam-service', port: 4001, status: 'UP', latency: '8ms', scrapeJob: 'iam-service' },
    { name: 'order-service', port: 4006, status: 'UP', latency: '12ms', scrapeJob: 'order-service' },
    { name: 'transaction-service', port: 4007, status: 'UP', latency: '15ms', scrapeJob: 'transaction-service' },
    { name: 'postgres', port: 5432, status: 'UP', latency: '1ms', scrapeJob: 'dbPool' },
    { name: 'rabbitmq', port: 5672, status: 'UP', latency: '3ms', scrapeJob: 'amqpBroker' }
  ];

  const handleRunQuery = () => {
    setIsRunningQuery(true);
    setTimeout(() => {
      if (promQuery.includes('rate')) {
        setQueryResult(`[
  {
    "metric": { "__name__": "audit_events_total", "severity": "INFO", "service": "audit-service" },
    "value": [${Math.floor(Date.now() / 1000)}, "24.8"]
  },
  {
    "metric": { "__name__": "audit_events_total", "severity": "ERROR", "service": "transaction-service" },
    "value": [${Math.floor(Date.now() / 1000)}, "0.14"]
  }
]`);
      } else if (promQuery.includes('risk')) {
        setQueryResult(`[
  {
    "metric": { "__name__": "customer_impact_risk_score" },
    "value": [${Math.floor(Date.now() / 1000)}, "${metrics.riskScore}"]
  }
]`);
      } else {
        setQueryResult(`[
  {
    "metric": { "__name__": "custom_telemetry", "quantile": "0.99" },
    "value": [${Math.floor(Date.now() / 1000)}, "0.084"]
  }
]`);
      }
      setIsRunningQuery(false);
    }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner */}
      <div
        className="amfe-glass-card"
        style={{
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: '4px solid #3b82f6'
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: '#ffffff' }}>
            Prometheus Metrics Telemetry Engine
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--amfe-text-muted)' }}>
            Scraping active endpoints at <span className="amfe-mono" style={{ color: '#93c5fd' }}>:4011/metrics</span> every 5s with OpenMetrics format.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--amfe-text-dim)', display: 'block' }}>SCRAPE HEALTH</span>
            <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>100% TARGETS HEALTHY</span>
          </div>
          <div style={{ width: 1, height: 28, background: 'var(--amfe-border)' }} />
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--amfe-text-dim)', display: 'block' }}>RETENTION</span>
            <span style={{ fontWeight: 700, color: '#f3f4f6', fontSize: '0.9rem' }}>15 Days TSDB</span>
          </div>
        </div>
      </div>

      {/* Realtime Metrics Telemetry Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>
        {/* SVG Chart 1: Audit Ingestion Rate */}
        <div className="amfe-glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: '#3b82f6' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>
                Ingestion Throughput (events/sec)
              </span>
            </div>
            <span className="amfe-badge amfe-badge-info">Live 5m Window</span>
          </div>

          {/* SVG Sparkline Graph */}
          <div style={{ width: '100%', height: 180, position: 'relative' }}>
            <svg viewBox="0 0 500 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="45" x2="500" y2="45" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
              <line x1="0" y1="135" x2="500" y2="135" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />

              {/* Area */}
              <path
                d="M 0 140 Q 60 110, 120 130 T 240 85 T 360 115 T 440 60 L 500 75 L 500 180 L 0 180 Z"
                fill="url(#blueGradient)"
              />
              {/* Line */}
              <path
                d="M 0 140 Q 60 110, 120 130 T 240 85 T 360 115 T 440 60 L 500 75"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
              />

              {/* Peak indicator */}
              <circle cx="440" cy="60" r="4" fill="#60a5fa" />
              <text x="445" y="52" fill="#93c5fd" fontSize="10" fontFamily="sans-serif">
                Peak: 48 evt/s
              </text>
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--amfe-text-dim)', marginTop: '0.5rem' }}>
            <span>-5 min ago</span>
            <span>-3 min ago</span>
            <span>-1 min ago</span>
            <span>Now</span>
          </div>
        </div>

        {/* SVG Chart 2: Customer Friction vs Error Velocity */}
        <div className="amfe-glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} style={{ color: '#ef4444' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>
                Failure & Anomaly Velocity (Risk Spike)
              </span>
            </div>
            <span className="amfe-badge amfe-badge-critical">Customer Safeguard</span>
          </div>

          <div style={{ width: '100%', height: 180, position: 'relative' }}>
            <svg viewBox="0 0 500 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="45" x2="500" y2="45" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
              <line x1="0" y1="135" x2="500" y2="135" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />

              <path
                d="M 0 170 Q 80 165, 160 168 T 300 150 T 400 90 T 460 70 L 500 100 L 500 180 L 0 180 Z"
                fill="url(#redGradient)"
              />
              <path
                d="M 0 170 Q 80 165, 160 168 T 300 150 T 400 90 T 460 70 L 500 100"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
              />

              <circle cx="460" cy="70" r="4" fill="#f87171" />
              <text x="360" y="65" fill="#fca5a5" fontSize="10" fontFamily="sans-serif">
                Checkout Spike: 4.2%
              </text>
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--amfe-text-dim)', marginTop: '0.5rem' }}>
            <span>-5 min ago</span>
            <span>-3 min ago</span>
            <span>-1 min ago</span>
            <span>Now</span>
          </div>
        </div>
      </div>

      {/* Microservice Scrape Targets Matrix */}
      <div className="amfe-glass-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', color: '#ffffff' }}>
          Microservices Cluster Health & Scrape Targets
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
          {microservices.map(ms => (
            <div
              key={ms.name}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--amfe-border)',
                borderRadius: 'var(--amfe-radius-sm)',
                padding: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px #10b981'
                  }}
                />
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#ffffff', display: 'block' }}>
                    {ms.name}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--amfe-text-dim)' }}>
                    :{ms.port} • job: {ms.scrapeJob}
                  </span>
                </div>
              </div>
              <span className="amfe-mono" style={{ fontSize: '0.75rem', color: '#93c5fd' }}>
                {ms.latency}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* PromQL Query Console */}
      <div className="amfe-glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Terminal size={16} style={{ color: '#38bdf8' }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>
            Interactive PromQL Query Sandbox
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {[
            'rate(audit_events_total[1m])',
            'customer_impact_risk_score',
            'sum(audit_errors_total)',
            'http_requests_total'
          ].map(sampleQuery => (
            <button
              key={sampleQuery}
              className="amfe-btn"
              style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
              onClick={() => setPromQuery(sampleQuery)}
            >
              {sampleQuery}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            id="input-promql-query"
            type="text"
            value={promQuery}
            onChange={e => setPromQuery(e.target.value)}
            className="amfe-search-input"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid var(--amfe-border)',
              borderRadius: 'var(--amfe-radius-sm)',
              padding: '0.65rem 0.85rem',
              color: '#38bdf8',
              fontFamily: 'var(--amfe-font-mono)',
              fontSize: '0.82rem'
            }}
          />
          <button
            id="btn-execute-promql"
            className="amfe-btn amfe-btn-primary"
            onClick={handleRunQuery}
            disabled={isRunningQuery}
          >
            <Play size={14} />
            <span>Execute</span>
          </button>
        </div>

        {queryResult && (
          <div style={{ marginTop: '0.85rem' }}>
            <span className="amfe-drawer-label">PromQL Vector Response</span>
            <pre className="amfe-json-block" style={{ marginTop: '0.4rem' }}>
              {queryResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
