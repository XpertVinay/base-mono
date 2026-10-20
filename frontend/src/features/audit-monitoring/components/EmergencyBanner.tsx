import React from 'react';
import { AlertOctagon, ArrowRight, Zap } from 'lucide-react';
import { AlertIncident } from '../types.js';

interface EmergencyBannerProps {
  criticalAlert?: AlertIncident;
  onRemediate: (alert: AlertIncident) => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({ criticalAlert, onRemediate }) => {
  if (!criticalAlert) return null;

  return (
    <div className="amfe-emergency-banner" id="amfe-emergency-banner">
      <div className="amfe-emergency-info">
        <div style={{ color: '#ef4444' }}>
          <AlertOctagon size={28} />
        </div>
        <div className="amfe-emergency-text">
          <div className="amfe-emergency-heading">
            <span>URGENT CUSTOMER IMPACT:</span>
            <span>{criticalAlert.title}</span>
          </div>
          <div className="amfe-emergency-sub">
            {criticalAlert.customerImpact} • Service: <strong style={{ color: '#ffffff' }}>{criticalAlert.service}</strong>
          </div>
        </div>
      </div>

      <button
        id="btn-remediate-emergency"
        className="amfe-btn-remediate-now"
        onClick={() => onRemediate(criticalAlert)}
      >
        <Zap size={16} />
        <span>One-Click Remediate</span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
};
