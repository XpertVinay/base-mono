import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { IStorageProvider } from '../../domain/services/storage-provider.interface.js';
import { AssetDto } from '@monolith/contracts';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../../../shared/presentation/error-handler.middleware.js';

export interface ConfirmAssetUploadInput {
  assetId: string;
  tenantId: string;
  checksum?: string;
}

export class ConfirmAssetUploadUseCase implements IUseCase<ConfirmAssetUploadInput, AssetDto> {
  constructor(
    private readonly assetRepository: IAssetRepository,
    private readonly storageProvider: IStorageProvider
  ) {}

  async execute(input: ConfirmAssetUploadInput): Promise<Result<AssetDto, Error>> {
    try {
      const asset = await this.assetRepository.findById(input.assetId);
      if (!asset) {
        return Result.fail(new NotFoundError('Asset'));
      }

      if (asset.tenantId !== input.tenantId) {
        return Result.fail(new ForbiddenError('Access to asset across tenant boundary is prohibited'));
      }

      const exists = await this.storageProvider.fileExists(asset.storagePath);
      if (!exists) {
        return Result.fail(new BadRequestError('Uploaded file does not exist in storage'));
      }

      asset.markActive(input.checksum);
      await this.assetRepository.save(asset);

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

