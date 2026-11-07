import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { IStorageProvider } from '../../domain/services/storage-provider.interface.js';
import { AssetValidationService } from '../../domain/services/asset-validation.service.js';
import { buildTenantStoragePath } from '../../domain/services/storage-path.util.js';
import { Asset } from '../../domain/entities/asset.entity.js';
import { AssetCategory, PresignUploadResponseDto } from '@monolith/contracts';
import { BadRequestError } from '../../../../shared/presentation/error-handler.middleware.js';
import { v4 as uuidv4 } from 'uuid';

export interface RequestPresignedUploadInput {
  name: string;
  category: AssetCategory;
  mimeType: string;
  sizeBytes: number;
  tenantId: string;
  ownerId: string;
  checksum?: string;
}

export class RequestPresignedUploadUseCase implements IUseCase<RequestPresignedUploadInput, PresignUploadResponseDto> {
  constructor(
    private readonly assetRepository: IAssetRepository,
    private readonly storageProvider: IStorageProvider
  ) {}

  async execute(input: RequestPresignedUploadInput): Promise<Result<PresignUploadResponseDto, Error>> {
    try {
      if (!input.tenantId) {
        return Result.fail(new BadRequestError('Tenant ID is required for asset upload'));
      }

      if (!input.ownerId) {
        return Result.fail(new BadRequestError('Owner ID is required for asset upload'));
      }

      const validation = AssetValidationService.validateFile(input.name, input.mimeType, input.sizeBytes);
      if (!validation.valid) {
        return Result.fail(new BadRequestError(validation.error || 'Invalid file metadata'));
      }

      const storageKey = buildTenantStoragePath(input.tenantId, input.category, uuidv4(), input.name);

      const presigned = await this.storageProvider.generatePresignedUploadUrl(
        storageKey,
        input.mimeType,
        900 // 15 minutes expiration
      );

      const asset = Asset.create({
        name: input.name,
        category: input.category,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storagePath: presigned.storagePath,
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        status: 'PENDING_UPLOAD',
        checksum: input.checksum
      });

      await this.assetRepository.save(asset);

      return Result.ok({
        assetId: asset.id,
        uploadUrl: presigned.uploadUrl,
        storagePath: presigned.storagePath,
        expiresInSeconds: 900,
        requiredHeaders: {
          'Content-Type': input.mimeType
        }
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

