import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle,
  RotateCw,
  UserX,
  Database,
  CheckCircle2
} from 'lucide-react';
import { AlertIncident, RemediationPayload } from '../types.js';

interface AlertCenterTabProps {
  alerts: AlertIncident[];
  onRemediate: (payload: RemediationPayload) => Promise<void>;
}

export const AlertCenterTab: React.FC<AlertCenterTabProps> = ({ alerts, onRemediate }) => {
  const [actingAlertId, setActingAlertId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRemediate = async (alert: AlertIncident, actionType: RemediationPayload['actionType']) => {
    setActingAlertId(alert.id);
    try {
      await onRemediate({
        alertId: alert.id,
        actionType,
        targetResource: alert.service,
        notes: `Rapid customer-protection remediation triggered for ${alert.title}`
      });
      setSuccessMsg(`Action '${actionType}' triggered successfully for ${alert.service}!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } finally {
      setActingAlertId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Alert Center Header */}
      <div
        className="amfe-glass-card"
        style={{
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: '4px solid #ef4444'
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: '#ffffff' }}>
            Customer Retention & Incident Prevention Center
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--amfe-text-muted)' }}>
            Real-time proactive alerts alerting engineers and operators before customers drop off or experience transaction loss.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="amfe-badge amfe-badge-critical">
            {alerts.filter(a => a.status === 'FIRING').length} Firing Incidents
          </span>
        </div>
      </div>

      {successMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--amfe-radius-sm)',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.88rem'
          }}
        >
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Active Alerts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {alerts.map(alert => {
          const isFiring = alert.status === 'FIRING';
          const isActing = actingAlertId === alert.id;

          return (
            <div
              key={alert.id}
              className="amfe-glass-card"
              style={{
                padding: '1.25rem',
                borderLeft: `4px solid ${isFiring ? (alert.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b') : '#10b981'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--amfe-radius-sm)',
                      background: isFiring ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: isFiring ? '#ef4444' : '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isFiring ? <AlertOctagon size={20} /> : <CheckCircle2 size={20} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#ffffff' }}>
                        {alert.title}
                      </h4>
                      <span className={alert.severity === 'CRITICAL' ? 'amfe-badge amfe-badge-critical' : 'amfe-badge amfe-badge-warn'}>
                        {alert.severity}
                      </span>
                      <span className="amfe-badge" style={{ background: isFiring ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: isFiring ? '#f87171' : '#34d399' }}>
                        {alert.status}
                      </span>
                    </div>

                    <p style={{ margin: '0.45rem 0', fontSize: '0.85rem', color: '#fecaca', fontWeight: 500 }}>
                      {alert.customerImpact}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--amfe-text-dim)' }}>
                      <span>Target Service: <strong style={{ color: '#93c5fd' }}>{alert.service}</strong></span>
                      <span>Triggered: {new Date(alert.triggeredAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Remediation Action Buttons */}
                {isFiring && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {alert.suggestedAction === 'RETRY_TRANSACTION' && (
                      <button
                        className="amfe-btn amfe-btn-primary"
                        disabled={isActing}
                        onClick={() => handleRemediate(alert, 'RETRY_TRANSACTION')}
                      >
                        <RotateCw size={14} className={isActing ? 'amfe-pulse-dot' : ''} />
                        <span>Auto-Retry Failed Txns</span>
                      </button>
                    )}

                    {alert.suggestedAction === 'BLOCK_ACTOR_IP' && (
                      <button
                        className="amfe-btn"
                        style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.4)' }}
                        disabled={isActing}
                        onClick={() => handleRemediate(alert, 'BLOCK_ACTOR_IP')}
                      >
                        <UserX size={14} className={isActing ? 'amfe-pulse-dot' : ''} />
                        <span>Enforce IP Rate-Limit</span>
                      </button>
                    )}

                    {alert.suggestedAction === 'SCALE_DB_POOL' && (
                      <button
                        className="amfe-btn amfe-btn-primary"
                        disabled={isActing}
                        onClick={() => handleRemediate(alert, 'SCALE_DB_POOL')}
                      >
                        <Database size={14} />
                        <span>Auto-Scale Connection Pool</span>
                      </button>
                    )}

                    <button
                      className="amfe-btn"
                      disabled={isActing}
                      onClick={() => handleRemediate(alert, 'ACKNOWLEDGE_INCIDENT')}
                    >
                      <CheckCircle size={14} />
                      <span>Acknowledge</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
