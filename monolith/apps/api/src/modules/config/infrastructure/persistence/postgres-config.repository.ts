import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { AppConfig } from '../../domain/entities/config.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresConfigRepository implements IConfigRepository {
  private fallbackStore: Map<string, AppConfig> = new Map();

  constructor() {
    // Populate default fallback configs
    const defaults = [
      AppConfig.create('ACTIVE_PAYMENT_GATEWAY', 'STRIPE', 'Active payment gateway adapter (STRIPE | PAYPAL | RAZORPAY | MOCK)'),
      AppConfig.create('FEATURE_NEW_CHECKOUT', 'true', 'Enable new checkout state machine flow'),
      AppConfig.create('MAX_LOGIN_ATTEMPTS', '5', 'Max login attempts before temporary lockout'),
      AppConfig.create('SYSTEM_MAINTENANCE_MODE', 'false', 'Enable maintenance mode')
    ];
    defaults.forEach(d => this.fallbackStore.set(d.key, d));
  }

  async findByKey(key: string): Promise<AppConfig | null> {
    const k = key.toUpperCase().trim();
    try {
      const res = await dbPool.query(
        'SELECT key, value, description, is_encrypted, updated_at FROM app_config.settings WHERE key = $1',
        [k]
      );
      if (res.rows.length === 0) return this.fallbackStore.get(k) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(k) || null;
    }
  }

  async findAll(): Promise<AppConfig[]> {
    try {
      const res = await dbPool.query(
        'SELECT key, value, description, is_encrypted, updated_at FROM app_config.settings ORDER BY key ASC'
      );
      if (res.rows.length === 0) return Array.from(this.fallbackStore.values());
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values());
    }
  }

  async save(config: AppConfig): Promise<void> {
    this.fallbackStore.set(config.key, config);
    try {
      await dbPool.query(
        `INSERT INTO app_config.settings (key, value, description, is_encrypted, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           description = EXCLUDED.description,
           is_encrypted = EXCLUDED.is_encrypted,
           updated_at = EXCLUDED.updated_at`,
        [config.key, config.value, config.description || null, config.isEncrypted, config.updatedAt]
      );
    } catch (err) {
      logger.warn('Failed to persist config in DB, saved in fallback store', { key: config.key });
    }
  }

  private mapToDomain(row: any): AppConfig {
    return AppConfig.reconstitute(row.key, {
      value: row.value,
      description: row.description,
      isEncrypted: row.is_encrypted,
      updatedAt: new Date(row.updated_at)
    });
  }
}
