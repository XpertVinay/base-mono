import path from 'node:path';
import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { Asset } from '../../domain/entities/asset.entity.js';
import { AssetDto } from '../../shared/contracts/index.js';

export interface CreateAssetInput {
  tenantId?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  ownerId: string;
}

export class CreateAssetUseCase implements UseCase<CreateAssetInput, AssetDto> {
  constructor(private readonly repo: IAssetRepository) {}

  async execute(input: CreateAssetInput): Promise<Result<AssetDto>> {
    if (input.storagePath) {
      if (input.storagePath.includes('\0') || input.storagePath.split(/[/\\]/).some(s => s === '..')) {
        return Result.fail('Invalid storagePath: path traversal or null bytes detected');
      }
    }
    const cleanStoragePath = path.posix.normalize(input.storagePath.replace(/\\/g, '/'));

    const asset = Asset.create({
      tenantId: input.tenantId,
      name: input.name,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: cleanStoragePath,
      ownerId: input.ownerId
    });

    await this.repo.save(asset);

    return Result.ok({
      id: asset.id,
      tenantId: asset.tenantId,
      name: asset.name,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      storagePath: asset.storagePath,
      ownerId: asset.ownerId,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString()
    });
  }
}
