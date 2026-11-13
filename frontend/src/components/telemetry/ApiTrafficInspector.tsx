import React, { useState } from 'react';
import {
  Activity,
  X,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Code2,
} from 'lucide-react';
import { useApiTrafficStore } from '../../core/api/trafficStore';
import { Badge } from '../ui/Badge/Badge';
import { Button } from '../ui/Button/Button';
import styles from './ApiTrafficInspector.module.css';

export const ApiTrafficInspector: React.FC = () => {
  const {
    records,
    activeRecordId,
    isDrawerOpen,
    connectionMode,
    filter,
    setDrawerOpen,
    toggleDrawer,
    clearRecords,
    setActiveRecordId,
    setConnectionMode,
    setFilter,
  } = useApiTrafficStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'headers' | 'request' | 'response'>('overview');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const activeRecord = records.find((r) => r.id === activeRecordId) || records[0];

  const filteredRecords = records.filter((r) => {
    if (filter.method !== 'all' && r.method.toLowerCase() !== filter.method.toLowerCase()) {
      return false;
    }
    if (filter.statusCategory !== 'all') {
      if (filter.statusCategory === '2xx' && (r.status < 200 || r.status >= 300)) return false;
      if (filter.statusCategory === '4xx' && (r.status < 400 || r.status >= 500)) return false;
      if (filter.statusCategory === '5xx' && r.status < 500) return false;
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return r.url.toLowerCase().includes(q) || r.endpoint.toLowerCase().includes(q) || r.service.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCopyCurl = () => {
    if (!activeRecord) return;
    navigator.clipboard.writeText(activeRecord.curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleCopyResponse = () => {
    if (!activeRecord) return;
    navigator.clipboard.writeText(JSON.stringify(activeRecord.responseBody, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return styles.methodGet;
      case 'POST':
        return styles.methodPost;
      case 'PUT':
      case 'PATCH':
        return styles.methodPut;
      case 'DELETE':
        return styles.methodDelete;
      default:
        return '';
    }
  };

  const getStatusClass = (status: number) => {
    if (status >= 200 && status < 300) return styles.status2xx;
    if (status >= 400 && status < 500) return styles.status4xx;
    if (status >= 500) return styles.status5xx;
    return styles.status0;
  };

  return (
    <>
      {/* Floating Toggle Trigger Button */}
      {!isDrawerOpen && (
        <button
          className={styles.floatingTrigger}
          onClick={toggleDrawer}
          title="Inspect Frontend -> Backend HTTP Communication (http://localhost:4000/api-docs/)"
        >
          <Activity size={15} style={{ color: '#38bdf8' }} />
          <span>API Traffic</span>
          <span className={styles.trafficCounter}>{records.length}</span>
        </button>
      )}

      {/* Main Bottom Drawer */}
      <div className={`${styles.trafficDrawer} ${!isDrawerOpen ? styles.drawerClosed : ''}`}>
        {/* Header Bar */}
        <div className={styles.drawerHeader}>
          <div className={styles.headerTitleGroup}>
            <span className={styles.headerTitle}>
              <Activity size={16} style={{ color: 'var(--color-primary, #3b82f6)' }} />
              API Communication Inspector
            </span>
            <div className={styles.headerBadges}>
              <Badge variant={connectionMode === 'live' ? 'success' : connectionMode === 'auto' ? 'primary' : 'warning'} withDot>
                Mode: {connectionMode.toUpperCase()}
              </Badge>
              <Badge variant="neutral">Target: http://localhost:4000</Badge>
            </div>
          </div>

          <div className={styles.headerActions}>
            <select
              value={connectionMode}
              onChange={(e) => setConnectionMode(e.target.value as any)}
              className={styles.filterSelect}
              title="Toggle API Connection Mode"
            >
              <option value="auto">Auto (Live with Mock Fallback)</option>
              <option value="live">Strict Live Gateway (:4000)</option>
              <option value="mock">Offline Mock Simulator</option>
            </select>

            <a
              href="http://localhost:4000/api-docs/"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: 'var(--color-primary, #3b82f6)',
                textDecoration: 'none',
                fontWeight: 600,
                marginRight: 6,
              }}
            >
              Swagger Docs <ExternalLink size={12} />
            </a>

            <Button
              size="sm"
              variant="outline"
              onClick={clearRecords}
              leftIcon={<Trash2 size={13} />}
              title="Clear Traffic Records"
            >
              Clear
            </Button>

            <button
              onClick={() => setDrawerOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              title="Close Traffic Inspector"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className={styles.drawerBody}>
          {/* Column 1: Request List */}
          <div className={styles.requestListCol}>
            <div className={styles.listFilterBar}>
              <input
                type="text"
                placeholder="Filter by endpoint, service..."
                className={styles.filterInput}
                value={filter.search}
                onChange={(e) => setFilter({ search: e.target.value })}
              />
              <select
                value={filter.method}
                onChange={(e) => setFilter({ method: e.target.value })}
                className={styles.filterSelect}
              >
                <option value="all">ALL</option>
                <option value="get">GET</option>
                <option value="post">POST</option>
                <option value="put">PUT</option>
                <option value="delete">DELETE</option>
              </select>
            </div>

            <ul className={styles.requestList}>
              {filteredRecords.length === 0 ? (
                <li style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)', fontSize: 12 }}>
                  No recorded HTTP traffic yet. Execute a CRUD action or trigger an API request above.
                </li>
              ) : (
                filteredRecords.map((req) => (
                  <li
                    key={req.id}
                    className={`${styles.requestItem} ${activeRecord?.id === req.id ? styles.requestItemActive : ''}`}
                    onClick={() => setActiveRecordId(req.id)}
                  >
                    <div className={styles.itemLeft}>
                      <span className={`${styles.methodBadge} ${getMethodBadgeClass(req.method)}`}>
                        {req.method}
                      </span>
                      <span className={styles.itemEndpoint} title={req.url}>
                        {req.endpoint}
                      </span>
                    </div>

                    <div className={styles.itemRight}>
                      <span className={`${styles.statusPill} ${getStatusClass(req.status)}`}>
                        {req.status === 0 ? 'FAIL' : req.status}
                      </span>
                      <span className={styles.durationText}>{req.durationMs}ms</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Column 2: Selected Request Details */}
          <div className={styles.detailCol}>
            {activeRecord ? (
              <>
                <div className={styles.detailTabs}>
                  <button
                    className={`${styles.tabButton} ${activeTab === 'overview' ? styles.tabButtonActive : ''}`}
                    onClick={() => setActiveTab('overview')}
                  >
                    Overview &amp; cURL
                  </button>
                  <button
                    className={`${styles.tabButton} ${activeTab === 'headers' ? styles.tabButtonActive : ''}`}
                    onClick={() => setActiveTab('headers')}
                  >
                    Headers ({Object.keys(activeRecord.headers).length})
                  </button>
                  {Boolean(activeRecord.requestBody) && (
                    <button
                      className={`${styles.tabButton} ${activeTab === 'request' ? styles.tabButtonActive : ''}`}
                      onClick={() => setActiveTab('request')}
                    >
                      Request Body
                    </button>
                  )}
                  <button
                    className={`${styles.tabButton} ${activeTab === 'response' ? styles.tabButtonActive : ''}`}
                    onClick={() => setActiveTab('response')}
                  >
                    Response Envelope
                  </button>
                </div>

                <div className={styles.tabContent}>
                  {activeTab === 'overview' && (
                    <div>
                      <div className={styles.metaGrid}>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Endpoint URL</span>
                          <span className={styles.metaValue}>{activeRecord.url}</span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>HTTP Status</span>
                          <span className={styles.metaValue}>
                            {activeRecord.status} ({activeRecord.statusText})
                          </span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Duration / Latency</span>
                          <span className={styles.metaValue}>{activeRecord.durationMs} ms</span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Transport Mode</span>
                          <span className={styles.metaValue}>
                            {activeRecord.mode === 'live' ? 'Live HTTP Gateway' : 'Mock Fallback Simulator'}
                          </span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Target Service</span>
                          <span className={styles.metaValue}>{activeRecord.service}</span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Swagger Spec</span>
                          <a
                            href={activeRecord.swaggerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.metaValue}
                            style={{ color: 'var(--color-primary, #3b82f6)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            View in Swagger UI <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>

                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                          Executable cURL Command (Terminal Reproduction)
                        </span>
                      </div>
                      <div className={styles.codeBox}>
                        <button className={styles.copyCodeBtn} onClick={handleCopyCurl}>
                          {copiedCurl ? <Check size={12} /> : <Copy size={12} />}
                          {copiedCurl ? 'Copied' : 'Copy cURL'}
                        </button>
                        {activeRecord.curl}
                      </div>
                    </div>
                  )}

                  {activeTab === 'headers' && (
                    <div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                            <th style={{ padding: '6px 8px', color: 'var(--color-text-secondary)' }}>Header Key</th>
                            <th style={{ padding: '6px 8px', color: 'var(--color-text-secondary)' }}>Value Sent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(activeRecord.headers).map(([key, val]) => (
                            <tr key={key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 600, fontFamily: 'monospace' }}>{key}</td>
                              <td style={{ padding: '6px 8px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                {key.toLowerCase() === 'authorization' ? `${val.substring(0, 20)}…` : val}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'request' && (
                    <div className={styles.codeBox}>
                      {JSON.stringify(activeRecord.requestBody, null, 2)}
                    </div>
                  )}

                  {activeTab === 'response' && (
                    <div className={styles.codeBox}>
                      <button className={styles.copyCodeBtn} onClick={handleCopyResponse}>
                        {copiedResponse ? <Check size={12} /> : <Copy size={12} />}
                        {copiedResponse ? 'Copied' : 'Copy JSON'}
                      </button>
                      {activeRecord.responseBody
                        ? JSON.stringify(activeRecord.responseBody, null, 2)
                        : activeRecord.error
                        ? String(activeRecord.error)
                        : 'No response body recorded.'}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.emptySelection}>
                <Code2 size={36} />
                <p>Select a recorded HTTP request from the list to inspect headers, payload and response</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
