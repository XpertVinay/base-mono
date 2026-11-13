import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  Activity,
  BellRing,
  Monitor,
  RefreshCw,
  Server
} from 'lucide-react';
import './styles/audit-mfe.css';
import { AuditLogItem, AlertIncident, MetricsSummary, RemediationPayload } from './types.js';
import { resolveAuditBaseUrl, resolveGrafanaUrl } from './config.js';
import { auditApi } from './services/auditApi.js';
import { EmergencyBanner } from './components/EmergencyBanner.js';
import { KpiMetricsRow } from './components/KpiMetricsRow.js';
import { AuditLogExplorer } from './components/AuditLogExplorer.js';
import { DrawerInspection } from './components/DrawerInspection.js';
import { PrometheusTelemetryTab } from './components/PrometheusTelemetryTab.js';
import { GrafanaDashboardTab } from './components/GrafanaDashboardTab.js';
import { AlertCenterTab } from './components/AlertCenterTab.js';

export interface AuditMonitoringAppProps {
  standalone?: boolean;
  tenantId?: string;
  authToken?: string;
  gatewayUrl?: string;
  apiBaseUrl?: string;
  endpoint?: string;
  grafanaUrl?: string;
  prometheusUrl?: string;
}

export const AuditMonitoringApp: React.FC<AuditMonitoringAppProps> = ({
  standalone: _standalone = true,
  tenantId = 'default',
  authToken,
  gatewayUrl,
  apiBaseUrl,
  endpoint,
  grafanaUrl,
  prometheusUrl: _prometheusUrl
}) => {
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'PROMETHEUS' | 'GRAFANA' | 'ALERTS'>('AUDIT');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [alerts, setAlerts] = useState<AlertIncident[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummary>({
    totalEvents: 148,
    errorCount: 3,
    criticalCount: 2,
    riskScore: 28,
    remediationCount: 16,
    systemHealthPct: 99.4
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  const [inspectedLog, setInspectedLog] = useState<AuditLogItem | null>(null);

  const resolvedBaseUrl = useMemo(
    () => resolveAuditBaseUrl({ gatewayUrl, apiBaseUrl, endpoint }),
    [gatewayUrl, apiBaseUrl, endpoint]
  );

  const resolvedGrafanaUrl = useMemo(
    () => resolveGrafanaUrl(grafanaUrl),
    [grafanaUrl]
  );

  // Configure API client base URL, tenant, and auth token unifiedly
  useEffect(() => {
    auditApi.setBaseUrl(resolvedBaseUrl);
    auditApi.setTenantId(tenantId);
    auditApi.setAuthToken(authToken);
  }, [resolvedBaseUrl, tenantId, authToken]);

  // Load initial data
  const loadData = useCallback(async () => {
    auditApi.setBaseUrl(resolvedBaseUrl);
    auditApi.setTenantId(tenantId);
    auditApi.setAuthToken(authToken);
    setIsLoading(true);
    try {
      const [fetchedLogs, fetchedMetrics, fetchedAlerts] = await Promise.all([
        auditApi.getLogs({ limit: 50 }),
        auditApi.getMetricsSummary(),
        auditApi.getAlerts()
      ]);
      setLogs(fetchedLogs);
      setMetrics(fetchedMetrics);
      setAlerts(fetchedAlerts);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedBaseUrl, tenantId, authToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time stream effect
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(async () => {
      try {
        const [latestLogs, latestMetrics, latestAlerts] = await Promise.all([
          auditApi.getLogs({ limit: 50 }),
          auditApi.getMetricsSummary(),
          auditApi.getAlerts()
        ]);
        setLogs(latestLogs);
        setMetrics(latestMetrics);
        setAlerts(latestAlerts);
      } catch {
        // Continue streaming without breaking UI
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [isStreaming]);

  // Remediation action dispatcher
  const handleRemediate = async (payload: RemediationPayload) => {
    await auditApi.executeRemediation(payload);
    // Refresh state after remediation
    await loadData();
  };

  const criticalAlert = alerts.find(a => a.severity === 'CRITICAL' && a.status === 'FIRING');

  return (
    <div className="audit-mfe-root" id="mfe-audit-monitoring-container">
      {/* Top Header */}
      <header className="amfe-header">
        <div className="amfe-header-brand">
          <div className="amfe-brand-badge">
            <ShieldAlert size={24} style={{ color: '#ffffff' }} />
          </div>
          <div>
            <h1 className="amfe-title">
              Audit Trails & Observability Shield
            </h1>
            <p className="amfe-subtitle">
              Prometheus & Grafana Telemetry • Real-Time Customer Protection • Tenant: <strong style={{ color: '#ffffff' }}>{tenantId}</strong>
            </p>
          </div>
        </div>

        <div className="amfe-header-actions">
          <div className="amfe-status-indicator">
            <span className="amfe-pulse-dot" />
            <span>Observability Live</span>
          </div>

          <button
            id="btn-global-refresh"
            className="amfe-btn"
            onClick={loadData}
            disabled={isLoading}
            title="Refresh All Micro-Frontend Data"
          >
            <RefreshCw size={14} className={isLoading ? 'amfe-pulse-dot' : ''} />
            <span>Sync Live</span>
          </button>
        </div>
      </header>

      {/* Emergency Alert Banner (Shown when Critical Issue is Active) */}
      <EmergencyBanner
        criticalAlert={criticalAlert}
        onRemediate={() => {
          setActiveTab('ALERTS');
        }}
      />

      {/* Real-time KPI Metric Row */}
      <KpiMetricsRow metrics={metrics} />

      {/* Tab Navigation */}
      <nav className="amfe-nav-tabs" aria-label="Observability Views">
        <button
          id="tab-audit-logs"
          className={`amfe-tab-btn ${activeTab === 'AUDIT' ? 'active' : ''}`}
          onClick={() => setActiveTab('AUDIT')}
        >
          <Activity size={16} />
          <span>Audit Logs & Traces</span>
          <span className="amfe-tab-badge" style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
            {logs.length}
          </span>
        </button>

        <button
          id="tab-prometheus-metrics"
          className={`amfe-tab-btn ${activeTab === 'PROMETHEUS' ? 'active' : ''}`}
          onClick={() => setActiveTab('PROMETHEUS')}
        >
          <Server size={16} />
          <span>Prometheus Telemetry</span>
        </button>

        <button
          id="tab-grafana-dashboards"
          className={`amfe-tab-btn ${activeTab === 'GRAFANA' ? 'active' : ''}`}
          onClick={() => setActiveTab('GRAFANA')}
        >
          <Monitor size={16} />
          <span>Grafana Visualizer</span>
        </button>

        <button
          id="tab-incident-alerts"
          className={`amfe-tab-btn ${activeTab === 'ALERTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALERTS')}
        >
          <BellRing size={16} />
          <span>Incident Prevention & Alerts</span>
          {alerts.filter(a => a.status === 'FIRING').length > 0 && (
            <span className="amfe-tab-badge">
              {alerts.filter(a => a.status === 'FIRING').length}
            </span>
          )}
        </button>
      </nav>

      {/* Active Tab View */}
      <main style={{ marginTop: '0.25rem' }}>
        {activeTab === 'AUDIT' && (
          <AuditLogExplorer
            logs={logs}
            isLoading={isLoading}
            onRefresh={loadData}
            onSelectLog={setInspectedLog}
            isStreaming={isStreaming}
            onToggleStreaming={() => setIsStreaming(!isStreaming)}
          />
        )}

        {activeTab === 'PROMETHEUS' && (
          <PrometheusTelemetryTab metrics={metrics} />
        )}

        {activeTab === 'GRAFANA' && (
          <GrafanaDashboardTab
            grafanaUrl={resolvedGrafanaUrl}
            metrics={metrics}
          />
        )}

        {activeTab === 'ALERTS' && (
          <AlertCenterTab
            alerts={alerts}
            onRemediate={handleRemediate}
          />
        )}
      </main>

      {/* Slide-over Log Inspection & Remediation Drawer */}
      <DrawerInspection
        log={inspectedLog}
        onClose={() => setInspectedLog(null)}
        onRemediate={handleRemediate}
      />
    </div>
  );
};

export default AuditMonitoringApp;
