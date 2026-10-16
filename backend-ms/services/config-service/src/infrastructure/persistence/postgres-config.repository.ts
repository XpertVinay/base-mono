import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { ConfigSetting } from '../../domain/entities/config.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresConfigRepository implements IConfigRepository {
  async getByKey(key: string): Promise<ConfigSetting | null> {
    const res = await dbPool.query(
      'SELECT key, value, description, is_encrypted, updated_at FROM app_config.settings WHERE key = $1',
      [key]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return ConfigSetting.create(row.key, {
      value: row.value,
      description: row.description,
      isEncrypted: row.is_encrypted,
      updatedAt: new Date(row.updated_at)
    });
  }

  async getAll(): Promise<ConfigSetting[]> {
    const res = await dbPool.query(
      'SELECT key, value, description, is_encrypted, updated_at FROM app_config.settings ORDER BY key ASC'
    );
    return res.rows.map(row =>
      ConfigSetting.create(row.key, {
        value: row.value,
        description: row.description,
        isEncrypted: row.is_encrypted,
        updatedAt: new Date(row.updated_at)
      })
    );
  }

  async save(setting: ConfigSetting): Promise<void> {
    await dbPool.query(
      `INSERT INTO app_config.settings (key, value, description, is_encrypted, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, description = EXCLUDED.description,
           is_encrypted = EXCLUDED.is_encrypted, updated_at = EXCLUDED.updated_at`,
      [setting.key, setting.value, setting.description, setting.isEncrypted, setting.updatedAt]
    );
  }

  async delete(key: string): Promise<boolean> {
    const res = await dbPool.query('DELETE FROM app_config.settings WHERE key = $1', [key]);
    return (res.rowCount ?? 0) > 0;
  }
}
