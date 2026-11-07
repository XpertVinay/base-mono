import { Asset } from '../entities/asset.entity.js';
import { AssetCategory, AssetStatus } from '@monolith/contracts';

export interface AssetFilterOptions {
  category?: AssetCategory;
  status?: AssetStatus;
  page?: number;
  limit?: number;
}

export interface IAssetRepository {
  findById(id: string): Promise<Asset | null>;
  findByTenantId(tenantId: string, filter?: AssetFilterOptions): Promise<{ assets: Asset[]; total: number }>;
  findByOwnerId(ownerId: string, tenantId?: string): Promise<Asset[]>;
  save(asset: Asset): Promise<void>;
  delete(id: string): Promise<void>;
}
