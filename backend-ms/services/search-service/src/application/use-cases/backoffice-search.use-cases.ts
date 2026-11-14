import { ISearchRepository, ListSearchDocumentsOptions } from '../../domain/repositories/search-repository.interface.js';
import { SearchDocument } from '../../domain/entities/search-document.entity.js';
import { Result } from '../../shared/domain/result.js';

export interface ListSearchDocumentsDTO extends ListSearchDocumentsOptions {
  tenantId?: string;
}

export interface GetSearchDocumentByIdDTO {
  id: string;
  tenantId?: string;
}

export interface CreateSearchDocumentDTO {
  id: string;
  documentType: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  tenantId?: string;
}

export interface UpdateSearchDocumentDTO {
  id: string;
  documentType?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
  tenantId?: string;
}

export interface DeleteSearchDocumentDTO {
  id: string;
  tenantId?: string;
}

export class ListSearchDocumentsQuery {
  constructor(private readonly repo: ISearchRepository) {}

  async execute(dto: ListSearchDocumentsDTO): Promise<Result<{ documents: any[]; total: number; page: number; limit: number }>> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const result = await this.repo.listAll({
      page,
      limit,
      type: dto.type,
      search: dto.search,
      tenantId: dto.tenantId
    });

    const mapped = result.documents.map(d => ({
      id: d.id,
      documentType: d.documentType,
      title: d.title,
      description: d.description,
      metadata: d.metadata,
      createdAt: d.createdAt,
      tenantId: d.tenantId
    }));

    return Result.ok({
      documents: mapped,
      total: result.total,
      page,
      limit
    });
  }
}

export class GetSearchDocumentByIdQuery {
  constructor(private readonly repo: ISearchRepository) {}

  async execute(dto: GetSearchDocumentByIdDTO): Promise<Result<any>> {
    const doc = await this.repo.findById(dto.id, dto.tenantId);
    if (!doc) {
      return Result.fail('Search document not found');
    }

    return Result.ok({
      id: doc.id,
      documentType: doc.documentType,
      title: doc.title,
      description: doc.description,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      tenantId: doc.tenantId
    });
  }
}

export class CreateSearchDocumentUseCase {
  constructor(private readonly repo: ISearchRepository) {}

  async execute(dto: CreateSearchDocumentDTO): Promise<Result<any>> {
    const existing = await this.repo.findById(dto.id, dto.tenantId);
    if (existing) {
      return Result.fail(`Search document with id ${dto.id} already exists`);
    }

    const doc = SearchDocument.create(dto.id, {
      documentType: dto.documentType,
      title: dto.title,
      description: dto.description,
      metadata: dto.metadata,
      tenantId: dto.tenantId
    });

    await this.repo.index(doc);

    return Result.ok({
      id: doc.id,
      documentType: doc.documentType,
      title: doc.title,
      description: doc.description,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      tenantId: doc.tenantId
    });
  }
}

export class UpdateSearchDocumentUseCase {
  constructor(private readonly repo: ISearchRepository) {}

  async execute(dto: UpdateSearchDocumentDTO): Promise<Result<any>> {
    const doc = await this.repo.findById(dto.id, dto.tenantId);
    if (!doc) {
      return Result.fail('Search document not found');
    }

    doc.update({
      documentType: dto.documentType,
      title: dto.title,
      description: dto.description,
      metadata: dto.metadata,
      tenantId: dto.tenantId
    });

    await this.repo.index(doc);

    return Result.ok({
      id: doc.id,
      documentType: doc.documentType,
      title: doc.title,
      description: doc.description,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      tenantId: doc.tenantId
    });
  }
}

export class DeleteSearchDocumentUseCase {
  constructor(private readonly repo: ISearchRepository) {}

  async execute(dto: DeleteSearchDocumentDTO): Promise<Result<{ id: string; deleted: boolean }>> {
    const doc = await this.repo.findById(dto.id, dto.tenantId);
    if (!doc) {
      return Result.fail('Search document not found');
    }

    const deleted = await this.repo.remove(dto.id, dto.tenantId);
    if (!deleted) {
      return Result.fail('Failed to delete search document');
    }

    return Result.ok({ id: dto.id, deleted: true });
  }
}
