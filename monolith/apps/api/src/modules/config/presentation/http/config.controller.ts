import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { GetConfigQuery, ListConfigsQuery, SetConfigUseCase } from '../../application/use-cases/config.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const setConfigSchema = z.object({
  key: z.string().min(2),
  value: z.string(),
  description: z.string().optional(),
  isEncrypted: z.boolean().optional()
});

export class ConfigController {
  constructor(
    private readonly getConfigQuery: GetConfigQuery,
    private readonly listConfigsQuery: ListConfigsQuery,
    private readonly setConfigUseCase: SetConfigUseCase
  ) {}

  getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listConfigsQuery.execute();
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

  getByKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.params.key);
      const result = await this.getConfigQuery.execute({ key });
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

  set = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = setConfigSchema.parse(req.body);
      const result = await this.setConfigUseCase.execute(validated);
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
