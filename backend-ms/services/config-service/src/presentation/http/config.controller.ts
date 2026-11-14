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
  isEncrypted: z.boolean().optional(),
  tenantId: z.string().optional()
});

const configParamSchema = z.object({
  key: z.string().trim().min(1, 'Config key is required')
});

export class ConfigController {
  constructor(
    private readonly getQuery: GetConfigQuery,
    private readonly setUseCase: SetConfigUseCase,
    private readonly listQuery: ListConfigsQuery,
    private readonly deleteUseCase: DeleteConfigUseCase
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  private isAuthorizedToDecrypt(req: Request): boolean {
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars';
    return (
      req.user?.role === 'ADMIN' ||
      req.header('x-internal-secret') === internalSecret ||
      process.env.NODE_ENV !== 'production'
    );
  }

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.listQuery.execute({ tenantId });
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
      const { key } = configParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);
      const defaultValue = req.query.default as string | undefined;
      const decrypt = this.isAuthorizedToDecrypt(req);

      const result = await this.getQuery.execute({ key, tenantId, defaultValue, decrypt });

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
      const paramKey = req.params.key !== undefined
        ? configParamSchema.parse(req.params).key
        : undefined;
      const raw = {
        ...req.body,
        key: paramKey || req.body?.key
      };
      const validated = setConfigSchema.parse(raw);
      const tenantId = validated.tenantId || this.getTenantId(req);
      const result = await this.setUseCase.execute({ ...validated, tenantId });

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
      const { key } = configParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);
      const result = await this.deleteUseCase.execute({ key, tenantId });

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
