import { IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { AssetDto } from '@monolith/contracts';

export class ListAssetsQuery implements IQuery<{ ownerId: string }, AssetDto[]> {
  constructor(private readonly assetRepository: IAssetRepository) {}

  async execute({ ownerId }: { ownerId: string }): Promise<Result<AssetDto[], Error>> {
    try {
      const assets = await this.assetRepository.findByOwnerId(ownerId);
      return Result.ok(assets.map(a => ({
        id: a.id,
        name: a.name,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        storagePath: a.storagePath,
        ownerId: a.ownerId,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
