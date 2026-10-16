import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateOrderUseCase,
  CancelOrderUseCase,
  GetOrderByIdQuery,
  ListMyOrdersQuery
} from '../../application/commands/order.commands.js';
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
  currency: z.string().optional()
});

export class OrderController {
  constructor(
    private readonly createUseCase: CreateOrderUseCase,
    private readonly cancelUseCase: CancelOrderUseCase,
    private readonly getByIdQuery: GetOrderByIdQuery,
    private readonly listMyQuery: ListMyOrdersQuery
  ) {}

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
      const result = await this.createUseCase.execute({ ...validated, userId });

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

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id || (req.header('x-user-id') as string) || '';
      const role = req.user?.role || (req.header('x-user-role') as string) || 'USER';

      const result = await this.cancelUseCase.execute({ orderId: id, userId, role });
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

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id || (req.header('x-user-id') as string) || '';
      const role = req.user?.role || (req.header('x-user-role') as string) || 'USER';

      const result = await this.getByIdQuery.execute({ orderId: id, userId, role });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'id' }]
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

      const result = await this.listMyQuery.execute({ userId });
      const orders = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Orders retrieved successfully',
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
