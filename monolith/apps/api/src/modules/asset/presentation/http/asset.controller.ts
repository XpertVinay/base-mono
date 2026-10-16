import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateAssetUseCase } from '../../application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from '../../application/queries/list-assets.query.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const createAssetSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().positive(),
  storagePath: z.string().min(1)
});

export class AssetController {
  constructor(
    private readonly createAssetUseCase: CreateAssetUseCase,
    private readonly listAssetsQuery: ListAssetsQuery
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createAssetSchema.parse(req.body);
      const ownerId = req.user!.id;
      const result = await this.createAssetUseCase.execute({ ...validated, ownerId });

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

  listMyAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.id;
      const result = await this.listAssetsQuery.execute({ ownerId });

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
