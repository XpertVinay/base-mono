import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { z } from 'zod';
import { CreateAssetUseCase } from '../../application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from '../../application/queries/list-assets.query.js';
import {
  ListAllAssetsQuery,
  GetAssetByIdQuery,
  UpdateAssetUseCase,
  DeleteAssetUseCase
} from '../../application/commands/backoffice-asset.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const storagePathSchema = z
  .string()
  .min(1)
  .refine(val => !val.includes('\0'), {
    message: 'storagePath must not contain null bytes'
  })
  .refine(val => !val.split(/[/\\]/).some(segment => segment === '..'), {
    message: 'storagePath must not contain directory traversal sequences (..)'
  })
  .transform(val => path.posix.normalize(val.replace(/\\/g, '/')));

const assetParamSchema = z.object({
  id: z.string().trim().min(1, 'Asset ID is required')
});

const createAssetSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().positive(),
  storagePath: storagePathSchema,
  tenantId: z.string().optional()
});

const updateAssetSchema = z.object({
  name: z.string().min(1).optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().positive().optional(),
  storagePath: storagePathSchema.optional()
});

const listAssetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  ownerId: z.string().trim().optional()
});

export class AssetController {
  constructor(
    private readonly createUseCase: CreateAssetUseCase,
    private readonly listQuery: ListAssetsQuery,
    private readonly listAllQuery?: ListAllAssetsQuery,
    private readonly getByIdQuery?: GetAssetByIdQuery,
    private readonly updateUseCase?: UpdateAssetUseCase,
    private readonly deleteUseCase?: DeleteAssetUseCase
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

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
      const tenantId = validated.tenantId || this.getTenantId(req);
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

      const tenantId = this.getTenantId(req);
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

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.listAllQuery) {
        return this.listMyAssets(req, res, next);
      }

      const queryParams = listAssetsQuerySchema.parse(req.query);
      const tenantId = this.getTenantId(req);

      const result = await this.listAllQuery.execute({
        tenantId,
        page: queryParams.page,
        limit: queryParams.limit,
        search: queryParams.search,
        ownerId: queryParams.ownerId
      });

      const { assets, total, page, limit } = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Backoffice assets retrieved successfully',
        data: assets,
        meta: {
          pagination: {
            total,
            limit,
            page,
            totalPages: Math.ceil(total / limit) || 1
          }
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = assetParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);

      if (!this.getByIdQuery) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Get asset by ID not implemented'
        });
        return;
      }

      const result = await this.getByIdQuery.execute({ id, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'ASSET_NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      const asset = result.getValue();
      const currentUserId = req.user?.id || (req.header('x-user-id') as string);
      const currentUserRole = req.user?.role || (req.header('x-user-role') as string);
      const isPrivileged = currentUserRole === 'ADMIN' || currentUserRole === 'SUPPORT';

      if (!isPrivileged && currentUserId && asset.ownerId !== currentUserId) {
        ApiResponse.error(res, {
          req,
          statusCode: 403,
          message: 'Forbidden: You do not have permission to access this asset',
          errors: [{ code: 'FORBIDDEN', message: 'Not authorized to access this asset' }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Asset retrieved successfully',
        data: asset
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = assetParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);
      const validated = updateAssetSchema.parse(req.body);

      if (!this.updateUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Update asset not implemented'
        });
        return;
      }

      const result = await this.updateUseCase.execute({ id, tenantId, ...validated });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'ASSET_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Asset updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = assetParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);

      if (!this.deleteUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Delete asset not implemented'
        });
        return;
      }

      const result = await this.deleteUseCase.execute({ id, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'ASSET_DELETE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Asset deleted successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
