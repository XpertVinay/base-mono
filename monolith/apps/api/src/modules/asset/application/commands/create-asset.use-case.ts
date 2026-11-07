import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { Asset } from '../../domain/entities/asset.entity.js';
import { CreateAssetRequestDto, AssetDto } from '@monolith/contracts';

export interface CreateAssetInput extends CreateAssetRequestDto {
  ownerId: string;
}

export class CreateAssetUseCase implements IUseCase<CreateAssetInput, AssetDto> {
  constructor(private readonly assetRepository: IAssetRepository) {}

  async execute(input: CreateAssetInput): Promise<Result<AssetDto, Error>> {
    try {
      const asset = Asset.create({
        name: input.name,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storagePath: input.storagePath,
        ownerId: input.ownerId,
        tenantId: input.tenantId || 'default-tenant',
        category: input.category || 'GENERAL',
        status: 'ACTIVE'
      });

      await this.assetRepository.save(asset);

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
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
