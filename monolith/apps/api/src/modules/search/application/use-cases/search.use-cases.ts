import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ISearchRepository } from '../../domain/repositories/search-repository.interface.js';
import { SearchDocument } from '../../domain/entities/search-document.entity.js';
import { SearchQueryDto, SearchResultItemDto } from '@monolith/contracts';

export class IndexDocumentUseCase implements IUseCase<{ type: string; title: string; description?: string; metadata?: Record<string, unknown>; id?: string }, void> {
  constructor(private readonly repository: ISearchRepository) {}

  async execute(input: { type: string; title: string; description?: string; metadata?: Record<string, unknown>; id?: string }): Promise<Result<void, Error>> {
    try {
      const doc = SearchDocument.create(input.type, input.title, input.description, input.metadata, input.id);
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
      const docs = await this.repository.search(input.query, input.type, input.limit || 20);
      return Result.ok(docs.map(d => ({
        id: d.id,
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
