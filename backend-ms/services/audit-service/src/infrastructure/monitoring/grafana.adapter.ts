import { IMonitoringAdapter } from './monitoring-adapters.interface.js';
import { AuditLog } from '../../domain/entities/audit-log.entity.js';
import { logger } from '../../shared/infrastructure/logger.js';

export class GrafanaMonitoringAdapter implements IMonitoringAdapter {
  readonly adapterName = 'GRAFANA';
  public readonly isEnabled: boolean;
  private recentAnnotations: Array<{ title: string; time: number; text: string; tags: string[] }> = [];

  constructor() {
    this.isEnabled = process.env.ENABLE_GRAFANA !== 'false';
  }

  async init(): Promise<void> {
    if (!this.isEnabled) {
      logger.info('Grafana monitoring integration disabled via configuration flag.');
      return;
    }
    logger.info('Grafana annotations and dashboard telemetry exporter initialized.');
  }

  async exportAuditLog(log: AuditLog): Promise<void> {
    if (!this.isEnabled) return;

    // Buffer significant audit actions for Grafana dashboard annotation overlays
    if (log.severity === 'WARN' || log.severity === 'ERROR' || log.severity === 'CRITICAL') {
      this.recentAnnotations.push({
        title: `[${log.severity}] ${log.action}`,
        time: log.createdAt.getTime(),
        text: `Resource: ${log.resource} (${log.resourceId || 'N/A'}) by ${log.actorEmail || 'system'}`,
        tags: ['audit', log.severity.toLowerCase(), log.resource]
      });

      if (this.recentAnnotations.length > 200) {
        this.recentAnnotations.shift();
      }
    }
  }

  recordMetric(_metricName: string, _value: number, _labels?: Record<string, string>): void {
    if (!this.isEnabled) return;
    // Grafana metrics are scraped via Prometheus or OpenTelemetry collector
  }

  getAnnotations(): Array<{ title: string; time: number; text: string; tags: string[] }> {
    return this.recentAnnotations;
  }
}
