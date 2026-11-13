import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateJobUseCase,
  ListJobsQuery,
  TriggerJobUseCase
} from '../../application/use-cases/scheduler.use-cases.js';
import {
  GetJobByIdQuery,
  UpdateJobUseCase,
  DeleteJobUseCase
} from '../../application/use-cases/backoffice-scheduler.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const createJobSchema = z.object({
  name: z.string().min(1),
  cronExpression: z.string().min(1)
});

const updateJobSchema = z.object({
  name: z.string().min(1).optional(),
  cronExpression: z.string().min(1).optional(),
  status: z.enum(['SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional()
});

export class SchedulerController {
  constructor(
    private readonly listQuery: ListJobsQuery,
    private readonly createUseCase: CreateJobUseCase,
    private readonly triggerUseCase: TriggerJobUseCase,
    private readonly getByIdQuery?: GetJobByIdQuery,
    private readonly updateUseCase?: UpdateJobUseCase,
    private readonly deleteUseCase?: DeleteJobUseCase
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

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.getByIdQuery) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Get job by ID not implemented' });
        return;
      }

      const id = req.params.id as string;
      const result = await this.getByIdQuery.execute({ id });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'JOB_NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Scheduled job retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  updateJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Update job not implemented' });
        return;
      }

      const id = req.params.id as string;
      const validated = updateJobSchema.parse(req.body);

      const result = await this.updateUseCase.execute({ id, ...validated });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'JOB_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Scheduled job updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  deleteJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.deleteUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Delete job not implemented' });
        return;
      }

      const id = req.params.id as string;
      const result = await this.deleteUseCase.execute({ id });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'JOB_DELETE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Scheduled job deleted successfully',
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
          errors: [{ code: 'TRIGGER_FAILED', message: result.getError() }]
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
