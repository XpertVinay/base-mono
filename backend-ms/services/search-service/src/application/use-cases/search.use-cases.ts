import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { ISearchRepository } from '../../domain/repositories/search-repository.interface.js';
import { SearchDocument } from '../../domain/entities/search-document.entity.js';
import { SearchResultItemDto } from '../../shared/contracts/index.js';

export interface IndexDocumentInput {
  id: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
}

export class IndexDocumentUseCase implements UseCase<IndexDocumentInput, void> {
  constructor(private readonly repo: ISearchRepository) {}

  async execute(input: IndexDocumentInput): Promise<Result<void>> {
    const doc = SearchDocument.create(input.id, {
      documentType: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata
    });

    await this.repo.index(doc);
    return Result.ok(undefined);
  }
}

export interface SearchQueryInput {
  query: string;
  type?: string;
}

export class SearchQueryUseCase implements UseCase<SearchQueryInput, SearchResultItemDto[]> {
  constructor(private readonly repo: ISearchRepository) {}

  async execute(input: SearchQueryInput): Promise<Result<SearchResultItemDto[]>> {
    const docs = await this.repo.search(input.query, input.type);
    return Result.ok(
      docs.map(d => ({
        id: d.id,
        type: d.documentType,
        title: d.title,
        description: d.description,
        metadata: d.metadata
      }))
    );
  }
}
