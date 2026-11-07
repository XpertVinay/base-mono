import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { IStorageProvider } from '../../domain/services/storage-provider.interface.js';
import { NotFoundError, ForbiddenError } from '../../../../shared/presentation/error-handler.middleware.js';

export interface DeleteAssetInput {
  assetId: string;
  tenantId: string;
}

export class DeleteAssetUseCase implements IUseCase<DeleteAssetInput, { success: boolean; assetId: string }> {
  constructor(
    private readonly assetRepository: IAssetRepository,
    private readonly storageProvider: IStorageProvider
  ) {}

  async execute(input: DeleteAssetInput): Promise<Result<{ success: boolean; assetId: string }, Error>> {
    try {
      const asset = await this.assetRepository.findById(input.assetId);
      if (!asset) {
        return Result.fail(new NotFoundError('Asset'));
      }

      if (asset.tenantId !== input.tenantId) {
        return Result.fail(new ForbiddenError('Access to asset across tenant boundary is prohibited'));
      }

      asset.markArchived();
      await this.assetRepository.save(asset);
      await this.storageProvider.deleteFile(asset.storagePath);

      return Result.ok({ success: true, assetId: asset.id });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

