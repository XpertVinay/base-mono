import React, { useEffect, useState } from 'react';
import { NotificationDto } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { useAuth } from '../../../shared/hooks/useAuth.js';
import { Bell, Send, CheckCheck, RefreshCw } from 'lucide-react';

export const NotificationView: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [recipient, setRecipient] = useState(user?.email || 'dev@monolith.local');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    const res = await apiClient.get<NotificationDto[]>('/api/notifications');
    if (res.success && res.data) {
      setNotifications(res.data);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [isAuthenticated]);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await apiClient.post<NotificationDto>('/api/notifications', {
      recipient,
      channel: 'EMAIL',
      subject,
      body
    });
    if (res.success) {
      setSubject('');
      setBody('');
      await fetchNotifications();
    } else {
      alert(res.error?.message || 'Failed to dispatch notification');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
      {/* Sent Notifications Stream */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Notification Inbox ({notifications.length})</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchNotifications}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', marginBottom: '16px' }}>
          Notifications dispatched automatically by domain event subscribers (e.g. user welcome emails, order confirmations).
        </p>

        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            No notifications recorded yet. Register an account or place an order to trigger automated notifications!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notifications.map(n => (
              <div
                key={n.id}
                style={{
                  padding: '14px',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{n.subject}</div>
                  <span className="badge badge-success"><CheckCheck size={12} /> {n.status}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  {n.body}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  To: <code>{n.recipient}</code> • Channel: {n.channel} • {new Date(n.createdAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Notification Tester */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Send Test Notification</h3>
        <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Recipient Address
            </label>
            <input
              type="text"
              required
              className="input-field"
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Subject
            </label>
            <input
              type="text"
              required
              placeholder="Security Alert / System Notice"
              className="input-field"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Message Body
            </label>
            <textarea
              required
              rows={3}
              placeholder="Your transaction has been confirmed..."
              className="input-field"
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
            <Send size={16} /> Dispatch Notification
          </button>
        </form>
      </div>
    </div>
  );
};
