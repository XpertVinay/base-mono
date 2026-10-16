import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  GetConfigQuery,
  SetConfigUseCase,
  ListConfigsQuery,
  DeleteConfigUseCase
} from '../../application/use-cases/config.use-cases.js';

const setConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  description: z.string().optional(),
  isEncrypted: z.boolean().optional()
});

export class ConfigController {
  constructor(
    private readonly getQuery: GetConfigQuery,
    private readonly setUseCase: SetConfigUseCase,
    private readonly listQuery: ListConfigsQuery,
    private readonly deleteUseCase: DeleteConfigUseCase
  ) {}

  getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listQuery.execute();
      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  getByKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = req.params.key as string;
      const defaultValue = req.query.default as string | undefined;
      const result = await this.getQuery.execute({ key, defaultValue });

      if (result.isFailure) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: result.getError() } });
        return;
      }

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  set = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = setConfigSchema.parse(req.body);
      const result = await this.setUseCase.execute(validated);

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = req.params.key as string;
      const result = await this.deleteUseCase.execute({ key });

      if (result.isFailure) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: result.getError() } });
        return;
      }

      res.status(200).json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  };
}
