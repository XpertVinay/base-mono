import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateOrderUseCase,
  CancelOrderUseCase,
  GetOrderByIdQuery,
  ListMyOrdersQuery
} from '../../application/commands/order.commands.js';
import {
  ListAllOrdersQuery,
  GetBackofficeOrderByIdQuery,
  UpdateOrderStatusUseCase,
  UpdateOrderUseCase,
  DeleteOrderUseCase
} from '../../application/commands/backoffice-order.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const createOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      productName: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive()
    })
  ).min(1),
  currency: z.string().optional(),
  tenantId: z.string().optional()
});

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  search: z.string().trim().optional()
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  reason: z.string().trim().optional()
});

const updateOrderSchema = z.object({
  totalAmount: z.number().positive().optional(),
  currency: z.string().min(1).max(10).optional()
});

export class OrderController {
  constructor(
    private readonly createUseCase: CreateOrderUseCase,
    private readonly cancelUseCase: CancelOrderUseCase,
    private readonly getByIdQuery: GetOrderByIdQuery,
    private readonly listMyQuery: ListMyOrdersQuery,
    private readonly listAllQuery?: ListAllOrdersQuery,
    private readonly getBackofficeOrderByIdQuery?: GetBackofficeOrderByIdQuery,
    private readonly updateOrderStatusUseCase?: UpdateOrderStatusUseCase,
    private readonly updateOrderUseCase?: UpdateOrderUseCase,
    private readonly deleteOrderUseCase?: DeleteOrderUseCase
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id || (req.header('x-user-id') as string);
      if (!userId) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'No authenticated user identity provided' }]
        });
        return;
      }

      const validated = createOrderSchema.parse(req.body);
      const tenantId = validated.tenantId || this.getTenantId(req);
      const result = await this.createUseCase.execute({ ...validated, userId, tenantId });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'ORDER_CREATION_FAILED', message: result.getError() }],
          meta: { further_steps: ['Check stock availability or item details'] }
        });
        return;
      }

      const order = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Order created successfully',
        data: order,
        meta: {
          further_steps: [
            `Proceed to payment initiation at POST /api/v1/transactions/initiate with referenceId: "${(order as any).id}"`
          ]
        }
      });
    } catch (err) {
      next(err);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.listAllQuery) {
        return this.listMyOrders(req, res, next);
      }

      const queryParams = listOrdersQuerySchema.parse(req.query);
      const tenantId = this.getTenantId(req);

      const result = await this.listAllQuery.execute({
        tenantId,
        page: queryParams.page,
        limit: queryParams.limit,
        status: queryParams.status,
        userId: queryParams.userId,
        search: queryParams.search
      });

      const { orders, total, page, limit } = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Orders retrieved successfully',
        data: orders,
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
      const id = req.params.id as string;
      const userId = req.user?.id || (req.header('x-user-id') as string) || '';
      const role = req.user?.role || (req.header('x-user-role') as string) || 'USER';
      const tenantId = this.getTenantId(req);

      if (['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].includes(role) && this.getBackofficeOrderByIdQuery) {
        const result = await this.getBackofficeOrderByIdQuery.execute({ id, tenantId });
        if (result.isFailure) {
          ApiResponse.error(res, {
            req,
            statusCode: 404,
            message: result.getError(),
            errors: [{ code: 'ORDER_NOT_FOUND', message: result.getError() }]
          });
          return;
        }

        ApiResponse.success(res, {
          req,
          statusCode: 200,
          message: 'Order retrieved successfully',
          data: result.getValue()
        });
        return;
      }

      const result = await this.getByIdQuery.execute({ orderId: id, userId, role, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'ORDER_NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Order retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateOrderStatusUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Update order status not implemented' });
        return;
      }

      const id = req.params.id as string;
      const tenantId = this.getTenantId(req);
      const validated = updateOrderStatusSchema.parse(req.body);

      const result = await this.updateOrderStatusUseCase.execute({
        orderId: id,
        status: validated.status as any,
        tenantId,
        reason: validated.reason
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'ORDER_STATUS_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Order status updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  updateOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateOrderUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Update order not implemented' });
        return;
      }

      const id = req.params.id as string;
      const tenantId = this.getTenantId(req);
      const validated = updateOrderSchema.parse(req.body);

      const result = await this.updateOrderUseCase.execute({
        orderId: id,
        tenantId,
        ...validated
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'ORDER_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Order updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  deleteOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.deleteOrderUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Delete order not implemented' });
        return;
      }

      const id = req.params.id as string;
      const tenantId = this.getTenantId(req);

      const result = await this.deleteOrderUseCase.execute({ orderId: id, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'ORDER_DELETE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Order deleted successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id || (req.header('x-user-id') as string) || '';
      const role = req.user?.role || (req.header('x-user-role') as string) || 'USER';
      const tenantId = this.getTenantId(req);

      const result = await this.cancelUseCase.execute({ orderId: id, userId, role, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'CANCEL_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Order cancelled successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  listMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id || (req.header('x-user-id') as string);
      if (!userId) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'No authenticated user identity provided' }]
        });
        return;
      }

      const tenantId = this.getTenantId(req);
      const result = await this.listMyQuery.execute({ userId, tenantId });
      const orders = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'My orders retrieved successfully',
        data: orders,
        meta: {
          pagination: {
            total: orders.length,
            limit: orders.length,
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
