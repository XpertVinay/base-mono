import { IMonitoringAdapter } from './monitoring-adapters.interface.js';
import { CloudWatchMonitoringAdapter } from './cloudwatch.adapter.js';
import { PrometheusMonitoringAdapter } from './prometheus.adapter.js';
import { GrafanaMonitoringAdapter } from './grafana.adapter.js';
import { AuditLog } from '../../domain/entities/audit-log.entity.js';
import { logger } from '../../shared/infrastructure/logger.js';

export class MonitoringManager {
  private adapters: IMonitoringAdapter[] = [];
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
