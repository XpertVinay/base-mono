import { IAssetRepository, ListAssetsOptions } from '../../domain/repositories/asset-repository.interface.js';
import { Asset } from '../../domain/entities/asset.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresAssetRepository implements IAssetRepository {
  async findById(id: string, tenantId?: string): Promise<Asset | null> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT id, tenant_id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at
       FROM asset.assets
       WHERE id = $1 AND (tenant_id = $2 OR tenant_id = 'default')
       ORDER BY CASE WHEN tenant_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [id, tid]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return Asset.create(
      {
        tenantId: row.tenant_id,
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

  async findByOwnerId(ownerId: string, tenantId?: string): Promise<Asset[]> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT id, tenant_id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at
       FROM asset.assets
       WHERE owner_id = $1 AND (tenant_id = $2 OR tenant_id = 'default')
       ORDER BY created_at DESC`,
      [ownerId, tid]
    );
    return res.rows.map(row =>
      Asset.create(
        {
          tenantId: row.tenant_id,
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

  async findAll(tenantId?: string, options: ListAssetsOptions = {}): Promise<{ assets: Asset[]; total: number }> {
    const tid = tenantId || 'default';
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["(tenant_id = $1 OR tenant_id = 'default')"];
    const params: any[] = [tid];

    if (options.ownerId) {
      params.push(options.ownerId);
      conditions.push(`owner_id = $${params.length}`);
    }

    if (options.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(name ILIKE $${params.length} OR mime_type ILIKE $${params.length})`);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await dbPool.query(
      `SELECT COUNT(*) as count FROM asset.assets WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const res = await dbPool.query(
      `SELECT id, tenant_id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at
       FROM asset.assets
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const assets = res.rows.map(row =>
      Asset.create(
        {
          tenantId: row.tenant_id,
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

    return { assets, total };
  }

  async save(asset: Asset): Promise<void> {
    await dbPool.query(
      `INSERT INTO asset.assets (id, tenant_id, name, mime_type, size_bytes, storage_path, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        asset.id,
        asset.tenantId,
        asset.name,
        asset.mimeType,
        asset.sizeBytes,
        asset.storagePath,
        asset.ownerId,
        asset.createdAt,
        asset.updatedAt
      ]
    );
  }

  async update(asset: Asset): Promise<void> {
    await dbPool.query(
      `UPDATE asset.assets
       SET name = $1, mime_type = $2, size_bytes = $3, storage_path = $4, updated_at = $5
       WHERE id = $6 AND (tenant_id = $7 OR tenant_id = 'default')`,
      [
        asset.name,
        asset.mimeType,
        asset.sizeBytes,
        asset.storagePath,
        asset.updatedAt,
        asset.id,
        asset.tenantId
      ]
    );
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      'DELETE FROM asset.assets WHERE id = $1 AND (tenant_id = $2 OR tenant_id = \'default\')',
      [id, tid]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
