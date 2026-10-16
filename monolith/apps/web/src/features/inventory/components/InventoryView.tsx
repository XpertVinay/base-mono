import React, { useEffect, useState } from 'react';
import { InventoryItemDto } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { useAuth } from '../../../shared/hooks/useAuth.js';
import { Boxes, PackageCheck, RefreshCw } from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchInventory = async () => {
    const res = await apiClient.get<InventoryItemDto[]>('/api/inventory');
    if (res.success && res.data) {
      setItems(res.data);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleReserveStock = async (productId: string, quantity: number) => {
    if (!isAuthenticated) {
      alert('Please authenticate in IAM tab first');
      return;
    }
    setLoading(true);
    const res = await apiClient.post('/api/inventory/reserve', {
      productId,
      quantity,
      orderId: `demo-order-${Date.now()}`
    });

    if (res.success) {
      setMsg(`Reserved ${quantity} units of ${productId} successfully!`);
      await fetchInventory();
    } else {
      alert(res.error?.message || 'Stock reservation failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Boxes size={22} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Inventory & Stock Reservation</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Stock levels, reservations, and availability tracking. Invariants guarantee stock cannot be reserved beyond available quantities.
        </p>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', background: 'var(--status-success-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--status-success)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {msg}
        </div>
      )}

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Stock Tracker ({items.length})</h3>
          <button className="btn btn-secondary btn-sm" onClick={fetchInventory}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {items.map(item => (
            <div
              key={item.productId}
              style={{
                padding: '20px',
                background: 'rgba(15, 23, 42, 0.4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item.productId}</span>
                  <span className="badge badge-info">{item.sku}</span>
                </div>

                <div style={{ display: 'flex', gap: '16px', margin: '14px 0' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AVAILABLE</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-success)' }}>
                      {item.availableQuantity}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RESERVED</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-warning)' }}>
                      {item.reservedQuantity}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {item.totalQuantity}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => handleReserveStock(item.productId, 1)}
                  disabled={loading || item.availableQuantity <= 0}
                >
                  <PackageCheck size={14} /> Reserve 1 Unit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
