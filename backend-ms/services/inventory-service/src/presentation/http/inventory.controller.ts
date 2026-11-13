import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ReserveInventoryUseCase,
  ReleaseInventoryUseCase,
  AddStockUseCase,
  GetStockQuery
} from '../../application/use-cases/inventory.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const reserveSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  tenantId: z.string().optional()
});

const releaseSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  tenantId: z.string().optional()
});

const addStockSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  tenantId: z.string().optional()
});

export class InventoryController {
  constructor(
    private readonly reserveUseCase: ReserveInventoryUseCase,
    private readonly addStockUseCase: AddStockUseCase,
    private readonly getStockQuery: GetStockQuery,
    private readonly releaseUseCase?: ReleaseInventoryUseCase
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  getStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const productId = req.params.productId as string;
      const tenantId = this.getTenantId(req);
      const result = await this.getStockQuery.execute({ productId, tenantId });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'productId' }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Stock retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  reserve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = reserveSchema.parse(req.body);
      const tenantId = validated.tenantId || this.getTenantId(req);
      const result = await this.reserveUseCase.execute({ ...validated, tenantId });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'STOCK_UNAVAILABLE', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Stock reserved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  release = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.releaseUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Release operation not initialized',
          errors: [{ code: 'NOT_IMPLEMENTED', message: 'Release use case missing' }]
        });
        return;
      }
      const validated = releaseSchema.parse(req.body);
      const tenantId = validated.tenantId || this.getTenantId(req);
      const result = await this.releaseUseCase.execute({ ...validated, tenantId });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'RELEASE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Stock released successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  addStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = addStockSchema.parse(req.body);
      const tenantId = validated.tenantId || this.getTenantId(req);
      const result = await this.addStockUseCase.execute({ ...validated, tenantId });

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Stock added successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
