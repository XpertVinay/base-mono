import { IAssetRepository, AssetFilterOptions } from '../../domain/repositories/asset-repository.interface.js';
import { Asset } from '../../domain/entities/asset.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { AssetCategory, AssetStatus } from '@monolith/contracts';

export class PostgresAssetRepository implements IAssetRepository {
  private fallbackStore: Map<string, Asset> = new Map();

  async findById(id: string): Promise<Asset | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, name, mime_type, size_bytes, storage_path, owner_id, tenant_id, category, status, checksum, created_at, updated_at
         FROM asset.assets WHERE id = $1`,
        [id]
      );
      if (res.rows.length === 0) return this.fallbackStore.get(id) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByTenantId(tenantId: string, filter?: AssetFilterOptions): Promise<{ assets: Asset[]; total: number }> {
    const statusFilter = filter?.status ?? 'ACTIVE';
    const page = filter?.page && filter.page > 0 ? filter.page : 1;
    const limit = filter?.limit && filter.limit > 0 ? filter.limit : 20;
    const offset = (page - 1) * limit;

    try {
      const queryParams: unknown[] = [tenantId];
      let sql = `SELECT id, name, mime_type, size_bytes, storage_path, owner_id, tenant_id, category, status, checksum, created_at, updated_at
                 FROM asset.assets WHERE tenant_id = $1`;

      if (statusFilter !== 'ALL' as any) {
        queryParams.push(statusFilter);
        sql += ` AND status = $${queryParams.length}`;
      }

      if (filter?.category) {
        queryParams.push(filter.category);
        sql += ` AND category = $${queryParams.length}`;
      }

      sql += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, offset);

      const countRes = await dbPool.query(
        `SELECT COUNT(*) FROM asset.assets WHERE tenant_id = $1 ${
          statusFilter !== ('ALL' as any) ? `AND status = '${statusFilter}'` : ''
        } ${filter?.category ? `AND category = '${filter.category}'` : ''}`,
        [tenantId]
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const res = await dbPool.query(sql, queryParams);
      if (res.rows.length === 0 && this.fallbackStore.size > 0) {
        return this.queryFallback(tenantId, filter);
      }
      return {
        assets: res.rows.map(this.mapToDomain),
        total
      };
    } catch {
      return this.queryFallback(tenantId, filter);
    }
  }

  private queryFallback(tenantId: string, filter?: AssetFilterOptions): { assets: Asset[]; total: number } {
    const statusFilter = filter?.status ?? 'ACTIVE';
    const page = filter?.page && filter.page > 0 ? filter.page : 1;
    const limit = filter?.limit && filter.limit > 0 ? filter.limit : 20;

    let matching = Array.from(this.fallbackStore.values()).filter(a => a.tenantId === tenantId);

    if (statusFilter !== ('ALL' as any)) {
      matching = matching.filter(a => a.status === statusFilter);
    }

    if (filter?.category) {
      matching = matching.filter(a => a.category === filter.category);
    }

    matching.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = matching.length;
    const offset = (page - 1) * limit;
    const paginated = matching.slice(offset, offset + limit);

    return { assets: paginated, total };
  }

  async findByOwnerId(ownerId: string, tenantId?: string): Promise<Asset[]> {
    try {
      let sql = `SELECT id, name, mime_type, size_bytes, storage_path, owner_id, tenant_id, category, status, checksum, created_at, updated_at
                 FROM asset.assets WHERE owner_id = $1`;
      const params: unknown[] = [ownerId];
      if (tenantId) {
        params.push(tenantId);
        sql += ` AND tenant_id = $2`;
      }
      sql += ` ORDER BY created_at DESC`;

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(
          a => a.ownerId === ownerId && (!tenantId || a.tenantId === tenantId)
        );
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(
        a => a.ownerId === ownerId && (!tenantId || a.tenantId === tenantId)
      );
    }
  }

  async save(asset: Asset): Promise<void> {
    this.fallbackStore.set(asset.id, asset);
    try {
      await dbPool.query(
        `INSERT INTO asset.assets (id, name, mime_type, size_bytes, storage_path, owner_id, tenant_id, category, status, checksum, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           mime_type = EXCLUDED.mime_type,
           size_bytes = EXCLUDED.size_bytes,
           storage_path = EXCLUDED.storage_path,
           owner_id = EXCLUDED.owner_id,
           tenant_id = EXCLUDED.tenant_id,
           category = EXCLUDED.category,
           status = EXCLUDED.status,
           checksum = EXCLUDED.checksum,
           updated_at = EXCLUDED.updated_at`,
        [
          asset.id,
          asset.name,
          asset.mimeType,
          asset.sizeBytes,
          asset.storagePath,
          asset.ownerId,
          asset.tenantId,
          asset.category,
          asset.status,
          asset.checksum || null,
          asset.createdAt,
          asset.updatedAt
        ]
      );
    } catch {
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

  private mapToDomain = (row: any): Asset => {
    return Asset.reconstitute(row.id, {
      name: row.name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      storagePath: row.storage_path,
      ownerId: row.owner_id,
      tenantId: row.tenant_id || 'default-tenant',
      category: (row.category || 'GENERAL') as AssetCategory,
      status: (row.status || 'ACTIVE') as AssetStatus,
      checksum: row.checksum || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  };
}
