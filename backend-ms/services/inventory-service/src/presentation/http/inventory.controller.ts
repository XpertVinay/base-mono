import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ReserveInventoryUseCase,
  AddStockUseCase,
  GetStockQuery
} from '../../application/use-cases/inventory.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

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
      const result = await this.reserveUseCase.execute(validated);

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

  addStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = addStockSchema.parse(req.body);
      const result = await this.addStockUseCase.execute(validated);

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
