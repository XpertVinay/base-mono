import React, { useState, useEffect } from 'react';
import { UserCheck, Shield, CheckCircle2, Sliders } from 'lucide-react';
import { CaretakerProfileDto, CaretakerAssignmentDto, PermissionScope } from '@monolith/contracts';

export const CaretakingView: React.FC = () => {
  const [caretakers, setCaretakers] = useState<CaretakerProfileDto[]>([]);
  const [assignments, setAssignments] = useState<CaretakerAssignmentDto[]>([]);

  useEffect(() => {
    // Demo seed data
    setCaretakers([
      {
        id: 'care-1',
        userId: 'usr-c1',
        name: 'Ramesh Patel',
        phone: '+919876543210',
        experienceYears: 7,
        serviceCities: ['Mumbai', 'Thane'],
        skills: ['Plumbing Oversight', 'Key Holding', 'Tenant Screening', 'Vendor Management'],
        kycStatus: 'VERIFIED',
        ratingAverage: 4.9,
        completedTasksCount: 142,
        isAvailable: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'care-2',
        userId: 'usr-c2',
        name: 'Deepak Hegde',
        phone: '+919845012345',
        experienceYears: 4,
        serviceCities: ['Bengaluru', 'Mysuru'],
        skills: ['Electrical Triage', 'Bi-weekly Inspection', 'Rental Visits'],
        kycStatus: 'VERIFIED',
        ratingAverage: 4.8,
        completedTasksCount: 88,
        isAvailable: true,
        createdAt: new Date().toISOString()
      }
    ]);

    setAssignments([
      {
        id: 'asg-01',
        propertyId: 'prop-101',
        caretakerId: 'care-1',
        ownerId: 'owner-me',
        status: 'ACTIVE',
        startDate: '2026-01-01T00:00:00Z',
        monthlyFee: 12000,
        allowedPermissions: ['VIEW_PROPERTY', 'KEY_ACCESS', 'INSPECT_PREMISES', 'SOLICIT_QUOTES', 'AUTHORIZE_REPAIRS_WITHIN_LIMIT'],
        spendingThresholdLimit: 3000,
        acceptedAt: '2026-01-02T10:00:00Z',
        createdAt: '2026-01-01T00:00:00Z'
      }
    ]);
  }, []);

  const togglePermission = (asgId: string, perm: PermissionScope) => {
    setAssignments(prev => prev.map(asg => {
      if (asg.id !== asgId) return asg;
      const exists = asg.allowedPermissions.includes(perm);
      const updated = exists
        ? asg.allowedPermissions.filter(p => p !== perm)
        : [...asg.allowedPermissions, perm];
      return { ...asg, allowedPermissions: updated };
    }));
  };

  const updateThreshold = (asgId: string, limit: number) => {
    setAssignments(prev => prev.map(asg => asg.id === asgId ? { ...asg, spendingThresholdLimit: limit } : asg));
  };

  const terminateAssignment = (asgId: string) => {
    setAssignments(prev => prev.map(asg => asg.id === asgId ? {
      ...asg,
      status: 'TERMINATED',
      allowedPermissions: [],
      terminatedAt: new Date().toISOString()
    } : asg));
  };

  const allPermissions: { key: PermissionScope; label: string; desc: string }[] = [
    { key: 'VIEW_PROPERTY', label: 'View Telemetry', desc: 'Can view property records and sensor telemetry' },
    { key: 'KEY_ACCESS', label: 'Key & Access Control', desc: 'Authorized for digital locks and physical key custody' },
    { key: 'INSPECT_PREMISES', label: 'Routine Inspections', desc: 'Submit photo checklists and habitability audits' },
    { key: 'SOLICIT_QUOTES', label: 'Solicit Vendor Bids', desc: 'Request and compare contractor repair bids' },
    { key: 'AUTHORIZE_REPAIRS_WITHIN_LIMIT', label: 'Auto-Repair Signoff', desc: 'Authorize repairs strictly under threshold' },
    { key: 'CONDUCT_VISITS', label: 'Tenant/Buyer Visits', desc: 'Show premises to verified prospective tenants' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Caretaker Assignment & Granular Permissions (FR-CARE / FR-PERM)
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Strict Least-Privilege Delegation, Zero-Spend-Without-Approval Thresholds & Instant Revocation
        </p>
      </div>

      {/* Active Assignments & Permission Matrix */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} /> Active Property Caretaking Delegations
        </h3>

        {assignments.map(asg => (
          <div
            key={asg.id}
            style={{
              background: 'var(--bg-card)',
              border: asg.status === 'TERMINATED' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Property: Sunset Palms (prop-101)</span>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Assigned Caretaker: Ramesh Patel (care-1)
                </h4>
                <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <CheckCircle2 size={14} /> Retainer: ₹{asg.monthlyFee.toLocaleString()}/mo • Started: Jan 2026
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  background: asg.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: asg.status === 'ACTIVE' ? '#34d399' : '#f87171',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}>
                  {asg.status}
                </span>

                {asg.status === 'ACTIVE' && (
                  <button
                    onClick={() => terminateAssignment(asg.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Revoke Delegation
                  </button>
                )}
              </div>
            </div>

            {/* Spending Threshold Slider */}
            {asg.status === 'ACTIVE' && (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Sliders size={16} color="#6366f1" /> Caretaker Autonomous Spending Limit Threshold (FR-PERM-002)
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#6366f1' }}>
                    ₹{asg.spendingThresholdLimit.toLocaleString()}
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20000"
                  step="500"
                  value={asg.spendingThresholdLimit}
                  onChange={e => updateThreshold(asg.id, Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <span>₹0 (Zero-Spend: All repairs need Owner approval)</span>
                  <span>₹20,000 (Max Autonomous Cap)</span>
                </div>
              </div>
            )}

            {/* Granular Permission Toggles */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                Granular Property Permissions (FR-PERM-001)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                {allPermissions.map(perm => {
                  const isGranted = asg.allowedPermissions.includes(perm.key);
                  return (
                    <div
                      key={perm.key}
                      onClick={() => asg.status === 'ACTIVE' && togglePermission(asg.id, perm.key)}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: isGranted ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                        border: isGranted ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                        cursor: asg.status === 'ACTIVE' ? 'pointer' : 'default',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        opacity: asg.status === 'TERMINATED' ? 0.5 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isGranted ? '#a5b4fc' : 'var(--text-primary)' }}>
                          {perm.label}
                        </span>
                        {isGranted ? (
                          <span style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 700 }}>GRANTED</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>REVOKED</span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{perm.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Caretaker Roster */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#818cf8', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={18} /> Verified Caretakers Network
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {caretakers.map(care => (
            <div
              key={care.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{care.name}</h4>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}>
                  {care.kycStatus}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {care.experienceYears} Years Experience • Rating: ★ {care.ratingAverage} ({care.completedTasksCount} audits)
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {care.skills.map((s, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      fontSize: '0.7rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
