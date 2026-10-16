import { Router } from 'express';
import { PostgresAssetRepository } from './infrastructure/persistence/postgres-asset.repository.js';
import { CreateAssetUseCase } from './application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from './application/queries/list-assets.query.js';
import { AssetController } from './presentation/http/asset.controller.js';
import { createAssetRouter } from './presentation/http/asset.routes.js';
import { container } from '../../bootstrap/container.js';
import { AssetDto } from '@monolith/contracts';

export interface IAssetModulePublicApi {
  getAssetById(id: string): Promise<AssetDto | null>;
}

export class AssetModule {
  public static init(): { router: Router; publicApi: IAssetModulePublicApi } {
    const repository = new PostgresAssetRepository();
    const createAssetUseCase = new CreateAssetUseCase(repository);
    const listAssetsQuery = new ListAssetsQuery(repository);

    const controller = new AssetController(createAssetUseCase, listAssetsQuery);
    const router = createAssetRouter(controller);

    const publicApi: IAssetModulePublicApi = {
      getAssetById: async (id: string) => {
        const asset = await repository.findById(id);
        if (!asset) return null;
        return {
          id: asset.id,
          name: asset.name,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          storagePath: asset.storagePath,
          ownerId: asset.ownerId,
          createdAt: asset.createdAt.toISOString(),
          updatedAt: asset.updatedAt.toISOString()
        };
      }
    };

    container.register('IAssetModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
