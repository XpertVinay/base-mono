import React, { useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth.js';
import { UserRole } from '@monolith/contracts';
import { Key, Shield, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

export const IamView: React.FC = () => {
  const { user, token, isAuthenticated, login, register, logout } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('USER');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setLoading(true);

    if (isRegister) {
      const res = await register({ email, password, name, role });
      if (res.success) {
        setStatusMessage({ text: 'Account registered and authenticated successfully!', isError: false });
      } else {
        setStatusMessage({ text: res.error || 'Registration failed', isError: true });
      }
    } else {
      const res = await login({ email, password });
      if (res.success) {
        setStatusMessage({ text: 'Logged in successfully!', isError: false });
      } else {
        setStatusMessage({ text: res.error || 'Authentication failed', isError: true });
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
      {/* Auth Form / State Card */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Shield size={24} color="var(--brand-primary)" />
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>IAM Authentication & RBAC</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
              JWT Bearer tokens, password salting, deny-by-default role guards.
            </p>
          </div>
        </div>

        {statusMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.875rem',
              background: statusMessage.isError ? 'var(--status-error-bg)' : 'var(--status-success-bg)',
              color: statusMessage.isError ? 'var(--status-error)' : 'var(--status-success)',
              border: `1px solid ${statusMessage.isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
            }}
          >
            {statusMessage.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {statusMessage.text}
          </div>
        )}

        {isAuthenticated ? (
          <div>
            <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {user?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{user?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="badge badge-info">ROLE: {user?.role}</span>
                <span className="badge badge-success">ACTIVE SESSION</span>
              </div>
            </div>

            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={logout}>
              <LogOut size={16} /> End Session (Logout)
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegister && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    placeholder="Ada Lovelace"
                    className="input-field"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="developer@platform.local"
                className="input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="••••••••••••"
                className="input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {isRegister && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Access Role
                </label>
                <select
                  className="input-field"
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  style={{ background: '#0f172a' }}
                >
                  <option value="USER">Standard User (USER)</option>
                  <option value="ADMIN">System Administrator (ADMIN)</option>
                  <option value="AUDITOR">Compliance Auditor (AUDITOR)</option>
                </select>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
              <Key size={16} /> {isRegister ? 'Register & Authenticate' : 'Authenticate Session'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                style={{ background: 'none', border: 'none', color: 'var(--brand-accent)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Security Architecture Details Card */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>IAM Boundary & Security Controls</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
          In alignment with <strong>AGENTS.md §5</strong>, the IAM module is strictly autonomous:
        </p>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <CheckCircle2 size={16} color="var(--status-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span><strong>No shared user repository</strong>: External modules consume identity contracts (<code>UserDto</code>) rather than direct table access.</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <CheckCircle2 size={16} color="var(--status-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span><strong>Decoupled Events</strong>: Emits <code>iam.user_registered</code> events consumed asynchronously by the Notification and Search modules.</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <CheckCircle2 size={16} color="var(--status-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span><strong>OWASP 2025</strong>: Argon2/Bcrypt hash salting, strict session token validation, and resource-level authorization boundaries.</span>
          </li>
        </ul>

        {token && (
          <div style={{ marginTop: '24px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Current JWT Token
            </label>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                background: 'rgba(0,0,0,0.4)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                overflowWrap: 'break-word',
                marginTop: '6px',
                color: 'var(--brand-accent)'
              }}
            >
              {token}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
