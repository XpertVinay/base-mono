import React, { useState } from 'react';
import { SearchResultItemDto } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { Search } from 'lucide-react';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string>('');
  const [results, setResults] = useState<SearchResultItemDto[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setHasSearched(true);

    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (type) params.append('type', type);

    const res = await apiClient.get<SearchResultItemDto[]>(`/api/search?${params.toString()}`);
    if (res.success && res.data) {
      setResults(res.data);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Search size={22} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Global Event-Projected Search</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
          The Search module maintains dedicated read models projected asynchronously via domain integration events from IAM and Orders.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Search across orders, users, and metadata..."
              className="input-field"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            value={type}
            onChange={e => setType(e.target.value)}
            style={{ width: 'auto', minWidth: '160px', background: '#0f172a' }}
          >
            <option value="">All Document Types</option>
            <option value="ORDER">Orders Only</option>
            <option value="USER">Users Only</option>
          </select>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={16} /> Search Index
          </button>
        </form>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
          Search Results ({results.length})
        </h3>

        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            {hasSearched ? 'No documents matched your query.' : 'Type a query above or click "Search Index" to inspect the projected index.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {results.map(r => (
              <div
                key={r.id}
                style={{
                  padding: '16px',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.title}</div>
                  <span className="badge badge-info">{r.type}</span>
                </div>
                {r.description && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>
                    {r.description}
                  </div>
                )}
                {r.metadata && (
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--brand-accent)', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px' }}>
                    {JSON.stringify(r.metadata)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
