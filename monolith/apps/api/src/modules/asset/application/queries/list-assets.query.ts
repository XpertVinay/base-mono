import { IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { AssetDto } from '@monolith/contracts';

export class ListAssetsQuery implements IQuery<{ ownerId: string; tenantId?: string }, AssetDto[]> {
  constructor(private readonly assetRepository: IAssetRepository) {}

  async execute({ ownerId, tenantId }: { ownerId: string; tenantId?: string }): Promise<Result<AssetDto[], Error>> {
    try {
      const assets = await this.assetRepository.findByOwnerId(ownerId, tenantId);
      return Result.ok(assets.map(a => ({
        id: a.id,
        tenantId: a.tenantId,
        ownerId: a.ownerId,
        name: a.name,
        category: a.category,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        storagePath: a.storagePath,
        status: a.status,
        checksum: a.checksum,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
