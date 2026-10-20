import React, { useState } from 'react';
import {
  X,
  RotateCw,
  UserX,
  BellRing,
  CheckCircle,
  Database,
  Clock,
  Globe,
  Terminal,
  Zap
} from 'lucide-react';
import { AuditLogItem, RemediationPayload } from '../types.js';

interface DrawerInspectionProps {
  log: AuditLogItem | null;
  onClose: () => void;
  onRemediate: (payload: RemediationPayload) => Promise<void>;
}

export const DrawerInspection: React.FC<DrawerInspectionProps> = ({ log, onClose, onRemediate }) => {
  const [submitting, setSubmitting] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!log) return null;

  const handleAction = async (actionType: RemediationPayload['actionType']) => {
    setSubmitting(true);
    setSuccessNotice(null);
    try {
      await onRemediate({
        actionType,
        targetResource: log.resource,
        notes: customNote || `Action triggered for audit log ${log.id} (${log.action})`
      });
      setSuccessNotice(`Remediation '${actionType}' dispatched!`);
      setTimeout(() => setSuccessNotice(null), 3500);
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'amfe-badge amfe-badge-critical';
      case 'ERROR': return 'amfe-badge amfe-badge-error';
      case 'WARN': return 'amfe-badge amfe-badge-warn';
      default: return 'amfe-badge amfe-badge-info';
    }
  };

  return (
    <div className="amfe-drawer-overlay" onClick={onClose}>
      <div className="amfe-drawer" onClick={e => e.stopPropagation()} id="amfe-inspection-drawer">
        {/* Header */}
        <div className="amfe-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className={getSeverityBadgeClass(log.severity)}>{log.severity}</span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff' }}>
              {log.action}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--amfe-text-muted)',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="amfe-drawer-body">
          {successNotice && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                padding: '0.75rem',
                borderRadius: 'var(--amfe-radius-sm)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem'
              }}
            >
              <CheckCircle size={16} />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Trace & Context */}
          <div className="amfe-drawer-section">
            <span className="amfe-drawer-label">Audit Meta & Identity</span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '0.85rem',
                borderRadius: 'var(--amfe-radius-sm)',
                border: '1px solid var(--amfe-border)',
                fontSize: '0.8rem'
              }}
            >
              <div>
                <span style={{ color: 'var(--amfe-text-dim)', display: 'block', fontSize: '0.72rem' }}>
                  TIMESTAMP
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Clock size={12} style={{ color: 'var(--amfe-text-muted)' }} />
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <span style={{ color: 'var(--amfe-text-dim)', display: 'block', fontSize: '0.72rem' }}>
                  TARGET RESOURCE
                </span>
                <span style={{ fontWeight: 600, color: '#93c5fd', marginTop: 2, display: 'block' }}>
                  {log.resource}
                </span>
              </div>

              <div>
                <span style={{ color: 'var(--amfe-text-dim)', display: 'block', fontSize: '0.72rem' }}>
                  ACTOR / EMAIL
                </span>
                <span style={{ color: '#cbd5e1', marginTop: 2, display: 'block' }}>
                  {log.actorEmail || 'System Process'}
                </span>
              </div>

              <div>
                <span style={{ color: 'var(--amfe-text-dim)', display: 'block', fontSize: '0.72rem' }}>
                  IP ADDRESS
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, color: '#cbd5e1' }}>
                  <Globe size={12} style={{ color: 'var(--amfe-text-muted)' }} />
                  {log.ipAddress || 'Internal Microservice'}
                </span>
              </div>
            </div>
          </div>

          {/* Correlation ID */}
          <div className="amfe-drawer-section">
            <span className="amfe-drawer-label">Cross-Service Trace (Correlation ID)</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--amfe-radius-sm)',
                fontSize: '0.8rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={14} style={{ color: '#c084fc' }} />
                <span className="amfe-mono" style={{ color: '#e9d5ff' }}>
                  {log.correlationId || 'N/A'}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#c084fc' }}>Span ID Verified</span>
            </div>
          </div>

          {/* Payload Details */}
          <div className="amfe-drawer-section">
            <span className="amfe-drawer-label">Event Payload & Telemetry Payload</span>
            <pre className="amfe-json-block">
              {JSON.stringify(log.details || {}, null, 2)}
            </pre>
          </div>

          {/* Quick note input */}
          <div className="amfe-drawer-section">
            <span className="amfe-drawer-label">Remediation Action Log Note</span>
            <input
              type="text"
              placeholder="e.g. Authorized customer retry after Stripe gateway restoration"
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              className="amfe-search-input"
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--amfe-border)',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--amfe-radius-sm)',
                color: '#ffffff'
              }}
            />
          </div>
        </div>

        {/* Remediation Action Grid */}
        <div className="amfe-drawer-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f87171', fontSize: '0.78rem', fontWeight: 600 }}>
            <Zap size={14} />
            <span>INSTANT REMEDIATION ACTIONS (PREVENT CUSTOMER CHURN)</span>
          </div>

          <div className="amfe-action-grid">
            <button
              id="btn-action-retry"
              className="amfe-btn amfe-btn-primary"
              disabled={submitting}
              onClick={() => handleAction('RETRY_TRANSACTION')}
            >
              <RotateCw size={14} />
              <span>Retry Transaction</span>
            </button>

            <button
              id="btn-action-block-actor"
              className="amfe-btn"
              style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              disabled={submitting}
              onClick={() => handleAction('BLOCK_ACTOR_IP')}
            >
              <UserX size={14} />
              <span>Quarantine IP / Actor</span>
            </button>

            <button
              id="btn-action-page-ops"
              className="amfe-btn"
              disabled={submitting}
              onClick={() => handleAction('PAGE_ON_CALL_OPS')}
            >
              <BellRing size={14} />
              <span>Page On-Call SRE</span>
            </button>

            <button
              id="btn-action-scale-db"
              className="amfe-btn"
              disabled={submitting}
              onClick={() => handleAction('SCALE_DB_POOL')}
            >
              <Database size={14} />
              <span>Scale Connection Pool</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
