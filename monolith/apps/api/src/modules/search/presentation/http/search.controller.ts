import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  SearchQueryUseCase,
  IndexDocumentUseCase,
  GetSearchDocumentByIdQuery,
  DeleteSearchDocumentUseCase
} from '../../application/use-cases/search.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const indexDocumentSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  tenantId: z.string().optional()
});

function extractTenantId(req: Request): string | undefined {
  const tenantId = (req as any).tenantId || req.headers['x-tenant-id'];
  if (typeof tenantId === 'string' && tenantId.trim().length > 0) {
    return tenantId.trim();
  }
  return undefined;
}

export class SearchController {
  constructor(
    private readonly searchQueryUseCase: SearchQueryUseCase,
    private readonly indexDocumentUseCase: IndexDocumentUseCase,
    private readonly getSearchDocumentByIdQuery: GetSearchDocumentByIdQuery,
    private readonly deleteSearchDocumentUseCase: DeleteSearchDocumentUseCase
  ) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req.query.q as string) || '';
      const type = req.query.type as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const tenantId = extractTenantId(req);

      const result = await this.searchQueryUseCase.execute({ query, type, limit, tenantId });
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

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const tenantId = extractTenantId(req);

      const result = await this.getSearchDocumentByIdQuery.execute({ id, tenantId });
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

  index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = indexDocumentSchema.parse(req.body);
      const tenantId = validated.tenantId || extractTenantId(req);

      const result = await this.indexDocumentUseCase.execute({
        id: validated.id || '',
        type: validated.type,
        title: validated.title,
        description: validated.description,
        metadata: validated.metadata,
        tenantId
      });
      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: { message: 'Document indexed successfully' },
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const tenantId = extractTenantId(req);

      const result = await this.deleteSearchDocumentUseCase.execute({ id, tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: { message: 'Document deleted successfully' },
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
