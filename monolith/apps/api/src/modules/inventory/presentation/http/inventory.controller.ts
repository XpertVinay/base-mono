import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ListInventoryQuery, ReserveStockUseCase } from '../../application/use-cases/inventory.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const reserveStockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  orderId: z.string().min(1)
});

export class InventoryController {
  constructor(
    private readonly listInventoryQuery: ListInventoryQuery,
    private readonly reserveStockUseCase: ReserveStockUseCase
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listInventoryQuery.execute();
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

  reserve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = reserveStockSchema.parse(req.body);
      const result = await this.reserveStockUseCase.execute(validated);
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
