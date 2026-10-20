export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface AuditLogItem {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  severity: AuditSeverity;
  details?: Record<string, any>;
  ipAddress?: string;
  correlationId?: string;
  createdAt: string;
}

export interface AlertIncident {
  id: string;
  title: string;
  service: string;
  severity: 'CRITICAL' | 'WARN' | 'INFO';
  status: 'FIRING' | 'RESOLVED';
  customerImpact: string;
  suggestedAction: string;
  triggeredAt: string;
  acknowledged?: boolean;
}

export interface MetricsSummary {
  totalEvents: number;
  errorCount: number;
  criticalCount: number;
  riskScore: number;
  remediationCount: number;
  systemHealthPct: number;
}

export interface RemediationPayload {
  alertId?: string;
  actionType:
    | 'RETRY_TRANSACTION'
    | 'BLOCK_ACTOR_IP'
    | 'PAGE_ON_CALL_OPS'
    | 'ESCALATE_INCIDENT'
    | 'ACKNOWLEDGE_INCIDENT'
    | 'SCALE_DB_POOL'
    | 'FLUSH_CACHE';
  targetResource: string;
  notes?: string;
}

export interface RemediationResult {
  action: string;
  resource: string;
  status: string;
  executedAt: string;
}
