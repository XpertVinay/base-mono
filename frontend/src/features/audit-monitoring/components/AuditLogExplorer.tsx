import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Play,
  Pause,
  Download,
  Eye,
  RefreshCw
} from 'lucide-react';
import { AuditLogItem } from '../types.js';

interface AuditLogExplorerProps {
  logs: AuditLogItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectLog: (log: AuditLogItem) => void;
  isStreaming: boolean;
  onToggleStreaming: () => void;
}

export const AuditLogExplorer: React.FC<AuditLogExplorerProps> = ({
  logs,
  isLoading,
  onRefresh,
  onSelectLog,
  isStreaming,
  onToggleStreaming
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [resourceFilter, setResourceFilter] = useState('ALL');

  // Extract unique resources
  const uniqueResources = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.resource) set.add(l.resource);
    });
    return Array.from(set);
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (severityFilter !== 'ALL' && log.severity !== severityFilter) return false;
      if (resourceFilter !== 'ALL' && log.resource !== resourceFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesResource = log.resource.toLowerCase().includes(q);
        const matchesActor = log.actorEmail?.toLowerCase().includes(q) || false;
        const matchesCorr = log.correlationId?.toLowerCase().includes(q) || false;
        if (!matchesAction && !matchesResource && !matchesActor && !matchesCorr) return false;
      }
      return true;
    });
  }, [logs, severityFilter, resourceFilter, searchTerm]);

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit_trail_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'amfe-badge amfe-badge-critical';
      case 'ERROR': return 'amfe-badge amfe-badge-error';
      case 'WARN': return 'amfe-badge amfe-badge-warn';
      default: return 'amfe-badge amfe-badge-info';
    }
  };

  return (
    <div className="amfe-glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Control Toolbar */}
      <div className="amfe-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div className="amfe-search-box">
            <Search size={16} style={{ color: 'var(--amfe-text-muted)' }} />
            <input
              id="input-audit-search"
              type="text"
              placeholder="Search by action, resource, actor, or trace ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="amfe-search-input"
            />
          </div>

          {/* Severity Filter */}
          <div className="amfe-filter-group">
            <Filter size={15} style={{ color: 'var(--amfe-text-muted)' }} />
            <select
              id="select-audit-severity"
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="amfe-select"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="ERROR">Error</option>
              <option value="WARN">Warning</option>
              <option value="INFO">Info</option>
            </select>

            {/* Resource Filter */}
            <select
              id="select-audit-resource"
              value={resourceFilter}
              onChange={e => setResourceFilter(e.target.value)}
              className="amfe-select"
            >
              <option value="ALL">All Services</option>
              {uniqueResources.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            id="btn-stream-toggle"
            className="amfe-btn"
            onClick={onToggleStreaming}
            title={isStreaming ? 'Pause live ingestion' : 'Resume live ingestion'}
          >
            {isStreaming ? (
              <>
                <Pause size={14} style={{ color: '#f59e0b' }} />
                <span>Streaming (Live)</span>
              </>
            ) : (
              <>
                <Play size={14} style={{ color: '#10b981' }} />
                <span>Stream Paused</span>
              </>
            )}
          </button>

          <button
            id="btn-audit-refresh"
            className="amfe-btn"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh logs from server"
          >
            <RefreshCw size={14} className={isLoading ? 'amfe-pulse-dot' : ''} />
            <span>Sync</span>
          </button>

          <button
            id="btn-audit-export"
            className="amfe-btn"
            onClick={handleExportJson}
            title="Export filtered logs to JSON"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="amfe-table-wrap">
        <table className="amfe-table" id="table-audit-logs">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Action & Resource</th>
              <th>Actor</th>
              <th>Trace ID</th>
              <th>Timestamp</th>
              <th style={{ textAlign: 'right' }}>Inspect</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--amfe-text-muted)' }}>
                  No audit logs matching current query parameters.
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => (
                <tr
                  key={log.id}
                  onClick={() => onSelectLog(log)}
                  style={{ cursor: 'pointer' }}
                  className="amfe-log-row"
                >
                  {/* Severity */}
                  <td>
                    <span className={getSeverityBadgeClass(log.severity)}>
                      {log.severity}
                    </span>
                  </td>

                  {/* Action & Resource */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: '#ffffff' }}>
                        {log.action}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#93c5fd' }}>
                        {log.resource} {log.resourceId ? `(${log.resourceId})` : ''}
                      </span>
                    </div>
                  </td>

                  {/* Actor */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#e2e8f0' }}>{log.actorEmail || 'System'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--amfe-text-dim)' }}>
                        {log.ipAddress || 'Internal'}
                      </span>
                    </div>
                  </td>

                  {/* Trace ID */}
                  <td>
                    {log.correlationId ? (
                      <span
                        className="amfe-corr-id amfe-mono"
                        onClick={e => {
                          e.stopPropagation();
                          setSearchTerm(log.correlationId || '');
                        }}
                        title="Click to filter by this correlation ID"
                      >
                        {log.correlationId.slice(0, 16)}...
                      </span>
                    ) : (
                      <span style={{ color: 'var(--amfe-text-dim)' }}>—</span>
                    )}
                  </td>

                  {/* Time */}
                  <td style={{ color: 'var(--amfe-text-muted)', fontSize: '0.75rem' }}>
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="amfe-btn"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={e => {
                        e.stopPropagation();
                        onSelectLog(log);
                      }}
                    >
                      <Eye size={13} />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
