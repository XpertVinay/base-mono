import { Asset } from '../entities/asset.entity.js';

export interface ListAssetsOptions {
  page?: number;
  limit?: number;
  search?: string;
  ownerId?: string;
}

export interface IAssetRepository {
  findById(id: string, tenantId?: string): Promise<Asset | null>;
  findByOwnerId(ownerId: string, tenantId?: string): Promise<Asset[]>;
  findAll(tenantId?: string, options?: ListAssetsOptions): Promise<{ assets: Asset[]; total: number }>;
  save(asset: Asset): Promise<void>;
  update(asset: Asset): Promise<void>;
  delete(id: string, tenantId?: string): Promise<boolean>;
}
