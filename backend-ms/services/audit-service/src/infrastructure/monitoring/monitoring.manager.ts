import { IMonitoringAdapter } from './monitoring-adapters.interface.js';
import { CloudWatchMonitoringAdapter } from './cloudwatch.adapter.js';
import { PrometheusMonitoringAdapter } from './prometheus.adapter.js';
import { GrafanaMonitoringAdapter } from './grafana.adapter.js';
import { AuditLog } from '../../domain/entities/audit-log.entity.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface SecurityIncidentAlert {
  id: string;
  title: string;
  service: string;
  severity: 'WARN' | 'CRITICAL';
  status: 'FIRING' | 'RESOLVED';
  customerImpact: string;
  suggestedAction: string;
  triggeredAt: string;
  sourceIp?: string;
}

export class MonitoringManager {
  private adapters: IMonitoringAdapter[] = [];
  private securityIncidents: SecurityIncidentAlert[] = [];
  public readonly prometheusAdapter: PrometheusMonitoringAdapter;
  public readonly grafanaAdapter: GrafanaMonitoringAdapter;
  public readonly cloudwatchAdapter: CloudWatchMonitoringAdapter;

  constructor() {
    this.cloudwatchAdapter = new CloudWatchMonitoringAdapter();
    this.prometheusAdapter = new PrometheusMonitoringAdapter();
    this.grafanaAdapter = new GrafanaMonitoringAdapter();

    this.adapters = [
      this.cloudwatchAdapter,
      this.prometheusAdapter,
      this.grafanaAdapter
    ];
  }

  async init(): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.init();
    }
  }

  async broadcastAuditLog(log: AuditLog): Promise<void> {
    if (
      log.severity === 'CRITICAL' ||
      /DDOS|RATE_LIMIT|BRUTE_FORCE|ATTACK|PROBE|UNAUTHORIZED_FLOOD/i.test(log.action)
    ) {
      this.prometheusAdapter.recordSecurityAttack(log.action, log.resource);
      this.recordSecurityIncident({
        id: `sec-${log.id}`,
        title: `Security Anomaly: ${log.action}`,
        service: log.resource,
        severity: log.severity === 'CRITICAL' ? 'CRITICAL' : 'WARN',
        status: 'FIRING',
        customerImpact: `Detected ${log.action} targeting ${log.resource}${log.ipAddress ? ` from IP ${log.ipAddress}` : ''}`,
        suggestedAction: 'BLOCK_ACTOR_IP',
        triggeredAt: log.createdAt.toISOString(),
        sourceIp: log.ipAddress
      });
    }

    await Promise.all(
      this.adapters.map(async (adapter) => {
        if (!adapter.isEnabled) return;
        try {
          await adapter.exportAuditLog(log);
        } catch (err) {
          logger.error(`Failed to export audit log to ${adapter.adapterName}`, err);
        }
      })
    );
  }

  recordSecurityIncident(incident: SecurityIncidentAlert): void {
    this.securityIncidents.unshift(incident);
    if (this.securityIncidents.length > 25) {
      this.securityIncidents.length = 25;
    }
  }

  getSecurityIncidents(): SecurityIncidentAlert[] {
    return [...this.securityIncidents];
  }

  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    for (const adapter of this.adapters) {
      if (adapter.isEnabled) {
        adapter.recordMetric(name, value, labels);
      }
    }
  }

  getActiveAdapters(): Array<{ name: string; enabled: boolean }> {
    return this.adapters.map(a => ({ name: a.adapterName, enabled: a.isEnabled }));
  }
}

export const monitoringManager = new MonitoringManager();
