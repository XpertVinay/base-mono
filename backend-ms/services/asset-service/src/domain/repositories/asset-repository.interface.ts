import { Asset } from '../entities/asset.entity.js';

export interface IAssetRepository {
  findById(id: string, tenantId?: string): Promise<Asset | null>;
  findByOwnerId(ownerId: string, tenantId?: string): Promise<Asset[]>;
  save(asset: Asset): Promise<void>;
  delete(id: string, tenantId?: string): Promise<boolean>;
}
