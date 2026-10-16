import { IMonitoringAdapter } from './monitoring-adapters.interface.js';
import { AuditLog } from '../../domain/entities/audit-log.entity.js';
import { logger } from '../../shared/infrastructure/logger.js';

interface MetricEntry {
  name: string;
  help: string;
  type: 'counter' | 'gauge';
  values: Map<string, number>;
}

export class PrometheusMonitoringAdapter implements IMonitoringAdapter {
  readonly adapterName = 'PROMETHEUS';
  public readonly isEnabled: boolean;
  private metrics = new Map<string, MetricEntry>();

  constructor() {
    this.isEnabled = process.env.ENABLE_PROMETHEUS !== 'false'; // Enabled by default
    this.initDefaultMetrics();
  }

  private initDefaultMetrics(): void {
    this.metrics.set('audit_events_total', {
      name: 'audit_events_total',
      help: 'Total number of audit events processed',
      type: 'counter',
      values: new Map()
    });

    this.metrics.set('http_requests_total', {
      name: 'http_requests_total',
      help: 'Total HTTP requests handled by audit service',
      type: 'counter',
      values: new Map()
    });
  }

  async init(): Promise<void> {
    if (!this.isEnabled) {
      logger.info('Prometheus adapter disabled via configuration flag.');
      return;
    }
    logger.info('Prometheus metrics collector initialized.');
  }

  async exportAuditLog(log: AuditLog): Promise<void> {
    if (!this.isEnabled) return;
    const labelKey = `action="${log.action}",severity="${log.severity}",resource="${log.resource}"`;
    const counter = this.metrics.get('audit_events_total');
    if (counter) {
      const current = counter.values.get(labelKey) || 0;
      counter.values.set(labelKey, current + 1);
    }
  }

  recordMetric(metricName: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.isEnabled) return;
    let entry = this.metrics.get(metricName);
    if (!entry) {
      entry = {
        name: metricName,
        help: `Custom metric ${metricName}`,
        type: 'gauge',
        values: new Map()
      };
      this.metrics.set(metricName, entry);
    }

    const labelKey = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    entry.values.set(labelKey, value);
  }

  getMetricsOutput(): string {
    const lines: string[] = [];
    for (const [, metric] of this.metrics.entries()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      if (metric.values.size === 0) {
        lines.push(`${metric.name} 0`);
      } else {
        for (const [labels, val] of metric.values.entries()) {
          const lStr = labels ? `{${labels}}` : '';
          lines.push(`${metric.name}${lStr} ${val}`);
        }
      }
    }
    return lines.join('\n') + '\n';
  }
}
