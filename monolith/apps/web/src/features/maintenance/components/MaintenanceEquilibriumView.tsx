import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  MapPin,
  TrendingUp
} from 'lucide-react';
import { MaintenanceRequestDto, MaintenancePriority } from '@monolith/contracts';

export const MaintenanceEquilibriumView: React.FC = () => {
  const [requests, setRequests] = useState<MaintenanceRequestDto[]>([
    {
      id: 'maint-001',
      propertyId: 'prop-101',
      reporterId: 'tenant-99',
      reporterRole: 'TENANT',
      category: 'PLUMBING',
      priority: 'P1_EMERGENCY',
      status: 'EMERGENCY_MOBILIZED',
      title: 'Main riser line leak flooding utility area',
      description: 'Water leaking heavily from ceiling joint in utility corridor, pressure rising',
      photoUrls: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80'],
      sla: {
        responseDeadline: new Date(Date.now() + 12 * 60 * 1000).toISOString(), // 12 mins left
        resolutionDeadline: new Date(Date.now() + 3.5 * 3600 * 1000).toISOString(), // 3.5 hrs left
        isResponseBreached: false,
        isResolutionBreached: false
      },
      isEmergencyFloatCovered: true,
      emergencyAmountDrawn: 5000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'maint-002',
      propertyId: 'prop-102',
      reporterId: 'care-1',
      reporterRole: 'CARETAKER',
      category: 'HVAC_COOLING',
      priority: 'P2_URGENT',
      status: 'QUOTED',
      title: 'Commercial AC outdoor condenser fan motor seizure',
      description: 'Chamber temperature reaching 31°C, server room cooling compromised',
      photoUrls: ['https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80'],
      sla: {
        responseDeadline: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        resolutionDeadline: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
        isResponseBreached: false,
        isResolutionBreached: false
      },
      isEmergencyFloatCovered: false,
      emergencyAmountDrawn: 0,
      selectedQuotation: {
        id: 'q-88',
        vendorId: 'v-12',
        vendorName: 'CoolAir Industrial HVAC',
        estimatedCost: 6500,
        breakdown: 'Capacitor replacement ₹1,500 + Motor rewinding ₹3,500 + Gas recharge ₹1,500',
        validUntil: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
        isOwnerApproved: false
      },
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'maint-003',
      propertyId: 'prop-101',
      reporterId: 'owner-me',
      reporterRole: 'OWNER',
      category: 'ELECTRICAL',
      priority: 'P1_EMERGENCY',
      status: 'COMPLETED',
      title: 'Kitchen distribution board arcing spark',
      description: 'Sparks noticed around 32A MCB switch during appliance load',
      photoUrls: [],
      sla: {
        responseDeadline: new Date().toISOString(),
        resolutionDeadline: new Date().toISOString(),
        isResponseBreached: false,
        isResolutionBreached: false
      },
      isEmergencyFloatCovered: true,
      emergencyAmountDrawn: 2400,
      proofOfWork: {
        beforePhotoUrls: ['https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80'],
        afterPhotoUrls: ['https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80'],
        receiptUrls: ['https://storage.platform.io/invoices/inv-092.pdf'],
        gpsLatitude: 18.9220,
        gpsLongitude: 72.8347,
        vendorSignatureTimestamp: new Date().toISOString(),
        caretakerVerifiedTimestamp: new Date().toISOString(),
        finalCost: 2400
      },
      createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);

  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  const getPriorityStyle = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'P1_EMERGENCY':
        return { badgeBg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', label: 'P1 EMERGENCY (≤4H SLA)' };
      case 'P2_URGENT':
        return { badgeBg: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b', label: 'P2 URGENT (≤24H SLA)' };
      case 'P3_STANDARD':
        return { badgeBg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6', label: 'P3 STANDARD (≤72H SLA)' };
      case 'P4_ROUTINE':
        return { badgeBg: 'rgba(107, 114, 128, 0.2)', text: '#9ca3af', label: 'P4 ROUTINE' };
    }
  };

  const approveQuote = (reqId: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id !== reqId) return r;
      if (r.selectedQuotation) {
        return {
          ...r,
          status: 'APPROVED',
          selectedQuotation: { ...r.selectedQuotation, isOwnerApproved: true, approvedAt: new Date().toISOString() }
        };
      }
      return r;
    }));
  };

  const filtered = filterPriority === 'ALL'
    ? requests
    : requests.filter(r => r.priority === filterPriority);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Equilibrium Vision Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(239, 68, 68, 0.1))',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ maxWidth: '780px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a5b4fc', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '6px' }}>
            <TrendingUp size={16} /> MAINTENANCE & MANAGEMENT EQUILIBRIUM ENGINE
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Dual-Sided Asset Preservation & Resident Habitability Guarantee
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Synthesizes owner long-term asset value and budget controls with resident zero-infrastructure-collapse living standards.
            Equipped with <strong>Pre-Authorized Emergency Float Escrow</strong>, <strong>Dynamic SLA Triage</strong>, and <strong>GPS Anti-Fraud Telemetry</strong>.
          </p>
        </div>

        {/* SLA Triage Summary Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 14px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div style={{ fontSize: '0.7rem', color: '#fca5a5' }}>P1 Emergency</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>≤ 15m / 4h</div>
          </div>
          <div style={{ padding: '8px 14px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <div style={{ fontSize: '0.7rem', color: '#fcd34d' }}>P2 Urgent</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>≤ 1h / 24h</div>
          </div>
          <div style={{ padding: '8px 14px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <div style={{ fontSize: '0.7rem', color: '#93c5fd' }}>P3 Standard</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#3b82f6' }}>≤ 4h / 72h</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'P1_EMERGENCY', 'P2_URGENT', 'P3_STANDARD'].map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: filterPriority === p ? '#4f46e5' : 'var(--bg-card)',
                color: filterPriority === p ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {p.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {filtered.map(req => {
          const style = getPriorityStyle(req.priority);
          return (
            <div
              key={req.id}
              style={{
                background: 'var(--bg-card)',
                border: req.priority === 'P1_EMERGENCY' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: req.priority === 'P1_EMERGENCY' ? '0 0 20px rgba(239, 68, 68, 0.1)' : '0 4px 16px rgba(0,0,0,0.1)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: style.badgeBg,
                      color: style.text,
                      fontSize: '0.75rem',
                      fontWeight: 800
                    }}>
                      {style.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Category: {req.category} • Property: {req.propertyId}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {req.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: req.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    color: req.status === 'COMPLETED' ? '#34d399' : '#a5b4fc',
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }}>
                    {req.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {req.description}
              </p>

              {/* Pillar 2: Emergency Float Escrow Badge */}
              {req.isEmergencyFloatCovered && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldAlert size={20} color="#ef4444" />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5' }}>
                        Emergency Circuit-Breaker Float Mobilized
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Pre-authorized escrow mobilized automatically without timezone delay to stop structural collapse.
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444' }}>
                    ₹{req.emergencyAmountDrawn.toLocaleString()} Escrow Float
                  </div>
                </div>
              )}

              {/* Quotation Workflow Card */}
              {req.selectedQuotation && (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Vendor Quotation</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {req.selectedQuotation.vendorName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {req.selectedQuotation.breakdown}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Estimated Cost</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                        ₹{req.selectedQuotation.estimatedCost.toLocaleString()}
                      </div>
                    </div>

                    {!req.selectedQuotation.isOwnerApproved ? (
                      <button
                        onClick={() => approveQuote(req.id)}
                        style={{
                          padding: '8px 16px',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        Approve Quotation
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={16} /> Owner Approved
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Proof of Work Anti-Fraud Telemetry */}
              {req.proofOfWork && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, fontSize: '0.85rem' }}>
                      <CheckCircle2 size={18} /> Verified Proof of Work Telemetry
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <MapPin size={14} color="#10b981" /> GPS Checked: {req.proofOfWork.gpsLatitude.toFixed(4)}°N, {req.proofOfWork.gpsLongitude.toFixed(4)}°E
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {req.proofOfWork.beforePhotoUrls.map((url, i) => (
                      <div key={`before-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>Before Photo</span>
                        <img src={url} alt="Before" style={{ width: '100px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                      </div>
                    ))}
                    {req.proofOfWork.afterPhotoUrls.map((url, i) => (
                      <div key={`after-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>After Photo</span>
                        <img src={url} alt="After" style={{ width: '100px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Itemized Cost: ₹{req.proofOfWork.finalCost.toLocaleString()} • Verified by Caretaker
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
