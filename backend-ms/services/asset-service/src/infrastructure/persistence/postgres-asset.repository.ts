import { IAssetRepository } from '../../domain/repositories/asset-repository.interface.js';
import { Asset } from '../../domain/entities/asset.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresAssetRepository implements IAssetRepository {
  async findById(id: string): Promise<Asset | null> {
    const res = await dbPool.query(
      'SELECT id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at FROM asset.assets WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return Asset.create(
      {
        name: row.name,
        mimeType: row.mime_type,
        sizeBytes: parseInt(row.size_bytes, 10),
        storagePath: row.storage_path,
        ownerId: row.owner_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }

  async findByOwnerId(ownerId: string): Promise<Asset[]> {
    const res = await dbPool.query(
      'SELECT id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at FROM asset.assets WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    return res.rows.map(row =>
      Asset.create(
        {
          name: row.name,
          mimeType: row.mime_type,
          sizeBytes: parseInt(row.size_bytes, 10),
          storagePath: row.storage_path,
          ownerId: row.owner_id,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        },
        row.id
      )
    );
  }

  async save(asset: Asset): Promise<void> {
    await dbPool.query(
      `INSERT INTO asset.assets (id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [asset.id, asset.name, asset.mimeType, asset.sizeBytes, asset.storagePath, asset.ownerId, asset.createdAt, asset.updatedAt]
    );
  }

  async delete(id: string): Promise<boolean> {
    const res = await dbPool.query('DELETE FROM asset.assets WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}
