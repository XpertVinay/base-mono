import { Request, Response, NextFunction } from 'express';
import { SearchQueryUseCase } from '../../application/use-cases/search.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

export class SearchController {
  constructor(private readonly searchQueryUseCase: SearchQueryUseCase) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = (req.query.q as string) || '';
      const type = req.query.type as string | undefined;

      const result = await this.searchQueryUseCase.execute({ query: q, type });
      const hits = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Search completed successfully',
        data: hits,
        meta: {
          pagination: {
            total: hits.length,
            limit: hits.length,
            page: 1,
            totalPages: 1
          },
          further_steps: hits.length === 0 ? ['Try broadening your search query string'] : []
        }
      });
    } catch (err) {
      next(err);
    }
  };
}
