import { IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { IStorageProvider } from '../../domain/services/storage-provider.interface.js';
import { AssetDto } from '@monolith/contracts';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../../../shared/presentation/error-handler.middleware.js';

export interface GetAssetDownloadUrlInput {
  assetId: string;
  tenantId: string;
}

export class GetAssetDownloadUrlQuery implements IQuery<GetAssetDownloadUrlInput, AssetDto> {
  constructor(
    private readonly assetRepository: IAssetRepository,
    private readonly storageProvider: IStorageProvider
  ) {}

  async execute({ assetId, tenantId }: GetAssetDownloadUrlInput): Promise<Result<AssetDto, Error>> {
    try {
      const asset = await this.assetRepository.findById(assetId);
      if (!asset) {
        return Result.fail(new NotFoundError('Asset'));
      }

      if (asset.tenantId !== tenantId) {
        return Result.fail(new ForbiddenError('Access to asset across tenant boundary is prohibited'));
      }

      if (asset.status !== 'ACTIVE') {
        return Result.fail(new BadRequestError('Asset is not in ACTIVE state for download'));
      }

      const downloadUrl = await this.storageProvider.getDownloadUrl(asset.storagePath, 3600);

      return Result.ok({
        id: asset.id,
        tenantId: asset.tenantId,
        ownerId: asset.ownerId,
        name: asset.name,
        category: asset.category,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        storagePath: asset.storagePath,
        status: asset.status,
        checksum: asset.checksum,
        downloadUrl,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

