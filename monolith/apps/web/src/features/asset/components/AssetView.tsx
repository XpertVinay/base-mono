import React, { useEffect, useState } from 'react';
import { AssetDto } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { useAuth } from '../../../shared/hooks/useAuth.js';
import { FileBox, UploadCloud } from 'lucide-react';

export const AssetView: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [assets, setAssets] = useState<AssetDto[]>([]);
  const [name, setName] = useState('');
  const [mimeType, setMimeType] = useState('application/pdf');
  const sizeBytes = 1048576;
  const [storagePath, setStoragePath] = useState('/storage/uploads/architecture-spec.pdf');
  const [loading, setLoading] = useState(false);

  const fetchAssets = async () => {
    if (!isAuthenticated) return;
    const res = await apiClient.get<AssetDto[]>('/api/assets/my');
    if (res.success && res.data) {
      setAssets(res.data);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [isAuthenticated]);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please authenticate in IAM tab first');
      return;
    }
    setLoading(true);
    const res = await apiClient.post<AssetDto>('/api/assets', {
      name,
      mimeType,
      sizeBytes,
      storagePath
    });
    if (res.success) {
      setName('');
      await fetchAssets();
    } else {
      alert(res.error?.message || 'Failed to create asset');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
      {/* Registered Assets */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <FileBox size={20} color="var(--brand-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Asset Vault ({assets.length})</h3>
        </div>

        {assets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            No assets registered for your user. Use the form on the right to register asset metadata!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {assets.map(a => (
              <div
                key={a.id}
                style={{
                  padding: '14px',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{a.name}</div>
                  <span className="badge badge-info">{a.mimeType}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {a.storagePath} • {(a.sizeBytes / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register Asset Form */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Register New Asset Metadata</h3>
        <form onSubmit={handleCreateAsset} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Asset Name
            </label>
            <input
              type="text"
              required
              placeholder="Enterprise-System-Architecture.pdf"
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              MIME Type
            </label>
            <input
              type="text"
              required
              className="input-field"
              value={mimeType}
              onChange={e => setMimeType(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Storage Path
            </label>
            <input
              type="text"
              required
              className="input-field"
              value={storagePath}
              onChange={e => setStoragePath(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading || !name}>
            <UploadCloud size={16} /> Register Asset
          </button>
        </form>
      </div>
    </div>
  );
};
