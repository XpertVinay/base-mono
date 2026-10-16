import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  RecordAuditLogUseCase,
  QueryAuditLogsQuery
} from '../../application/use-cases/audit.use-cases.js';
import { monitoringManager } from '../../infrastructure/monitoring/monitoring.manager.js';

const recordSchema = z.object({
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  severity: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']).optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  correlationId: z.string().optional()
});

export class AuditController {
  constructor(
    private readonly recordUseCase: RecordAuditLogUseCase,
    private readonly queryLogsQuery: QueryAuditLogsQuery
  ) {}

  record = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = recordSchema.parse(req.body);
      const correlationId = (req.header('x-correlation-id') || req.context?.correlationId) as string | undefined;
      const ipAddress = (req.ip || 'unknown') as string;

      const result = await this.recordUseCase.execute({
        ...validated,
        correlationId: validated.correlationId || correlationId,
        ipAddress: validated.ipAddress || ipAddress
      });

      res.status(201).json({ success: true, data: result.getValue() });
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

      const result = await this.queryLogsQuery.execute({
        actorId,
        resource,
        action,
        severity,
        limit
      });

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  getMetrics = async (_req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(monitoringManager.prometheusAdapter.getMetricsOutput());
  };

  getConfig = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
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
