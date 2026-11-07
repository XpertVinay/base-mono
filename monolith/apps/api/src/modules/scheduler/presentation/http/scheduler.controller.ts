import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ListJobsQuery,
  GetJobByIdQuery,
  CreateJobUseCase,
  TriggerJobUseCase,
  ListJobRunsQuery
} from '../../application/use-cases/scheduler.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const createJobSchema = z.object({
  name: z.string().min(2),
  cronExpression: z.string().min(5),
  tenantId: z.string().optional()
});

function extractTenantId(req: Request): string | undefined {
  const tenantId = (req as any).tenantId || req.headers['x-tenant-id'];
  if (typeof tenantId === 'string' && tenantId.trim().length > 0) {
    return tenantId.trim();
  }
  return undefined;
}

export class SchedulerController {
  constructor(
    private readonly listJobsQuery: ListJobsQuery,
    private readonly getJobByIdQuery: GetJobByIdQuery,
    private readonly createJobUseCase: CreateJobUseCase,
    private readonly triggerJobUseCase: TriggerJobUseCase,
    private readonly listJobRunsQuery: ListJobRunsQuery
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = extractTenantId(req);
      const result = await this.listJobsQuery.execute({ tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const tenantId = extractTenantId(req);
      const result = await this.getJobByIdQuery.execute({ id, tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createJobSchema.parse(req.body);
      const tenantId = validated.tenantId || extractTenantId(req);
      const result = await this.createJobUseCase.execute({
        ...validated,
        tenantId
      });
      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  trigger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const tenantId = extractTenantId(req);
      const result = await this.triggerJobUseCase.execute({ id, tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listRuns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobId = String(req.params.id);
      const tenantId = extractTenantId(req);
      const result = await this.listJobRunsQuery.execute({ jobId, tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
