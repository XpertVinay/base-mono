import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateOrderUseCase,
  CancelOrderUseCase,
  FulfillOrderUseCase,
  GetOrderByIdQuery,
  ListMyOrdersQuery,
  ListTenantOrdersQuery
} from '../../application/commands/order.commands.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';
import { BadRequestError, UnauthorizedError } from '../../../../shared/presentation/error-handler.middleware.js';

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1, 'Product ID is required'),
    productName: z.string().min(1, 'Product name is required'),
    quantity: z.number().int().positive('Quantity must be positive'),
    unitPrice: z.number().positive('Unit price must be positive')
  })).min(1, 'Order must contain at least one item'),
  currency: z.string().optional()
});

const cancelOrderSchema = z.object({
  reason: z.string().optional()
});

export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly fulfillOrderUseCase: FulfillOrderUseCase,
    private readonly getOrderByIdQuery: GetOrderByIdQuery,
    private readonly listMyOrdersQuery: ListMyOrdersQuery,
    private readonly listTenantOrdersQuery: ListTenantOrdersQuery
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

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const validated = createOrderSchema.parse(req.body);
      const userId = req.user.id;
      const tenantId = this.extractTenantId(req);

      const result = await this.createOrderUseCase.execute({
        ...validated,
        userId,
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

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const rawId = req.params.id;
      const orderId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!orderId) {
        return next(new BadRequestError('Order ID parameter is required'));
      }

      const userId = req.user.id;
      const role = req.user.role;
      const tenantId = this.extractTenantId(req);

      const result = await this.getOrderByIdQuery.execute({ orderId, userId, role, tenantId });
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

  listMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const userId = req.user.id;
      const tenantId = this.extractTenantId(req);

      const result = await this.listMyOrdersQuery.execute({ userId, tenantId });
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

  listTenantOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const tenantId = this.extractTenantId(req);
      const result = await this.listTenantOrdersQuery.execute({ tenantId });
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

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const rawId = req.params.id;
      const orderId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!orderId) {
        return next(new BadRequestError('Order ID parameter is required'));
      }

      const validated = cancelOrderSchema.parse(req.body || {});
      const userId = req.user.id;
      const role = req.user.role;
      const tenantId = this.extractTenantId(req);

      const result = await this.cancelOrderUseCase.execute({
        orderId,
        userId,
        role,
        tenantId,
        reason: validated.reason
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

  fulfill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const rawId = req.params.id;
      const orderId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!orderId) {
        return next(new BadRequestError('Order ID parameter is required'));
      }

      const tenantId = this.extractTenantId(req);
      const result = await this.fulfillOrderUseCase.execute({ orderId, tenantId });

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
