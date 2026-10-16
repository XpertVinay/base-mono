import { Asset } from '../entities/asset.entity.js';

export interface IAssetRepository {
  findById(id: string): Promise<Asset | null>;
  findByOwnerId(ownerId: string): Promise<Asset[]>;
  save(asset: Asset): Promise<void>;
  delete(id: string): Promise<boolean>;
}
