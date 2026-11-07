import { IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { AssetDto, AssetCategory, AssetStatus } from '@monolith/contracts';
import { BadRequestError } from '../../../../shared/presentation/error-handler.middleware.js';

export interface ListTenantAssetsInput {
  tenantId: string;
  category?: AssetCategory;
  status?: AssetStatus;
  page?: number;
  limit?: number;
}

export interface ListTenantAssetsOutput {
  assets: AssetDto[];
  total: number;
  page: number;
  limit: number;
}

export class ListTenantAssetsQuery implements IQuery<ListTenantAssetsInput, ListTenantAssetsOutput> {
  constructor(private readonly assetRepository: IAssetRepository) {}

  async execute(input: ListTenantAssetsInput): Promise<Result<ListTenantAssetsOutput, Error>> {
    try {
      if (!input.tenantId) {
        return Result.fail(new BadRequestError('Tenant ID is required'));
      }

      const page = input.page && input.page > 0 ? input.page : 1;
      const limit = input.limit && input.limit > 0 ? input.limit : 20;
      // Default to ACTIVE assets only unless caller explicitly asks for a different status
      const status = input.status || 'ACTIVE';

      const result = await this.assetRepository.findByTenantId(input.tenantId, {
        category: input.category,
        status,
        page,
        limit
      });

      const dtos: AssetDto[] = result.assets.map(a => ({
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
      }));

      return Result.ok({
        assets: dtos,
        total: result.total,
        page,
        limit
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

