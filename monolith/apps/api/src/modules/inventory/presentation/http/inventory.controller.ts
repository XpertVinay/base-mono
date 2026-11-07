import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ListInventoryQuery,
  GetInventoryItemQuery,
  CreateInventoryItemUseCase,
  ReserveStockUseCase,
  ReleaseStockUseCase,
  CommitStockUseCase
} from '../../application/use-cases/inventory.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';
import { BadRequestError } from '../../../../shared/presentation/error-handler.middleware.js';

const createStockSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().optional(),
  category: z.string().optional(),
  initialQuantity: z.number().int().nonnegative('Initial quantity cannot be negative'),
  productId: z.string().optional()
});

const reserveStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  orderId: z.string().min(1, 'Order ID is required'),
  expectedVersion: z.number().int().positive().optional()
});

const releaseStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  orderId: z.string().min(1, 'Order ID is required')
});

const commitStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  orderId: z.string().min(1, 'Order ID is required')
});

export class InventoryController {
  constructor(
    private readonly listInventoryQuery: ListInventoryQuery,
    private readonly getInventoryItemQuery: GetInventoryItemQuery,
    private readonly createInventoryItemUseCase: CreateInventoryItemUseCase,
    private readonly reserveStockUseCase: ReserveStockUseCase,
    private readonly releaseStockUseCase: ReleaseStockUseCase,
    private readonly commitStockUseCase: CommitStockUseCase
  ) {}

  private extractTenantId(req: Request): string {
    const rawHeader = req.headers['x-tenant-id'] || req.headers['x-organization-id'];
    const tenantFromHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    const tenantId = (
      req.tenantContext?.activeOrganization?.id ||
      tenantFromHeader ||
      req.user?.tenantId ||
      'default-tenant'
    );

    return tenantId.trim();
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.extractTenantId(req);
      const result = await this.listInventoryQuery.execute({ tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawId = req.params.productId || req.params.id;
      const productId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!productId) {
        return next(new BadRequestError('Product ID parameter is required'));
      }

      const tenantId = this.extractTenantId(req);
      const result = await this.getInventoryItemQuery.execute({ productId, tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createStockSchema.parse(req.body);
      const tenantId = this.extractTenantId(req);

      const result = await this.createInventoryItemUseCase.execute({
        ...validated,
        tenantId
      });

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  reserve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = reserveStockSchema.parse(req.body);
      const tenantId = this.extractTenantId(req);

      const result = await this.reserveStockUseCase.execute({
        ...validated,
        tenantId
      });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  release = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = releaseStockSchema.parse(req.body);
      const tenantId = this.extractTenantId(req);

      const result = await this.releaseStockUseCase.execute({
        ...validated,
        tenantId
      });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  commit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = commitStockSchema.parse(req.body);
      const tenantId = this.extractTenantId(req);

      const result = await this.commitStockUseCase.execute({
        ...validated,
        tenantId
      });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
