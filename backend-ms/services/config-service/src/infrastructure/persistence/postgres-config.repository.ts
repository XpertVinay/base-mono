import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { ConfigSetting } from '../../domain/entities/config.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresConfigRepository implements IConfigRepository {
  async getByKey(key: string, tenantId?: string): Promise<ConfigSetting | null> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT key, tenant_id, value, description, is_encrypted, updated_at
       FROM app_config.settings
       WHERE key = $1 AND (tenant_id = $2 OR tenant_id = 'default')
       ORDER BY CASE WHEN tenant_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [key, tid]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return ConfigSetting.create(row.key, {
      tenantId: row.tenant_id,
      value: row.value,
      description: row.description,
      isEncrypted: row.is_encrypted,
      updatedAt: new Date(row.updated_at)
    });
  }

  async getAll(tenantId?: string): Promise<ConfigSetting[]> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT DISTINCT ON (key) key, tenant_id, value, description, is_encrypted, updated_at
       FROM app_config.settings
       WHERE tenant_id = $1 OR tenant_id = 'default'
       ORDER BY key ASC, CASE WHEN tenant_id = $1 THEN 0 ELSE 1 END`,
      [tid]
    );
    return res.rows.map(row =>
      ConfigSetting.create(row.key, {
        tenantId: row.tenant_id,
        value: row.value,
        description: row.description,
        isEncrypted: row.is_encrypted,
        updatedAt: new Date(row.updated_at)
      })
    );
  }

  async save(setting: ConfigSetting): Promise<void> {
    await dbPool.query(
      `INSERT INTO app_config.settings (key, tenant_id, value, description, is_encrypted, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, key) DO UPDATE
       SET value = EXCLUDED.value, description = EXCLUDED.description,
           is_encrypted = EXCLUDED.is_encrypted, updated_at = EXCLUDED.updated_at`,
      [setting.key, setting.tenantId, setting.value, setting.description, setting.isEncrypted, setting.updatedAt]
    );
  }

  async delete(key: string, tenantId?: string): Promise<boolean> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      'DELETE FROM app_config.settings WHERE key = $1 AND tenant_id = $2',
      [key, tid]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
