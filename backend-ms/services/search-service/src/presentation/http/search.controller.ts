import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SearchQueryUseCase } from '../../application/use-cases/search.use-cases.js';
import {
  ListSearchDocumentsQuery,
  GetSearchDocumentByIdQuery,
  CreateSearchDocumentUseCase,
  UpdateSearchDocumentUseCase,
  DeleteSearchDocumentUseCase
} from '../../application/use-cases/backoffice-search.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const createDocumentSchema = z.object({
  id: z.string().min(1),
  documentType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const searchParamSchema = z.object({
  id: z.string().trim().min(1, 'Document ID is required')
});

const updateDocumentSchema = z.object({
  documentType: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.string().trim().optional(),
  search: z.string().trim().optional()
});

export class SearchController {
  constructor(
    private readonly searchQueryUseCase: SearchQueryUseCase,
    private readonly listAllQuery?: ListSearchDocumentsQuery,
    private readonly getByIdQuery?: GetSearchDocumentByIdQuery,
    private readonly createUseCase?: CreateSearchDocumentUseCase,
    private readonly updateUseCase?: UpdateSearchDocumentUseCase,
    private readonly deleteUseCase?: DeleteSearchDocumentUseCase
  ) {}

  private getTenantId(req: Request): string {
    return (req as any).tenant?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = (req.query.q as string) || '';
      const type = req.query.type as string | undefined;
      const tenantId = this.getTenantId(req);

      const result = await this.searchQueryUseCase.execute({ query: q, type, tenantId });
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

  listDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.listAllQuery) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'List search documents not implemented' });
        return;
      }

      const queryParams = listDocumentsQuerySchema.parse(req.query);
      const tenantId = this.getTenantId(req);
      const result = await this.listAllQuery.execute({
        page: queryParams.page,
        limit: queryParams.limit,
        type: queryParams.type,
        search: queryParams.search,
        tenantId
      });

      const { documents, total, page, limit } = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Search documents retrieved successfully',
        data: documents,
        meta: {
          pagination: {
            total,
            limit,
            page,
            totalPages: Math.ceil(total / limit) || 1
          }
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getDocumentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.getByIdQuery) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Get search document by ID not implemented' });
        return;
      }

      const { id } = searchParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);
      const result = await this.getByIdQuery.execute({ id, tenantId });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'DOCUMENT_NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Search document retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  createDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.createUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Create search document not implemented' });
        return;
      }

      const validated = createDocumentSchema.parse(req.body);
      const tenantId = this.getTenantId(req);
      const result = await this.createUseCase.execute({ ...validated, tenantId });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'DOCUMENT_CREATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Search document created and indexed successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  updateDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Update search document not implemented' });
        return;
      }

      const { id } = searchParamSchema.parse(req.params);
      const validated = updateDocumentSchema.parse(req.body);
      const tenantId = this.getTenantId(req);

      const result = await this.updateUseCase.execute({ id, ...validated, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'DOCUMENT_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Search document updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  deleteDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.deleteUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Delete search document not implemented' });
        return;
      }

      const { id } = searchParamSchema.parse(req.params);
      const tenantId = this.getTenantId(req);
      const result = await this.deleteUseCase.execute({ id, tenantId });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'DOCUMENT_DELETE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Search document deleted successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
