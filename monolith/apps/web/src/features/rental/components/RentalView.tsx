import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Phone,
  Mail,
  RefreshCw
} from 'lucide-react';
import { RentalListingDto, TenantLeadDto, CreateRentalListingRequestDto, CreateTenantLeadRequestDto, TenantLeadStatus } from '@monolith/contracts';

export const RentalView: React.FC = () => {
  const [listings, setListings] = useState<RentalListingDto[]>([]);
  const [leads, setLeads] = useState<TenantLeadDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string>('all');
  const [showAddListingModal, setShowAddListingModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  const [listingForm, setListingForm] = useState<CreateRentalListingRequestDto>({
    propertyId: 'prop-101',
    monthlyRent: 48000,
    securityDeposit: 150000,
    leaseDurationMonths: 11,
    permittedUse: 'RESIDENTIAL',
    description: 'Executive 3BHK with teakwood interiors and balcony garden'
  });

  const [leadForm, setLeadForm] = useState<CreateTenantLeadRequestDto>({
    listingId: '',
    tenantName: '',
    tenantPhone: '',
    tenantEmail: '',
    offeredRent: 45000,
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const listingRes = await fetch('/api/rentals/listings');
      if (listingRes.ok) {
        const json = await listingRes.json();
        setListings(json.data || []);
      } else {
        throw new Error('API unavailable');
      }

      const leadRes = await fetch('/api/rentals/leads');
      if (leadRes.ok) {
        const json = await leadRes.json();
        setLeads(json.data || []);
      }
    } catch {
      // Mock demonstration fallback
      setListings([
        {
          id: 'list-101',
          propertyId: 'prop-101',
          ownerId: 'owner-me',
          monthlyRent: 48000,
          securityDeposit: 150000,
          leaseDurationMonths: 11,
          availableFrom: new Date().toISOString(),
          permittedUse: 'RESIDENTIAL',
          description: 'Executive 3BHK with teakwood interiors and balcony garden',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'list-102',
          propertyId: 'prop-102',
          ownerId: 'owner-me',
          monthlyRent: 95000,
          securityDeposit: 400000,
          leaseDurationMonths: 24,
          availableFrom: new Date().toISOString(),
          permittedUse: 'COMMERCIAL',
          description: 'Grade-A tech park office suite with 28 workstations',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);

      setLeads([
        {
          id: 'lead-001',
          listingId: 'list-101',
          propertyId: 'prop-101',
          tenantName: 'Karan Mehra',
          tenantPhone: '+919811445566',
          tenantEmail: 'karan.mehra@fintech.io',
          status: 'NEW',
          offeredRent: 46000,
          notes: 'Moving from Pune for AWS office in Bandra',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'lead-002',
          listingId: 'list-101',
          propertyId: 'prop-101',
          tenantName: 'Dr. Radhika Sen',
          tenantPhone: '+919877112233',
          tenantEmail: 'radhika.sen@medclinic.org',
          status: 'VISIT_SCHEDULED',
          scheduledVisitDate: new Date(Date.now() + 86400000 * 2).toISOString(),
          offeredRent: 48000,
          notes: 'Family of 3, requested Sunday 4 PM walkthrough with Caretaker',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'lead-003',
          listingId: 'list-102',
          propertyId: 'prop-102',
          tenantName: 'Nexus Cloud Systems LLP',
          tenantPhone: '+919822998811',
          tenantEmail: 'ops@nexuscloud.in',
          status: 'CONVERTED',
          offeredRent: 95000,
          notes: 'Lease deed signed for 24 months, security deposit cleared',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/rentals/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingForm)
      });
      if (res.ok) {
        setShowAddListingModal(false);
        loadData();
      } else {
        // Optimistic append
        const newListing: RentalListingDto = {
          id: `list-${Date.now()}`,
          propertyId: listingForm.propertyId,
          ownerId: 'owner-me',
          monthlyRent: listingForm.monthlyRent,
          securityDeposit: listingForm.securityDeposit,
          leaseDurationMonths: listingForm.leaseDurationMonths ?? 11,
          availableFrom: new Date().toISOString(),
          permittedUse: listingForm.permittedUse ?? 'RESIDENTIAL',
          description: listingForm.description || '',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setListings(prev => [newListing, ...prev]);
        setShowAddListingModal(false);
      }
    } catch {
      setShowAddListingModal(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetListingId = leadForm.listingId || listings[0]?.id || 'list-101';
      const res = await fetch('/api/rentals/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leadForm, listingId: targetListingId })
      });
      if (res.ok) {
        setShowAddLeadModal(false);
        loadData();
      } else {
        const newLead: TenantLeadDto = {
          id: `lead-${Date.now()}`,
          listingId: targetListingId,
          propertyId: 'prop-101',
          tenantName: leadForm.tenantName,
          tenantPhone: leadForm.tenantPhone,
          tenantEmail: leadForm.tenantEmail,
          status: 'NEW',
          offeredRent: leadForm.offeredRent,
          notes: leadForm.notes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setLeads(prev => [newLead, ...prev]);
        setShowAddLeadModal(false);
      }
    } catch {
      setShowAddLeadModal(false);
    }
  };

  const updateLeadStatus = async (leadId: string, status: TenantLeadStatus) => {
    try {
      await fetch(`/api/rentals/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } finally {
      setLeads(prev =>
        prev.map(l => (l.id === leadId ? ({ ...l, status, updatedAt: new Date().toISOString() } as TenantLeadDto) : l))
      );
    }
  };

  const filteredLeads = selectedListingId === 'all'
    ? leads
    : leads.filter(l => l.listingId === selectedListingId);

  const totalProjectedRevenue = listings.reduce((acc, curr) => acc + curr.monthlyRent, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Metric Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}
      >
        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <KeyRound size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active Listings</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{listings.length} Properties</div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Projected Monthly Yield</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>₹{totalProjectedRevenue.toLocaleString()}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Prospective Tenant Leads</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{leads.length} Inquiries</div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Conversion Rate</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {leads.length > 0 ? Math.round((leads.filter(l => l.status === 'CONVERTED').length / leads.length) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Tenant Sourcing & Rental Funnel</h2>
          <span style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
            FR-RENT & FR-SALE
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowAddLeadModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(30, 41, 59, 0.6)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            <Users size={16} /> Record Lead
          </button>
          <button
            onClick={() => setShowAddListingModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Plus size={16} /> New Rental Listing
          </button>
          <button
            onClick={loadData}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Active Listings Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        {listings.map(item => (
          <div
            key={item.id}
            className="card"
            style={{
              padding: '20px',
              border: selectedListingId === item.id ? '1px solid var(--brand-primary)' : '1px solid var(--border-color)',
              boxShadow: selectedListingId === item.id ? '0 0 16px rgba(99, 102, 241, 0.2)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setSelectedListingId(selectedListingId === item.id ? 'all' : item.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: item.permittedUse === 'COMMERCIAL' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: item.permittedUse === 'COMMERCIAL' ? '#c084fc' : '#60a5fa'
                  }}
                >
                  {item.permittedUse}
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '8px' }}>
                  Property {item.propertyId}
                </h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-success)' }}>
                  ₹{item.monthlyRent.toLocaleString()}
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>/mo</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Deposit: ₹{item.securityDeposit.toLocaleString()}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
              {item.description}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Lease: {item.leaseDurationMonths} months</span>
              <span
                style={{
                  color: item.status === 'ACTIVE' ? 'var(--status-success)' : 'var(--text-secondary)',
                  fontWeight: 600
                }}
              >
                ● {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tenant Lead Pipeline Table */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            Prospective Tenant Leads & Inquiries
            {selectedListingId !== 'all' && (
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--brand-primary)', marginLeft: '8px' }}>
                (Filtered by Listing {selectedListingId})
              </span>
            )}
          </h3>
          {selectedListingId !== 'all' && (
            <button
              onClick={() => setSelectedListingId('all')}
              style={{ fontSize: '0.8rem', background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer' }}
            >
              Clear filter
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px' }}>Tenant Lead</th>
                <th style={{ padding: '12px' }}>Contact</th>
                <th style={{ padding: '12px' }}>Offer / Budget</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Notes / Schedule</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Workflow Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => (
                <tr key={lead.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600 }}>{lead.tenantName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {lead.id}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                      <Phone size={13} color="var(--text-secondary)" /> {lead.tenantPhone}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <Mail size={13} /> {lead.tenantEmail}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                      {lead.offeredRent ? `₹${lead.offeredRent.toLocaleString()}` : 'Standard'}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background:
                          lead.status === 'CONVERTED'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : lead.status === 'VISIT_SCHEDULED'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(99, 102, 241, 0.15)',
                        color:
                          lead.status === 'CONVERTED'
                            ? '#34d399'
                            : lead.status === 'VISIT_SCHEDULED'
                            ? '#fbbf24'
                            : '#818cf8'
                      }}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '240px' }}>
                      {lead.notes || '—'}
                    </div>
                    {lead.scheduledVisitDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px' }}>
                        <Calendar size={12} /> {new Date(lead.scheduledVisitDate).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      {lead.status === 'NEW' && (
                        <button
                          onClick={() => updateLeadStatus(lead.id, 'VISIT_SCHEDULED')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Schedule Visit
                        </button>
                      )}
                      {lead.status === 'VISIT_SCHEDULED' && (
                        <button
                          onClick={() => updateLeadStatus(lead.id, 'CONVERTED')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Finalize Lease
                        </button>
                      )}
                      {lead.status === 'CONVERTED' && (
                        <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> Leased
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Rental Listing */}
      {showAddListingModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>List Property for Rent</h3>
            <form onSubmit={handleCreateListing} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Property Reference ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={listingForm.propertyId}
                  onChange={e => setListingForm({ ...listingForm, propertyId: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={listingForm.monthlyRent}
                    onChange={e => setListingForm({ ...listingForm, monthlyRent: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Security Deposit (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={listingForm.securityDeposit}
                    onChange={e => setListingForm({ ...listingForm, securityDeposit: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Permitted Use</label>
                  <select
                    className="form-input"
                    value={listingForm.permittedUse}
                    onChange={e => setListingForm({ ...listingForm, permittedUse: e.target.value as any })}
                  >
                    <option value="RESIDENTIAL">Residential</option>
                    <option value="COMMERCIAL">Commercial</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Duration (Months)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={listingForm.leaseDurationMonths}
                    onChange={e => setListingForm({ ...listingForm, leaseDurationMonths: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Marketing Description</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={listingForm.description}
                  onChange={e => setListingForm({ ...listingForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddListingModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Tenant Lead */}
      {showAddLeadModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Record Tenant Inquiry</h3>
            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Tenant Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={leadForm.tenantName}
                  onChange={e => setLeadForm({ ...leadForm, tenantName: e.target.value })}
                  placeholder="e.g., Rajesh Khanna"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={leadForm.tenantPhone}
                    onChange={e => setLeadForm({ ...leadForm, tenantPhone: e.target.value })}
                    placeholder="+91 98000..."
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={leadForm.tenantEmail}
                    onChange={e => setLeadForm({ ...leadForm, tenantEmail: e.target.value })}
                    placeholder="email@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Budget / Rent Offer (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={leadForm.offeredRent || ''}
                  onChange={e => setLeadForm({ ...leadForm, offeredRent: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="form-label">Inquiry Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={leadForm.notes}
                  onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })}
                  placeholder="Move-in timeline, special requests..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
