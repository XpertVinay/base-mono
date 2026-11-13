import { IAssetRepository, ListAssetsOptions } from '../../domain/repositories/asset-repository.interface.js';
import { Result } from '../../shared/domain/result.js';

export interface ListAllAssetsDTO extends ListAssetsOptions {
  tenantId?: string;
}

export interface GetAssetByIdDTO {
  id: string;
  tenantId?: string;
}

export interface UpdateAssetDTO {
  id: string;
  tenantId?: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  storagePath?: string;
}

export interface DeleteAssetDTO {
  id: string;
  tenantId?: string;
}

export class ListAllAssetsQuery {
  constructor(private readonly repo: IAssetRepository) {}

  async execute(dto: ListAllAssetsDTO): Promise<Result<{ assets: any[]; total: number; page: number; limit: number }>> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const result = await this.repo.findAll(dto.tenantId, {
      page,
      limit,
      search: dto.search,
      ownerId: dto.ownerId
    });

    const mapped = result.assets.map(a => ({
      id: a.id,
      tenantId: a.tenantId,
      name: a.name,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      storagePath: a.storagePath,
      ownerId: a.ownerId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt
    }));

    return Result.ok({
      assets: mapped,
      total: result.total,
      page,
      limit
    });
  }
}

export class GetAssetByIdQuery {
  constructor(private readonly repo: IAssetRepository) {}

  async execute(dto: GetAssetByIdDTO): Promise<Result<any>> {
    const asset = await this.repo.findById(dto.id, dto.tenantId);
    if (!asset) {
      return Result.fail('Asset not found');
    }
    return Result.ok({
      id: asset.id,
      tenantId: asset.tenantId,
      name: asset.name,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      storagePath: asset.storagePath,
      ownerId: asset.ownerId,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt
    });
  }
}

export class UpdateAssetUseCase {
  constructor(private readonly repo: IAssetRepository) {}

  async execute(dto: UpdateAssetDTO): Promise<Result<any>> {
    const asset = await this.repo.findById(dto.id, dto.tenantId);
    if (!asset) {
      return Result.fail('Asset not found');
    }

    asset.update({
      name: dto.name,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      storagePath: dto.storagePath
    });

    await this.repo.update(asset);

    return Result.ok({
      id: asset.id,
      tenantId: asset.tenantId,
      name: asset.name,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      storagePath: asset.storagePath,
      ownerId: asset.ownerId,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt
    });
  }
}

export class DeleteAssetUseCase {
  constructor(private readonly repo: IAssetRepository) {}

  async execute(dto: DeleteAssetDTO): Promise<Result<{ id: string; deleted: boolean }>> {
    const asset = await this.repo.findById(dto.id, dto.tenantId);
    if (!asset) {
      return Result.fail('Asset not found');
    }

    const deleted = await this.repo.delete(dto.id, dto.tenantId);
    if (!deleted) {
      return Result.fail('Failed to delete asset');
    }

    return Result.ok({ id: dto.id, deleted: true });
  }
}
