import React, { useEffect, useState } from 'react';
import { OrderDto, OrderStatus, InitiatePaymentResponseDto } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { useAuth } from '../../../shared/hooks/useAuth.js';
import { ShoppingCart, Package, CreditCard, XCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react';

const CATALOG_ITEMS = [
  { productId: 'PROD-001', productName: 'MacBook Pro M3 Max 64GB', unitPrice: 3499.00 },
  { productId: 'PROD-002', productName: '4K UltraSharp 32" Curved Display', unitPrice: 899.00 },
  { productId: 'PROD-003', productName: 'Ergonomic Split Mechanical Keyboard', unitPrice: 289.00 },
  { productId: 'PROD-004', productName: 'Precision Wireless Laser Mouse', unitPrice: 99.00 }
];

export const OrderView: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({
    'PROD-001': 1,
    'PROD-003': 1
  });
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!isAuthenticated) return;
    const res = await apiClient.get<OrderDto[]>('/api/orders/my');
    if (res.success && res.data) {
      setOrders(res.data);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Check if returning from a Payment Gateway Redirect
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status') || urlParams.get('status');
    const txnId = urlParams.get('transactionId');

    if (paymentStatus === 'success') {
      setActionMessage(`Gateway Redirection Succeeded! Transaction ${txnId ? '#' + txnId.substring(0, 8) : ''} verified. Order status updated via asynchronous webhook.`);
      // Clear URL params without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      setActionMessage('Payment was cancelled on the payment gateway provider page.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [isAuthenticated]);

  const handleQuantityChange = (productId: string, qty: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: Math.max(0, qty)
    }));
  };

  const calculateTotal = () => {
    return CATALOG_ITEMS.reduce((sum, item) => {
      const qty = selectedItems[item.productId] || 0;
      return sum + qty * item.unitPrice;
    }, 0);
  };

  const handleCreateOrder = async () => {
    if (!isAuthenticated) {
      alert('Please authenticate in the IAM tab first.');
      return;
    }

    const itemsToOrder = CATALOG_ITEMS
      .filter(item => (selectedItems[item.productId] || 0) > 0)
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: selectedItems[item.productId]!,
        unitPrice: item.unitPrice
      }));

    if (itemsToOrder.length === 0) {
      alert('Please select at least one item');
      return;
    }

    setLoading(true);
    const res = await apiClient.post<OrderDto>('/api/orders', {
      items: itemsToOrder,
      currency: 'USD'
    });

    if (res.success) {
      setActionMessage(`Order #${res.data!.id.substring(0, 8)} created successfully! Event dispatched.`);
      await fetchOrders();
    } else {
      alert(res.error?.message || 'Failed to place order');
    }
    setLoading(false);
  };

  // 1. Hosted Payment Gateway Redirection Flow (Stripe Checkout / PayPal / Razorpay / Simulator)
  const handleHostedPayOrder = async (order: OrderDto) => {
    setLoading(true);
    setActionMessage('Initiating checkout session with configured payment gateway...');

    const res = await apiClient.post<InitiatePaymentResponseDto>('/api/transactions/initiate', {
      referenceId: order.id,
      amount: order.totalAmount,
      currency: order.currency,
      returnUrl: window.location.origin + '?status=success&orderId=' + order.id,
      cancelUrl: window.location.origin + '?status=cancelled&orderId=' + order.id
    });

    if (res.success && res.data?.redirectUrl) {
      setActionMessage(`Redirecting to ${res.data.provider} hosted payment checkout...`);
      // Redirect browser to the provider's payment page
      window.location.href = res.data.redirectUrl;
    } else {
      alert(res.error?.message || 'Failed to initiate payment gateway session');
      setLoading(false);
    }
  };

  // 2. Direct S2S Charge
  const handleDirectPayOrder = async (order: OrderDto) => {
    setLoading(true);
    const res = await apiClient.post('/api/transactions/pay', {
      referenceId: order.id,
      amount: order.totalAmount,
      currency: order.currency,
      paymentMethod: 'CREDIT_CARD'
    });

    if (res.success) {
      setActionMessage(`Payment completed! Transaction event updated Order #${order.id.substring(0, 8)} to PAID.`);
      setTimeout(fetchOrders, 300);
    } else {
      alert('Payment processing failed');
    }
    setLoading(false);
  };

  const handleCancelOrder = async (orderId: string) => {
    setLoading(true);
    const res = await apiClient.post(`/api/orders/${orderId}/cancel`);
    if (res.success) {
      setActionMessage(`Order #${orderId.substring(0, 8)} cancelled.`);
      await fetchOrders();
    } else {
      alert(res.error?.message || 'Failed to cancel order');
    }
    setLoading(false);
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PAID': return <span className="badge badge-success"><CheckCircle size={12} /> PAID</span>;
      case 'PENDING': return <span className="badge badge-warning"><Clock size={12} /> PENDING</span>;
      case 'CONFIRMED': return <span className="badge badge-info"><Package size={12} /> CONFIRMED</span>;
      case 'CANCELLED': return <span className="badge badge-error"><XCircle size={12} /> CANCELLED</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {actionMessage && (
        <div style={{ padding: '12px 16px', background: 'var(--status-success-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--status-success)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {actionMessage}
        </div>
      )}

      {/* Catalog & Checkout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Catalog */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <ShoppingCart size={22} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Hardware Catalog</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {CATALOG_ITEMS.map(item => (
              <div
                key={item.productId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.productName}</div>
                  <div style={{ color: 'var(--brand-accent)', fontSize: '0.8rem', fontWeight: 700 }}>
                    ${item.unitPrice.toFixed(2)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleQuantityChange(item.productId, (selectedItems[item.productId] || 0) - 1)}
                  >
                    -
                  </button>
                  <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 700, fontSize: '0.875rem' }}>
                    {selectedItems[item.productId] || 0}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleQuantityChange(item.productId, (selectedItems[item.productId] || 0) + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Order Total</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ${calculateTotal().toFixed(2)}
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleCreateOrder} disabled={loading || calculateTotal() === 0}>
              <Package size={16} /> Place Order
            </button>
          </div>
        </div>

        {/* Order Lifecycle Information */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>Order State Machine & Boundaries</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
            The Order module owns order invariants, line items, and lifecycle states. It interfaces with:
          </p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            <li>• <strong>Transaction Module</strong>: Triggers payment settlement and consumes <code>transactions.completed</code> events to transition to <code>PAID</code>.</li>
            <li>• <strong>Search Module</strong>: Automatically projects order metadata into search indices via <code>orders.order_created</code> events.</li>
            <li>• <strong>Notification Module</strong>: Automatically queues an order confirmation email asynchronously upon creation.</li>
          </ul>
        </div>
      </div>

      {/* Orders List */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>My Orders ({orders.length})</h3>
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No orders found. Add items from the catalog above and click "Place Order"!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orders.map(order => (
              <div
                key={order.id}
                style={{
                  padding: '16px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                      #{order.id.substring(0, 8)}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {order.items.length} items • Total: <strong>${order.totalAmount.toFixed(2)} {order.currency}</strong> • Placed on {new Date(order.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {order.status === 'PENDING' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => handleHostedPayOrder(order)} disabled={loading} title="Redirect to active payment gateway checkout">
                        <ExternalLink size={14} /> Pay via Gateway (Redirect)
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleDirectPayOrder(order)} disabled={loading} title="Direct charge API">
                        <CreditCard size={14} /> Direct S2S Pay
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleCancelOrder(order.id)} disabled={loading}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
