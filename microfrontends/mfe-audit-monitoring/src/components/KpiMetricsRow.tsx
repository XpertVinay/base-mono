import React from 'react';
import { ShieldAlert, Activity, CheckCircle2, ShieldCheck, TrendingDown, AlertTriangle } from 'lucide-react';
import { MetricsSummary } from '../types.js';

interface KpiMetricsRowProps {
  metrics: MetricsSummary;
}

export const KpiMetricsRow: React.FC<KpiMetricsRowProps> = ({ metrics }) => {
  const isHighRisk = metrics.riskScore > 40;
  const isModerateRisk = metrics.riskScore > 20 && metrics.riskScore <= 40;

  const riskColor = isHighRisk ? '#ef4444' : isModerateRisk ? '#f59e0b' : '#10b981';
  const riskStatusText = isHighRisk
    ? 'CRITICAL CHURN RISK'
    : isModerateRisk
    ? 'ELEVATED THREAT'
    : 'OPTIMAL STABILITY';

  return (
    <div className="amfe-kpi-grid">
      {/* 1. Customer Impact / Churn Risk Index */}
      <div className="amfe-glass-card amfe-kpi-card" id="kpi-customer-risk">
        <div className="amfe-kpi-top">
          <span className="amfe-kpi-label">Customer Churn Risk</span>
          <div
            className="amfe-kpi-icon-wrap"
            style={{ background: `${riskColor}20`, color: riskColor }}
          >
            {isHighRisk ? <AlertTriangle size={18} /> : <ShieldAlert size={18} />}
          </div>
        </div>
        <p className="amfe-kpi-value" style={{ color: riskColor }}>
          {metrics.riskScore}
          <span className="amfe-kpi-unit">/100</span>
        </p>
        <div className="amfe-kpi-footer" style={{ color: riskColor }}>
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: riskColor
            }}
          />
          <strong>{riskStatusText}</strong>
          <span>• Active safeguards engaged</span>
        </div>
      </div>

      {/* 2. System Reliability SLA */}
      <div className="amfe-glass-card amfe-kpi-card" id="kpi-system-health">
        <div className="amfe-kpi-top">
          <span className="amfe-kpi-label">Uptime & Reliability SLA</span>
          <div className="amfe-kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <ShieldCheck size={18} />
          </div>
        </div>
        <p className="amfe-kpi-value" style={{ color: '#10b981' }}>
          {metrics.systemHealthPct}
          <span className="amfe-kpi-unit">%</span>
        </p>
        <div className="amfe-kpi-footer">
          <TrendingDown size={14} style={{ color: '#10b981' }} />
          <span>Error rate &lt; 0.04% across 11 microservices</span>
        </div>
      </div>

      {/* 3. Realtime Ingestion Throughput */}
      <div className="amfe-glass-card amfe-kpi-card" id="kpi-audit-volume">
        <div className="amfe-kpi-top">
          <span className="amfe-kpi-label">Audit Logs Streamed</span>
          <div className="amfe-kpi-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Activity size={18} />
          </div>
        </div>
        <p className="amfe-kpi-value" style={{ color: '#60a5fa' }}>
          {metrics.totalEvents.toLocaleString()}
          <span className="amfe-kpi-unit">events</span>
        </p>
        <div className="amfe-kpi-footer">
          <span>{metrics.criticalCount} critical • {metrics.errorCount} warning alerts</span>
        </div>
      </div>

      {/* 4. Automated Remediations Applied */}
      <div className="amfe-glass-card amfe-kpi-card" id="kpi-remediations">
        <div className="amfe-kpi-top">
          <span className="amfe-kpi-label">Mitigations Executed</span>
          <div className="amfe-kpi-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <CheckCircle2 size={18} />
          </div>
        </div>
        <p className="amfe-kpi-value" style={{ color: '#c084fc' }}>
          {metrics.remediationCount}
          <span className="amfe-kpi-unit">actions</span>
        </p>
        <div className="amfe-kpi-footer">
          <span>Targeting zero customer friction & churn</span>
        </div>
      </div>
    </div>
  );
};
