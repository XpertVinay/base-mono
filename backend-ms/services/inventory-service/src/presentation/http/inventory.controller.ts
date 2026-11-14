import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ReserveInventoryUseCase,
  ReleaseInventoryUseCase,
  AddStockUseCase,
  GetStockQuery
} from '../../application/use-cases/inventory.use-cases.js';
import {
  ListAllInventoryQuery,
  CreateInventoryItemUseCase,
  UpdateInventoryItemUseCase,
  DeleteInventoryItemUseCase
} from '../../application/use-cases/backoffice-inventory.use-cases.js';
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

const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  lowStock: z.coerce.boolean().optional()
});

const createInventoryItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  totalQuantity: z.number().int().nonnegative(),
  availableQuantity: z.number().int().nonnegative().optional(),
  tenantId: z.string().optional()
});

const updateInventoryItemSchema = z.object({
  sku: z.string().min(1).optional(),
  totalQuantity: z.number().int().nonnegative().optional(),
  availableQuantity: z.number().int().nonnegative().optional(),
  reservedQuantity: z.number().int().nonnegative().optional()
});

export class InventoryController {
  constructor(
    private readonly reserveUseCase: ReserveInventoryUseCase,
    private readonly addStockUseCase: AddStockUseCase,
    private readonly getStockQuery: GetStockQuery,
    private readonly releaseUseCase?: ReleaseInventoryUseCase,
    private readonly listAllQuery?: ListAllInventoryQuery,
    private readonly createItemUseCase?: CreateInventoryItemUseCase,
    private readonly updateItemUseCase?: UpdateInventoryItemUseCase,
    private readonly deleteItemUseCase?: DeleteInventoryItemUseCase
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

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.listAllQuery) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'List inventory not implemented' });
        return;
      }

      const queryParams = listInventoryQuerySchema.parse(req.query);
      const tenantId = this.getTenantId(req);

      const result = await this.listAllQuery.execute({
        tenantId,
        page: queryParams.page,
        limit: queryParams.limit,
        search: queryParams.search,
        lowStock: queryParams.lowStock
      });

      const { items, total, page, limit } = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Inventory items retrieved successfully',
        data: items,
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

  createItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.createItemUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Create inventory item not implemented' });
        return;
      }

      const validated = createInventoryItemSchema.parse(req.body);
      const tenantId = validated.tenantId || this.getTenantId(req);

      const result = await this.createItemUseCase.execute({ ...validated, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'INVENTORY_CREATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Inventory item created successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateItemUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Update inventory item not implemented' });
        return;
      }

      const productId = req.params.productId as string;
      const tenantId = this.getTenantId(req);
      const validated = updateInventoryItemSchema.parse(req.body);

      const result = await this.updateItemUseCase.execute({ productId, tenantId, ...validated });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'INVENTORY_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Inventory item updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  deleteItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.deleteItemUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Delete inventory item not implemented' });
        return;
      }

      const productId = req.params.productId as string;
      const tenantId = this.getTenantId(req);

      const result = await this.deleteItemUseCase.execute({ productId, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'INVENTORY_DELETE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Inventory item deleted successfully',
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

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'ADD_STOCK_FAILED', message: result.getError() }]
        });
        return;
      }

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
