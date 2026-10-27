import React, { useState, useEffect } from 'react';
import { Home, Plus, MapPin, RefreshCw, Building2 } from 'lucide-react';
import { PropertyDto, CreatePropertyRequestDto } from '@monolith/contracts';

export const PropertyView: React.FC = () => {
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<CreatePropertyRequestDto>({
    title: 'Sunset Palms Residences',
    description: 'High-end 3BHK with panoramic bay view',
    category: 'RESIDENTIAL',
    propertyType: 'APARTMENT',
    address: {
      street: '12 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400020',
      country: 'India'
    },
    areaSqFt: 1850,
    amenities: ['24/7 Security', 'Clubhouse', 'Covered Parking', 'Power Backup'],
    emergencyContact: {
      name: 'Vikram Sharma',
      phone: '+919820011223',
      relationship: 'Property Advocate'
    },
    emergencyFloatLimit: 10000
  });

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/properties');
      if (res.ok) {
        const json = await res.json();
        setProperties(json.data || []);
      } else {
        // Mock fallback for UI demo when backend auth requires token
        setProperties([
          {
            id: 'prop-101',
            ownerId: 'owner-me',
            title: 'Sunset Palms Residences',
            description: 'Luxury sea-facing apartment',
            category: 'RESIDENTIAL',
            propertyType: 'APARTMENT',
            status: 'VACANT',
            address: {
              street: '12 Marine Drive',
              city: 'Mumbai',
              state: 'Maharashtra',
              postalCode: '400020',
              country: 'India'
            },
            areaSqFt: 1850,
            amenities: ['Power Backup', '24/7 Guard', 'Elevator', 'Intercom'],
            emergencyContact: { name: 'Vikram Sharma', phone: '+919820011223', relationship: 'Advocate' },
            emergencyFloatLimit: 10000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'prop-102',
            ownerId: 'owner-me',
            title: 'Koramangala Tech Loft',
            description: 'Commercial office suite for boutique agency',
            category: 'COMMERCIAL',
            propertyType: 'OFFICE_SPACE',
            status: 'RENTED',
            address: {
              street: '80 Feet Road, 4th Block',
              city: 'Bengaluru',
              state: 'Karnataka',
              postalCode: '560034',
              country: 'India'
            },
            areaSqFt: 2400,
            amenities: ['Fiber Internet', 'HVAC', 'Access Control', 'Cafeteria'],
            emergencyContact: { name: 'Ananya Rao', phone: '+919845099881', relationship: 'Facility Lead' },
            emergencyFloatLimit: 15000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchProperties();
      } else {
        // Add locally to state
        const newProp: PropertyDto = {
          ...formData,
          id: `prop-${Date.now()}`,
          ownerId: 'owner-me',
          status: 'VACANT',
          amenities: formData.amenities || [],
          emergencyFloatLimit: formData.emergencyFloatLimit || 5000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setProperties(prev => [newProp, ...prev]);
        setShowAddModal(false);
      }
    } catch {
      setShowAddModal(false);
    }
  };

  const updateStatus = async (id: string, newStatus: any) => {
    try {
      await fetch(`/api/properties/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      setProperties(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    } catch {
      setProperties(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      VACANT: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
      RENTED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
      UNDER_MAINTENANCE: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
      LISTED_FOR_RENT: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },
      LISTED_FOR_SALE: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6' }
    };
    const c = colors[status] || { bg: 'rgba(255,255,255,0.1)', text: '#fff' };
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        background: c.bg,
        color: c.text,
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.04em'
      }}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Properties Portfolio (FR-PROP)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Real Estate Asset Governance, Remote Occupancy Telemetry & Emergency Float Reserves
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchProperties}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
          >
            <Plus size={16} /> Onboard Property
          </button>
        </div>
      </div>

      {/* Property Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {properties.map(p => (
          <div
            key={p.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  {p.category === 'COMMERCIAL' ? <Building2 size={16} color="#818cf8" /> : <Home size={16} color="#818cf8" />}
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#818cf8' }}>
                    {p.propertyType} • {p.category}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.title}</h3>
              </div>
              {getStatusBadge(p.status)}
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {p.description}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <MapPin size={15} color="#94a3b8" />
              <span>{p.address.street}, {p.address.city}, {p.address.state} - {p.address.postalCode}</span>
            </div>

            {/* Metrics Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              padding: '12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Super Area</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.areaSqFt} sq ft</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Emergency Float</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>₹{p.emergencyFloatLimit?.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Emergency Contact</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.emergencyContact?.name}
                </div>
              </div>
            </div>

            {/* Quick Status State Machine Actions */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', width: '100%' }}>Transition Status:</span>
              {p.status === 'VACANT' && (
                <>
                  <button onClick={() => updateStatus(p.id, 'LISTED_FOR_RENT')} style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>List for Rent</button>
                  <button onClick={() => updateStatus(p.id, 'RENTED')} style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Mark Rented</button>
                  <button onClick={() => updateStatus(p.id, 'UNDER_MAINTENANCE')} style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Maintenance</button>
                </>
              )}
              {p.status === 'RENTED' && (
                <button onClick={() => updateStatus(p.id, 'VACANT')} style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Tenant Vacated</button>
              )}
              {p.status === 'UNDER_MAINTENANCE' && (
                <button onClick={() => updateStatus(p.id, 'VACANT')} style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Repairs Finished</button>
              )}
              {p.status.startsWith('LISTED') && (
                <button onClick={() => updateStatus(p.id, 'RENTED')} style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Converted to Lease</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Onboard Property Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Onboard Real Estate Asset
            </h3>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Property Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff' }}
                  >
                    <option value="RESIDENTIAL">Residential</option>
                    <option value="COMMERCIAL">Commercial</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Property Type</label>
                  <select
                    value={formData.propertyType}
                    onChange={e => setFormData({ ...formData, propertyType: e.target.value as any })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff' }}
                  >
                    <option value="APARTMENT">Apartment</option>
                    <option value="VILLA">Villa</option>
                    <option value="INDEPENDENT_HOUSE">Independent House</option>
                    <option value="OFFICE_SPACE">Office Space</option>
                    <option value="RETAIL_SHOP">Retail Shop</option>
                    <option value="WAREHOUSE">Warehouse</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Area (Sq Ft)</label>
                  <input
                    type="number"
                    value={formData.areaSqFt}
                    onChange={e => setFormData({ ...formData, areaSqFt: Number(e.target.value) })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Emergency Float Limit (₹)</label>
                  <input
                    type="number"
                    value={formData.emergencyFloatLimit}
                    onChange={e => setFormData({ ...formData, emergencyFloatLimit: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: '8px', background: '#4f46e5', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
