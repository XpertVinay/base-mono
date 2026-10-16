import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateOrderUseCase,
  CancelOrderUseCase,
  GetOrderByIdQuery,
  ListMyOrdersQuery
} from '../../application/commands/order.commands.js';

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
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const validated = createOrderSchema.parse(req.body);
      const result = await this.createUseCase.execute({ ...validated, userId });

      if (result.isFailure) {
        res.status(400).json({ success: false, error: { code: 'ORDER_CREATION_FAILED', message: result.getError() } });
        return;
      }

      res.status(201).json({ success: true, data: result.getValue() });
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
        res.status(400).json({ success: false, error: { code: 'CANCEL_FAILED', message: result.getError() } });
        return;
      }

      res.status(200).json({ success: true, data: result.getValue() });
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
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: result.getError() } });
        return;
      }

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  listMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id || (req.header('x-user-id') as string);
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const result = await this.listMyQuery.execute({ userId });
      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };
}
