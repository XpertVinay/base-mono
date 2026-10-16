import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateAssetUseCase } from '../../application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from '../../application/queries/list-assets.query.js';

const createAssetSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().positive(),
  storagePath: z.string().min(1)
});

export class AssetController {
  constructor(
    private readonly createUseCase: CreateAssetUseCase,
    private readonly listQuery: ListAssetsQuery
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user?.id || (req.header('x-user-id') as string);
      if (!ownerId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const validated = createAssetSchema.parse(req.body);
      const result = await this.createUseCase.execute({ ...validated, ownerId });

      res.status(201).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  listMyAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user?.id || (req.header('x-user-id') as string);
      if (!ownerId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const result = await this.listQuery.execute({ ownerId });
      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };
}
