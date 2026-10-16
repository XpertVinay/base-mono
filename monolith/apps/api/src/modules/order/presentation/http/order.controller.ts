import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateOrderUseCase, CancelOrderUseCase, GetOrderByIdQuery, ListMyOrdersQuery } from '../../application/commands/order.commands.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    productName: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive()
  })).min(1),
  currency: z.string().optional()
});

export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly getOrderByIdQuery: GetOrderByIdQuery,
    private readonly listMyOrdersQuery: ListMyOrdersQuery
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createOrderSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await this.createOrderUseCase.execute({ ...validated, userId });

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
      const orderId = String(req.params.id);
      const userId = req.user!.id;
      const role = req.user!.role;

      const result = await this.getOrderByIdQuery.execute({ orderId, userId, role });
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
      const userId = req.user!.id;
      const result = await this.listMyOrdersQuery.execute({ userId });
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
      const orderId = String(req.params.id);
      const userId = req.user!.id;
      const role = req.user!.role;

      const result = await this.cancelOrderUseCase.execute({ orderId, userId, role });
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
