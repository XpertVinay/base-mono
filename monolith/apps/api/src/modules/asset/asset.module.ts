import { Router } from 'express';
import { PostgresAssetRepository } from './infrastructure/persistence/postgres-asset.repository.js';
import { LocalStorageProvider } from './infrastructure/storage/local-storage.provider.js';
import { StorageProviderFactory } from './infrastructure/storage/storage-provider.factory.js';
import { RequestPresignedUploadUseCase } from './application/commands/request-presigned-upload.use-case.js';
import { ConfirmAssetUploadUseCase } from './application/commands/confirm-asset-upload.use-case.js';
import { GetAssetDownloadUrlQuery } from './application/queries/get-asset-download-url.query.js';
import { ListTenantAssetsQuery } from './application/queries/list-tenant-assets.query.js';
import { DeleteAssetUseCase } from './application/commands/delete-asset.use-case.js';
import { CreateAssetUseCase } from './application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from './application/queries/list-assets.query.js';
import { AssetController } from './presentation/http/asset.controller.js';
import { createAssetRouter } from './presentation/http/asset.routes.js';
import { container } from '../../bootstrap/container.js';
import { AssetDto } from '@monolith/contracts';
import { IStorageProvider } from './domain/services/storage-provider.interface.js';
import { IAssetRepository } from './domain/repositories/asset-repository.interface.js';

export interface IAssetModulePublicApi {
  getAssetById(id: string): Promise<AssetDto | null>;
  getDownloadUrl(storagePath: string, expiresInSeconds?: number): Promise<string>;
  getStorageProvider(): IStorageProvider;
  getRepository(): IAssetRepository;
}

export class AssetModule {
  public static init(customStorageProvider?: IStorageProvider): {
    router: Router;
    publicApi: IAssetModulePublicApi;
    storageProvider: IStorageProvider;
    repository: IAssetRepository;
  } {
    const repository = new PostgresAssetRepository();
    const storageProvider = customStorageProvider || StorageProviderFactory.createFromEnv();

    const requestPresignedUploadUseCase = new RequestPresignedUploadUseCase(repository, storageProvider);
    const confirmAssetUploadUseCase = new ConfirmAssetUploadUseCase(repository, storageProvider);
    const getAssetDownloadUrlQuery = new GetAssetDownloadUrlQuery(repository, storageProvider);
    const listTenantAssetsQuery = new ListTenantAssetsQuery(repository);
    const deleteAssetUseCase = new DeleteAssetUseCase(repository, storageProvider);
    const createAssetUseCase = new CreateAssetUseCase(repository);
    const listAssetsQuery = new ListAssetsQuery(repository);

    const controller = new AssetController(
      requestPresignedUploadUseCase,
      confirmAssetUploadUseCase,
      getAssetDownloadUrlQuery,
      listTenantAssetsQuery,
      deleteAssetUseCase,
      createAssetUseCase,
      listAssetsQuery,
      storageProvider instanceof LocalStorageProvider ? storageProvider : undefined
    );

    const router = createAssetRouter(controller);

    const publicApi: IAssetModulePublicApi = {
      getAssetById: async (id: string): Promise<AssetDto | null> => {
        const asset = await repository.findById(id);
        if (!asset) return null;
        const downloadUrl = await storageProvider.getDownloadUrl(asset.storagePath, 3600);
        return {
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
        };
      },
      getDownloadUrl: async (storagePath: string, expiresInSeconds = 3600): Promise<string> => {
        return storageProvider.getDownloadUrl(storagePath, expiresInSeconds);
      },
      getStorageProvider: () => storageProvider,
      getRepository: () => repository
    };

    container.register('IAssetModulePublicApi', publicApi);
    container.register('IStorageProvider', storageProvider);

    return { router, publicApi, storageProvider, repository };
  }
}
