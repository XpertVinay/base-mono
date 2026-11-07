import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ISearchRepository } from '../../domain/repositories/search-repository.interface.js';
import { SearchDocument } from '../../domain/entities/search-document.entity.js';
import { SearchQueryDto, SearchResultItemDto, IndexDocumentRequestDto } from '@monolith/contracts';
import { NotFoundError } from '../../../../shared/presentation/error-handler.middleware.js';

export class IndexDocumentUseCase implements IUseCase<IndexDocumentRequestDto, void> {
  constructor(private readonly repository: ISearchRepository) {}

  async execute(input: IndexDocumentRequestDto): Promise<Result<void, Error>> {
    try {
      const doc = SearchDocument.create(
        input.type,
        input.title,
        input.description,
        input.metadata,
        input.tenantId,
        input.id
      );
      await this.repository.index(doc);
      return Result.ok(undefined);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class SearchQueryUseCase implements IQuery<SearchQueryDto, SearchResultItemDto[]> {
  constructor(private readonly repository: ISearchRepository) {}

  async execute(input: SearchQueryDto): Promise<Result<SearchResultItemDto[], Error>> {
    try {
      const docs = await this.repository.search(input.query, input.type, input.limit || 20, input.tenantId);
      return Result.ok(docs.map(d => ({
        id: d.id,
        tenantId: d.tenantId,
        type: d.documentType,
        title: d.title,
        description: d.description,
        metadata: d.metadata
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetSearchDocumentByIdQuery implements IQuery<{ id: string; tenantId?: string }, SearchResultItemDto> {
  constructor(private readonly repository: ISearchRepository) {}

  async execute({ id, tenantId }: { id: string; tenantId?: string }): Promise<Result<SearchResultItemDto, Error>> {
    try {
      const doc = await this.repository.findById(id, tenantId);
      if (!doc) {
        return Result.fail(new NotFoundError(`Search document with id '${id}'`));
      }
      return Result.ok({
        id: doc.id,
        tenantId: doc.tenantId,
        type: doc.documentType,
        title: doc.title,
        description: doc.description,
        metadata: doc.metadata
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class DeleteSearchDocumentUseCase implements IUseCase<{ id: string; tenantId?: string }, void> {
  constructor(private readonly repository: ISearchRepository) {}

  async execute({ id, tenantId }: { id: string; tenantId?: string }): Promise<Result<void, Error>> {
    try {
      await this.repository.delete(id, tenantId);
      return Result.ok(undefined);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
