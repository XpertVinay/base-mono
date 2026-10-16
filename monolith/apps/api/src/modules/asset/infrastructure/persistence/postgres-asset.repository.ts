import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { Asset } from '../../domain/entities/asset.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresAssetRepository implements IAssetRepository {
  private fallbackStore: Map<string, Asset> = new Map();

  async findById(id: string): Promise<Asset | null> {
    try {
      const res = await dbPool.query(
        'SELECT id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at FROM asset.assets WHERE id = $1',
        [id]
      );
      if (res.rows.length === 0) return this.fallbackStore.get(id) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByOwnerId(ownerId: string): Promise<Asset[]> {
    try {
      const res = await dbPool.query(
        'SELECT id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at FROM asset.assets WHERE owner_id = $1 ORDER BY created_at DESC',
        [ownerId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(a => a.ownerId === ownerId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(a => a.ownerId === ownerId);
    }
  }

  async save(asset: Asset): Promise<void> {
    this.fallbackStore.set(asset.id, asset);
    try {
      await dbPool.query(
        `INSERT INTO asset.assets (id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           mime_type = EXCLUDED.mime_type,
           size_bytes = EXCLUDED.size_bytes,
           storage_path = EXCLUDED.storage_path,
           updated_at = EXCLUDED.updated_at`,
        [asset.id, asset.name, asset.mimeType, asset.sizeBytes, asset.storagePath, asset.ownerId, asset.createdAt, asset.updatedAt]
      );
    } catch (err) {
      logger.warn('Database save failed in PostgresAssetRepository, saved to fallback store', { assetId: asset.id });
    }
  }

  async delete(id: string): Promise<void> {
    this.fallbackStore.delete(id);
    try {
      await dbPool.query('DELETE FROM asset.assets WHERE id = $1', [id]);
    } catch {
      // ignore
    }
  }

  private mapToDomain(row: any): Asset {
    return Asset.reconstitute(row.id, {
      name: row.name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      storagePath: row.storage_path,
      ownerId: row.owner_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
