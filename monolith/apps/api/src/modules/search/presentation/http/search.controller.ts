import { Request, Response, NextFunction } from 'express';
import { SearchQueryUseCase } from '../../application/use-cases/search.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

export class SearchController {
  constructor(private readonly searchQueryUseCase: SearchQueryUseCase) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req.query.q as string) || '';
      const type = req.query.type as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const result = await this.searchQueryUseCase.execute({ query, type, limit });
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
