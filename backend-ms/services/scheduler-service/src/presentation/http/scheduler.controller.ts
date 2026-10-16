import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateJobUseCase,
  ListJobsQuery,
  TriggerJobUseCase
} from '../../application/use-cases/scheduler.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

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

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listQuery.execute();
      const jobs = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Scheduled jobs retrieved successfully',
        data: jobs,
        meta: {
          pagination: {
            total: jobs.length,
            limit: jobs.length,
            page: 1,
            totalPages: 1
          }
        }
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createJobSchema.parse(req.body);
      const result = await this.createUseCase.execute(validated);

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Scheduled job registered successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  trigger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.triggerUseCase.execute({ id });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'id' }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Scheduled job triggered successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
