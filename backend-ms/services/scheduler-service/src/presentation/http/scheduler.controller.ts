import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateJobUseCase,
  ListJobsQuery,
  TriggerJobUseCase
} from '../../application/use-cases/scheduler.use-cases.js';

const createJobSchema = z.object({
  name: z.string().min(1),
  cronExpression: z.string().min(1)
});

export class SchedulerController {
  constructor(
    private readonly listQuery: ListJobsQuery,
    private readonly createUseCase: CreateJobUseCase,
    private readonly triggerUseCase: TriggerJobUseCase
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listQuery.execute();
      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createJobSchema.parse(req.body);
      const result = await this.createUseCase.execute(validated);

      res.status(201).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  trigger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.triggerUseCase.execute({ id });

      if (result.isFailure) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: result.getError() } });
        return;
      }

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };
}
