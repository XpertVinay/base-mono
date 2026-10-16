import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { AssetDto } from '../../shared/contracts/index.js';

export class ListAssetsQuery implements UseCase<{ ownerId: string }, AssetDto[]> {
  constructor(private readonly repo: IAssetRepository) {}

  async execute(input: { ownerId: string }): Promise<Result<AssetDto[]>> {
    const assets = await this.repo.findByOwnerId(input.ownerId);
    return Result.ok(
      assets.map(a => ({
        id: a.id,
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
