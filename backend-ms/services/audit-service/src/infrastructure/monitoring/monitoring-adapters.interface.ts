import { AuditLog } from '../../domain/entities/audit-log.entity.js';

export interface IMonitoringAdapter {
  readonly adapterName: string;
  readonly isEnabled: boolean;
  init(): Promise<void>;
  exportAuditLog(log: AuditLog): Promise<void>;
  recordMetric(metricName: string, value: number, labels?: Record<string, string>): void;
}
