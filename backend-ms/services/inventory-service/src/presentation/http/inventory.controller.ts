import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ReserveInventoryUseCase,
  AddStockUseCase,
  GetStockQuery
} from '../../application/use-cases/inventory.use-cases.js';

const reserveSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive()
});

const addStockSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive()
});

export class InventoryController {
  constructor(
    private readonly reserveUseCase: ReserveInventoryUseCase,
    private readonly addStockUseCase: AddStockUseCase,
    private readonly getStockQuery: GetStockQuery
  ) {}

  getStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const productId = req.params.productId as string;
      const result = await this.getStockQuery.execute({ productId });

      if (result.isFailure) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: result.getError() } });
        return;
      }

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  reserve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = reserveSchema.parse(req.body);
      const result = await this.reserveUseCase.execute(validated);

      if (result.isFailure) {
        res.status(400).json({ success: false, error: { code: 'STOCK_UNAVAILABLE', message: result.getError() } });
        return;
      }

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  addStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = addStockSchema.parse(req.body);
      const result = await this.addStockUseCase.execute(validated);

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };
}
