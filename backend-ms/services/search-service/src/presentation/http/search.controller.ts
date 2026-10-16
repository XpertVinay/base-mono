import { Request, Response, NextFunction } from 'express';
import { SearchQueryUseCase } from '../../application/use-cases/search.use-cases.js';

export class SearchController {
  constructor(private readonly searchQueryUseCase: SearchQueryUseCase) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = (req.query.q as string) || '';
      const type = req.query.type as string | undefined;

      const result = await this.searchQueryUseCase.execute({ query: q, type });
      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };
}
