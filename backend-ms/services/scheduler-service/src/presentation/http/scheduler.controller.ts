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

const jobParamSchema = z.object({
  id: z.string().trim().min(1, 'Job ID is required')
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

  private getTenantId(req: Request): string {
    return (req as any).tenant?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.listQuery.execute({ tenantId });
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
      const tenantId = this.getTenantId(req);
      const result = await this.createUseCase.execute({ ...validated, tenantId });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'CREATE_JOB_FAILED', message: result.getError() }]
        });
        return;
      }

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

      const { id } = jobParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);
      const result = await this.getByIdQuery.execute({ id, tenantId });

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

      const { id } = jobParamSchema.parse(req.params);
      const validated = updateJobSchema.parse(req.body);
      const tenantId = this.getTenantId(req);

      const result = await this.updateUseCase.execute({ id, ...validated, tenantId });
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

      const { id } = jobParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);
      const result = await this.deleteUseCase.execute({ id, tenantId });

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
      const { id } = jobParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);
      const result = await this.triggerUseCase.execute({ id, tenantId });

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
