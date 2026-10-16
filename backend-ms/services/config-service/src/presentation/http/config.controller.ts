import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  GetConfigQuery,
  SetConfigUseCase,
  ListConfigsQuery,
  DeleteConfigUseCase
} from '../../application/use-cases/config.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const setConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  description: z.string().optional(),
  isEncrypted: z.boolean().optional()
});

export class ConfigController {
  constructor(
    private readonly getQuery: GetConfigQuery,
    private readonly setUseCase: SetConfigUseCase,
    private readonly listQuery: ListConfigsQuery,
    private readonly deleteUseCase: DeleteConfigUseCase
  ) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listQuery.execute();
      const items = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Configurations retrieved successfully',
        data: items,
        meta: {
          pagination: {
            total: items.length,
            limit: items.length,
            page: 1,
            totalPages: 1
          }
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getByKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = req.params.key as string;
      const defaultValue = req.query.default as string | undefined;
      const result = await this.getQuery.execute({ key, defaultValue });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'key' }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Configuration retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  set = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = setConfigSchema.parse(req.body);
      const result = await this.setUseCase.execute(validated);

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Configuration updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = req.params.key as string;
      const result = await this.deleteUseCase.execute({ key });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'key' }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Configuration deleted successfully',
        data: { deleted: true, key }
      });
    } catch (err) {
      next(err);
    }
  };
}
