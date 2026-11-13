import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { AssetDto } from '../../shared/contracts/index.js';

export interface ListAssetsInput {
  ownerId: string;
  tenantId?: string;
}

export class ListAssetsQuery implements UseCase<ListAssetsInput, AssetDto[]> {
  constructor(private readonly repo: IAssetRepository) {}

  async execute(input: ListAssetsInput): Promise<Result<AssetDto[]>> {
    const assets = await this.repo.findByOwnerId(input.ownerId, input.tenantId);
    return Result.ok(
      assets.map(a => ({
        id: a.id,
        tenantId: a.tenantId,
        name: a.name,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        storagePath: a.storagePath,
        ownerId: a.ownerId,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString()
      }))
    );
  }
}
