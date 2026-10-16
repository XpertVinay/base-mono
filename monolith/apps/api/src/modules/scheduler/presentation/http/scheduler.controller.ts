import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ListJobsQuery, CreateJobUseCase, TriggerJobUseCase } from '../../application/use-cases/scheduler.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const createJobSchema = z.object({
  name: z.string().min(2),
  cronExpression: z.string().min(5)
});

export class SchedulerController {
  constructor(
    private readonly listJobsQuery: ListJobsQuery,
    private readonly createJobUseCase: CreateJobUseCase,
    private readonly triggerJobUseCase: TriggerJobUseCase
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listJobsQuery.execute();
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
      const result = await this.createJobUseCase.execute(validated);
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
      const result = await this.triggerJobUseCase.execute({ id });
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
