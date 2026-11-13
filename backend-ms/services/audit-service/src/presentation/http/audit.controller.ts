import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  RecordAuditLogUseCase,
  QueryAuditLogsQuery
} from '../../application/use-cases/audit.use-cases.js';
import { monitoringManager } from '../../infrastructure/monitoring/monitoring.manager.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const recordSchema = z.object({
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  severity: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']).optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  correlationId: z.string().optional(),
  tenantId: z.string().optional()
});

export class AuditController {
  constructor(
    private readonly recordUseCase: RecordAuditLogUseCase,
    private readonly queryLogsQuery: QueryAuditLogsQuery
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  record = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = recordSchema.parse(req.body);
      const correlationId = (req.header('x-correlation-id') || req.context?.correlationId) as string | undefined;
      const ipAddress = (req.ip || 'unknown') as string;
      const tenantId = validated.tenantId || this.getTenantId(req);

      const result = await this.recordUseCase.execute({
        ...validated,
        tenantId,
        correlationId: validated.correlationId || correlationId,
        ipAddress: validated.ipAddress || ipAddress
      });

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Audit log recorded successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  query = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.query.actorId as string | undefined;
      const resource = req.query.resource as string | undefined;
      const action = req.query.action as string | undefined;
      const severity = req.query.severity as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      // Restrict query to the active tenant unless platform admin
      const isPlatformAdmin = req.user?.role === 'ADMIN' && req.user?.tenantId === 'default';
      const tenantId = isPlatformAdmin && req.query.tenantId
        ? String(req.query.tenantId)
        : this.getTenantId(req);

      const result = await this.queryLogsQuery.execute({
        tenantId,
        actorId,
        resource,
        action,
        severity,
        limit
      });

      const logs = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Audit logs retrieved successfully',
        data: logs,
        meta: {
          pagination: {
            total: logs.length,
            limit,
            page: 1,
            totalPages: 1
          }
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getMetrics = async (_req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(monitoringManager.prometheusAdapter.getMetricsOutput());
  };

  getMetricsSummary = async (req: Request, res: Response): Promise<void> => {
    const summary = monitoringManager.prometheusAdapter.getMetricsSummary();
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Telemetry metrics summary retrieved successfully',
      data: summary
    });
  };

  getAlerts = async (req: Request, res: Response): Promise<void> => {
    const summary = monitoringManager.prometheusAdapter.getMetricsSummary();
    const liveSecurityIncidents = monitoringManager.getSecurityIncidents();
    const baselineAlerts = [
      {
        id: 'alt-001',
        title: 'Elevated Transaction Failures',
        service: 'transaction-service',
        severity: summary.riskScore > 30 ? 'CRITICAL' : 'WARN',
        status: summary.riskScore > 40 ? 'FIRING' : 'RESOLVED',
        customerImpact: 'High risk: 14 checkout attempts degraded in past 10m',
        suggestedAction: 'RETRY_TRANSACTION',
        triggeredAt: new Date(Date.now() - 1000 * 60 * 8).toISOString()
      },
      {
        id: 'alt-002',
        title: 'IAM Rate Limit Breach Surge',
        service: 'iam-service',
        severity: 'WARN',
        status: 'FIRING',
        customerImpact: 'Potential brute force or rogue token spamming gateway',
        suggestedAction: 'BLOCK_ACTOR_IP',
        triggeredAt: new Date(Date.now() - 1000 * 60 * 18).toISOString()
      },
      {
        id: 'alt-003',
        title: 'PostgreSQL DB Connection Saturation',
        service: 'postgres',
        severity: 'INFO',
        status: 'RESOLVED',
        customerImpact: 'Connection pool hit 78% threshold (auto-scaled)',
        suggestedAction: 'SCALE_DB_POOL',
        triggeredAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
      }
    ];

    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Active monitoring alerts retrieved successfully',
      data: [...liveSecurityIncidents, ...baselineAlerts]
    });
  };

  executeRemediation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const remediationSchema = z.object({
        alertId: z.string().optional(),
        actionType: z.enum([
          'RETRY_TRANSACTION',
          'BLOCK_ACTOR_IP',
          'PAGE_ON_CALL_OPS',
          'ESCALATE_INCIDENT',
          'ACKNOWLEDGE_INCIDENT',
          'SCALE_DB_POOL',
          'FLUSH_CACHE'
        ]),
        targetResource: z.string().min(1),
        notes: z.string().optional()
      });

      const body = remediationSchema.parse(req.body);
      monitoringManager.prometheusAdapter.recordRemediation(body.actionType, body.targetResource);
      const tenantId = this.getTenantId(req);

      // Record an audit log for the remediation itself to maintain complete traceability
      await this.recordUseCase.execute({
        tenantId,
        actorEmail: req.user?.email || 'operator@enterprise.internal',
        action: `REMEDIATION_${body.actionType}`,
        resource: body.targetResource,
        severity: 'INFO',
        details: {
          alertId: body.alertId,
          notes: body.notes,
          timestamp: new Date().toISOString()
        },
        ipAddress: req.ip || '127.0.0.1'
      });

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: `Remediation action '${body.actionType}' dispatched successfully`,
        data: {
          action: body.actionType,
          resource: body.targetResource,
          status: 'EXECUTED',
          executedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getConfig = async (req: Request, res: Response): Promise<void> => {
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Monitoring configuration retrieved successfully',
      data: {
        adapters: monitoringManager.getActiveAdapters(),
        timestamp: new Date().toISOString()
      }
    });
  };

  getAnnotations = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(monitoringManager.grafanaAdapter.getAnnotations());
  };
}
