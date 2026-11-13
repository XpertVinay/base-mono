import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateAssetUseCase } from '../../application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from '../../application/queries/list-assets.query.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const createAssetSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().positive(),
  storagePath: z.string().min(1)
});

export class AssetController {
  constructor(
    private readonly createUseCase: CreateAssetUseCase,
    private readonly listQuery: ListAssetsQuery
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user?.id || (req.header('x-user-id') as string);
      if (!ownerId) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'No authenticated user identity provided' }]
        });
        return;
      }

      const validated = createAssetSchema.parse(req.body);
      const tenantId = req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
      const result = await this.createUseCase.execute({ ...validated, ownerId, tenantId });

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Asset registered successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  listMyAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user?.id || (req.header('x-user-id') as string);
      if (!ownerId) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'No authenticated user identity provided' }]
        });
        return;
      }

      const tenantId = req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
      const result = await this.listQuery.execute({ ownerId, tenantId });
      const assets = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Assets retrieved successfully',
        data: assets,
        meta: {
          pagination: {
            total: assets.length,
            limit: assets.length,
            page: 1,
            totalPages: 1
          }
        }
      });
    } catch (err) {
      next(err);
    }
  };
}
