import React, { useEffect, useState } from 'react';
import { TransactionDto, PaymentGatewaysResponseDto } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { useAuth } from '../../../shared/hooks/useAuth.js';
import { CreditCard, Zap, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

const GATEWAY_DESCRIPTIONS: Record<string, { title: string; desc: string; color: string; badgeBg: string }> = {
  STRIPE: {
    title: 'Stripe Payment Gateway Adapter',
    desc: 'Production-ready PaymentIntents & Cards integration with SCA/3DS compliance.',
    color: '#635BFF',
    badgeBg: 'rgba(99, 91, 255, 0.15)'
  },
  PAYPAL: {
    title: 'PayPal Orders v2 Adapter',
    desc: 'Global e-wallet & digital wallet processing via PayPal REST API v2.',
    color: '#0070BA',
    badgeBg: 'rgba(0, 112, 186, 0.15)'
  },
  RAZORPAY: {
    title: 'Razorpay Orders & Payments Adapter',
    desc: 'High-speed payment processing supporting Cards, NetBanking, and UPI.',
    color: '#0C2340',
    badgeBg: 'rgba(51, 147, 245, 0.15)'
  },
  MOCK: {
    title: 'Simulated Sandbox Adapter',
    desc: 'In-memory test provider with deterministic mock transactions and zero latency.',
    color: '#10B981',
    badgeBg: 'rgba(16, 185, 129, 0.15)'
  }
};

export const TransactionView: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [gatewayData, setGatewayData] = useState<PaymentGatewaysResponseDto | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = async () => {
    if (!isAuthenticated) return;
    const res = await apiClient.get<TransactionDto[]>('/api/transactions/my');
    if (res.success && res.data) {
      setTransactions(res.data);
    }
  };

  const fetchGateways = async () => {
    if (!isAuthenticated) return;
    const res = await apiClient.get<PaymentGatewaysResponseDto>('/api/transactions/gateways');
    if (res.success && res.data) {
      setGatewayData(res.data);
    }
  };

  const reloadData = async () => {
    setRefreshing(true);
    await Promise.all([fetchTransactions(), fetchGateways()]);
    setRefreshing(false);
  };

  useEffect(() => {
    reloadData();
  }, [isAuthenticated]);

  const activeProvider = (gatewayData?.activeGateway || 'STRIPE').toUpperCase();
  const providerMeta = GATEWAY_DESCRIPTIONS[activeProvider] ?? GATEWAY_DESCRIPTIONS['MOCK']!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <CreditCard size={22} color="var(--brand-primary)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Financial Ledger & Payment Adapters</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Isolated financial records with pluggable adapter-based payment gateways dynamically switchable via database flag configuration.
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={reloadData}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh Gateway & Ledger
          </button>
        </div>
      </div>

      {/* Active Gateway Card */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          borderLeft: `4px solid ${providerMeta.color}`,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Zap size={18} color="var(--brand-accent)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                DYNAMIC OUTBOUND PORT ADAPTER
              </span>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {providerMeta.title}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '650px' }}>
              {providerMeta.desc}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#fff',
                backgroundColor: providerMeta.color,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={14} /> ACTIVE: {activeProvider}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Configured via DB flag: <code style={{ color: 'var(--brand-accent)' }}>ACTIVE_PAYMENT_GATEWAY</code>
            </span>
          </div>
        </div>

        {/* Supported Gateways Bar */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            <ShieldCheck size={16} color="var(--status-success)" />
            <span>Available Gateway Adapters in Monolith:</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(gatewayData?.availableGateways || ['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK']).map(gw => {
              const isActive = gw === activeProvider;
              return (
                <span
                  key={gw}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${isActive ? 'var(--brand-primary)' : 'var(--border-color)'}`,
                    background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.4)',
                    color: isActive ? 'var(--brand-accent)' : 'var(--text-muted)'
                  }}
                >
                  {gw} {isActive ? '• Active' : ''}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transaction Records */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
          Transaction Records ({transactions.length})
        </h3>

        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            No transactions found. Place an order in the Orders tab and pay for it to record ledger entries!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {transactions.map(t => (
              <div
                key={t.id}
                style={{
                  padding: '16px',
                  background: 'rgba(15, 23, 42, 0.4)',
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
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      TXN #{t.id.substring(0, 8)}
                    </span>
                    <span className="badge badge-success">{t.status}</span>
                    <span className="badge badge-info">{t.paymentMethod}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Ref Order: #{t.referenceId.substring(0, 8)} • Settled: {new Date(t.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--status-success)' }}>
                    +${t.amount.toFixed(2)} {t.currency}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SETTLED VIA {activeProvider}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
