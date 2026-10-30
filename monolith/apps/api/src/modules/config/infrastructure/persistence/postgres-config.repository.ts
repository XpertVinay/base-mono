import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { AppConfig, ConfigTarget } from '../../domain/entities/config.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

import { piiCryptoService } from '../security/pii-crypto.service.js';
import crypto from 'crypto';

export class PostgresConfigRepository implements IConfigRepository {
  private fallbackStore: Map<string, AppConfig> = new Map();
  private tenantSectionsStore: Map<string, Record<string, any>> = new Map();

  constructor() {
    // Populate default fallback configs (frequently used flags & modular sections)
    const defaults = [
      // Multi-tenancy
      AppConfig.create('TENANT_MULTI_TENANCY_ENABLED', 'true', 'Enable multi-tenant isolation', false, 'ALL'),
      AppConfig.create('TENANT_ISOLATION_MODE', 'ROW_LEVEL', 'Tenant isolation strategy (ROW_LEVEL | SCHEMA_LEVEL | DATABASE_LEVEL)', false, 'ALL'),
      AppConfig.create('TENANT_DEFAULT_ID', '00000000-0000-0000-0000-000000000001', 'Default tenant UUID fallback', false, 'ALL'),

      AppConfig.create('TENANT_HEADER_KEY', 'x-tenant-id', 'Header used to resolve tenant', false, 'ALL'),
      AppConfig.create('TENANT_SUBDOMAIN_ROUTING_ENABLED', 'false', 'Enable routing by tenant subdomain', false, 'ALL'),
      AppConfig.create('TENANT_MAX_TENANTS', '100', 'Maximum allowed active tenants', false, 'BACKEND'),
      AppConfig.create('TENANT_ENFORCE_ISOLATION', 'true', 'Enforce strict cross-tenant isolation checks', false, 'BACKEND'),

      // IAM & Asymmetric JWT
      AppConfig.create('IAM_JWT_ALGORITHM', 'RS256', 'JWT cryptographic algorithm (RS256 asymmetric | HS256 symmetric)', false, 'BACKEND'),
      AppConfig.create('IAM_JWT_PUBLIC_KEY', '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0mock-public-key\n-----END PUBLIC KEY-----', 'Asymmetric RSA public verification key (RS256)', false, 'ALL'),
      AppConfig.create('IAM_JWT_PRIVATE_KEY', '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0mock-private-key\n-----END RSA PRIVATE KEY-----', 'Asymmetric RSA private signing key (RS256)', true, 'BACKEND'),
      AppConfig.create('IAM_JWT_EXPIRES_IN', '1h', 'Access token lifetime', false, 'ALL'),
      AppConfig.create('IAM_JWT_REFRESH_EXPIRES_IN', '7d', 'Refresh token lifetime', false, 'BACKEND'),
      AppConfig.create('IAM_BCRYPT_SALT_ROUNDS', '10', 'Password hashing salt rounds', false, 'BACKEND'),
      AppConfig.create('IAM_MFA_ENABLED', 'false', 'Enforce multi-factor authentication', false, 'ALL'),
      AppConfig.create('IAM_PASSWORD_MIN_LENGTH', '8', 'Minimum password length required', false, 'ALL'),
      AppConfig.create('IAM_PASSWORD_REQUIRE_SPECIAL_CHAR', 'true', 'Require special character in password', false, 'ALL'),
      AppConfig.create('MAX_LOGIN_ATTEMPTS', '5', 'Max login attempts before temporary lockout', false, 'BACKEND'),
      AppConfig.create('IAM_LOCKOUT_DURATION_MINUTES', '15', 'Lockout duration minutes after failed attempts', false, 'BACKEND'),
      AppConfig.create('IAM_SESSION_TIMEOUT_MINUTES', '60', 'User session inactivity timeout', false, 'ALL'),

      // White-label
      AppConfig.create('WHITE_LABEL_BRAND_NAME', 'Real Estate CareTaking', 'White-label brand title', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_COMPANY_NAME', 'CareTaking Global Platform Inc.', 'Legal entity name', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_PORTAL_TITLE', 'CareTaking Portal', 'Browser and portal title', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_LOGO_URL', 'https://assets.monolith.local/logo.svg', 'Primary logo URL', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_FAVICON_URL', 'https://assets.monolith.local/favicon.ico', 'Favicon URL', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_PRIMARY_COLOR', '#6366f1', 'Brand primary color', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_SECONDARY_COLOR', '#0ea5e9', 'Brand secondary color', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_ACCENT_COLOR', '#10b981', 'Brand accent color', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_SUPPORT_EMAIL', 'support@caretaking.local', 'Customer support email', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_CUSTOM_DOMAIN_ENABLED', 'true', 'Allow tenants to bind custom domains', false, 'ALL'),
      AppConfig.create('WHITE_LABEL_EMAIL_FOOTER_TEXT', '© 2026 CareTaking Platform. All rights reserved.', 'Email footer copyright text', false, 'ALL'),

      // Asset
      AppConfig.create('ASSET_STORAGE_PROVIDER', 'LOCAL', 'Storage provider (LOCAL | S3 | GCS | MINIO)', false, 'BACKEND'),
      AppConfig.create('ASSET_BUCKET_NAME', 'monolith-assets-bucket', 'Object storage bucket name', false, 'BACKEND'),
      AppConfig.create('ASSET_REGION', 'us-east-1', 'Cloud storage region', false, 'BACKEND'),
      AppConfig.create('ASSET_CDN_BASE_URL', 'https://cdn.monolith.local/assets', 'CDN public delivery base URL', false, 'ALL'),
      AppConfig.create('ASSET_MAX_UPLOAD_SIZE_BYTES', '52428800', 'Maximum file upload size in bytes (50MB)', false, 'ALL'),
      AppConfig.create('ASSET_ALLOWED_MIME_TYPES', '["image/jpeg","image/png","image/webp","application/pdf"]', 'Allowed asset MIME types', false, 'ALL'),
      AppConfig.create('ASSET_PRESIGNED_URL_TTL_SECONDS', '3600', 'Presigned download URL expiration seconds', false, 'BACKEND'),
      AppConfig.create('ASSET_VIRUS_SCANNING_ENABLED', 'false', 'Enable anti-malware virus scanning on upload', false, 'BACKEND'),

      // Finance & Transactions
      AppConfig.create('DEFAULT_CURRENCY', 'USD', 'Default application currency code', false, 'ALL'),
      AppConfig.create('FINANCE_FISCAL_YEAR_START_MONTH', '1', 'Month index (1-12) where fiscal year commences', false, 'BACKEND'),
      AppConfig.create('FINANCE_TAX_RATE_PERCENTAGE', '18', 'Default transaction tax rate percentage', false, 'ALL'),
      AppConfig.create('FINANCE_AUDIT_LOGGING_ENABLED', 'true', 'Enable immutable financial audit matrix logging', false, 'BACKEND'),
      AppConfig.create('FINANCE_INVOICE_DUE_DAYS', '30', 'Standard invoice due date duration in days', false, 'BACKEND'),
      AppConfig.create('FINANCE_RECONCILIATION_SCHEDULE_CRON', '0 0 * * *', 'Daily financial reconciliation cron expression', false, 'BACKEND'),
      AppConfig.create('FINANCE_LEDGER_IMMUTABILITY_STRICT', 'true', 'Enforce write-only ledger immutability', false, 'BACKEND'),
      AppConfig.create('ACTIVE_PAYMENT_GATEWAY', 'STRIPE', 'Active payment gateway adapter (STRIPE | PAYPAL | RAZORPAY | MOCK)', false, 'ALL'),
      AppConfig.create('TRANSACTION_ENABLED_GATEWAYS', '["STRIPE","PAYPAL","RAZORPAY","MOCK"]', 'Supported payment gateways list', false, 'ALL'),
      AppConfig.create('TRANSACTION_STRIPE_PUBLIC_KEY', 'pk_test_sample', 'Stripe publishable API key', false, 'ALL'),
      AppConfig.create('TRANSACTION_STRIPE_WEBHOOK_SECRET', 'whsec_sample', 'Stripe webhook signing secret', true, 'BACKEND'),
      AppConfig.create('TRANSACTION_PAYPAL_CLIENT_ID', 'paypal_client_sample', 'PayPal Client ID for checkout orders', false, 'ALL'),
      AppConfig.create('TRANSACTION_RAZORPAY_KEY_ID', 'rzp_test_sample', 'Razorpay Key ID', false, 'ALL'),
      AppConfig.create('TRANSACTION_FEE_PERCENTAGE', '2.5', 'Gateway processing fee percentage', false, 'ALL'),
      AppConfig.create('TRANSACTION_AUTO_CAPTURE', 'true', 'Automatically capture authorized payments', false, 'BACKEND'),
      AppConfig.create('TRANSACTION_MAX_RETRY_ATTEMPTS', '3', 'Max retry attempts for failed transactions', false, 'BACKEND'),

      // Inventory
      AppConfig.create('INVENTORY_STOCK_TRACKING_ENABLED', 'true', 'Enable inventory stock tracking', false, 'BACKEND'),
      AppConfig.create('INVENTORY_LOW_STOCK_THRESHOLD', '10', 'Low stock alert threshold', false, 'BACKEND'),
      AppConfig.create('INVENTORY_AUTO_RESERVE_ON_ORDER', 'true', 'Reserve inventory units during order creation', false, 'BACKEND'),
      AppConfig.create('INVENTORY_RESERVATION_EXPIRY_MINUTES', '15', 'Time window before unfulfilled reservations expire', false, 'BACKEND'),
      AppConfig.create('INVENTORY_ALLOW_BACKORDERS', 'false', 'Allow purchases when stock is depleted', false, 'BACKEND'),
      AppConfig.create('INVENTORY_SERVICE_AVAILABILITY_BUFFER_MINUTES', '30', 'Buffer time between service appointments', false, 'BACKEND'),

      // Order
      AppConfig.create('ORDER_BOOKING_CONFIRMATION_MODE', 'AUTO', 'Confirmation strategy (MANUAL | AUTO)', false, 'BACKEND'),
      AppConfig.create('ORDER_CANCELLATION_WINDOW_HOURS', '24', 'Allowed cancellation window in hours', false, 'ALL'),
      AppConfig.create('ORDER_AUTO_EXPIRY_MINUTES', '30', 'Minutes before unpaid order expires', false, 'BACKEND'),
      AppConfig.create('ORDER_DEFAULT_STATUS_WORKFLOW', '["PENDING","CONFIRMED","PROCESSING","COMPLETED","CANCELLED"]', 'Allowed order status lifecycle stages', false, 'ALL'),
      AppConfig.create('ORDER_INVOICE_PREFIX', 'INV-', 'Prefix for generated order invoices', false, 'BACKEND'),
      AppConfig.create('ORDER_MINIMUM_ORDER_AMOUNT', '10', 'Minimum allowed transaction order amount', false, 'ALL'),

      // Property & Caretaking
      AppConfig.create('PROPERTY_DEFAULT_INSPECTION_INTERVAL_DAYS', '30', 'Routine caretaker inspection cycle in days', false, 'BACKEND'),
      AppConfig.create('PROPERTY_CARETAKING_SERVICE_TYPES', '["CLEANING","SECURITY_CHECK","GARDENING","MAINTENANCE_AUDIT","PEST_CONTROL"]', 'Supported caretaking operations', false, 'ALL'),
      AppConfig.create('PROPERTY_REQUIRE_APPROVAL_BEFORE_LISTING', 'true', 'Require administrative sign-off before property is published', false, 'BACKEND'),
      AppConfig.create('PROPERTY_MAX_PHOTOS_PER_PROPERTY', '25', 'Max gallery images per property unit', false, 'ALL'),
      AppConfig.create('PROPERTY_ENABLE_VIRTUAL_TOUR', 'true', 'Enable 3D virtual tour tab on properties', false, 'ALL'),
      AppConfig.create('PROPERTY_EMERGENCY_CONTACT_REQUIRED', 'true', 'Mandate 24/7 emergency contact details', false, 'ALL'),

      // Search
      AppConfig.create('SEARCH_ENGINE', 'POSTGRES_FTS', 'Full-text search engine (POSTGRES_FTS | ELASTICSEARCH | OPENSEARCH)', false, 'BACKEND'),
      AppConfig.create('SEARCH_ELASTIC_INDEX_PREFIX', 'monolith_search', 'Prefix for Elastic / Opensearch indices', false, 'BACKEND'),
      AppConfig.create('SEARCH_SEARCHABLE_ENTITIES', '["property","order","asset","transaction"]', 'Entities indexed for full-text search', false, 'ALL'),
      AppConfig.create('SEARCH_FUZZINESS_LEVEL', 'AUTO', 'Fuzzy matching parameter (AUTO | 0 | 1 | 2)', false, 'BACKEND'),
      AppConfig.create('SEARCH_HIGHLIGHT_ENABLED', 'true', 'Enable highlighted matching snippets in search response', false, 'ALL'),
      AppConfig.create('SEARCH_MAX_SEARCH_RESULTS', '50', 'Maximum search results per query page', false, 'ALL'),
      AppConfig.create('SEARCH_MINIMUM_MATCH_SCORE', '0.5', 'Minimum relevance score threshold', false, 'BACKEND'),

      // Scheduler
      AppConfig.create('SCHEDULER_CRON_ENGINE_ENABLED', 'true', 'Enable background cron task scheduler', false, 'BACKEND'),
      AppConfig.create('SCHEDULER_MAX_CONCURRENT_JOBS', '10', 'Max parallel background cron jobs', false, 'BACKEND'),
      AppConfig.create('SCHEDULER_JOB_RETRY_LIMIT', '3', 'Retry attempts before routing to Dead Letter Queue', false, 'BACKEND'),
      AppConfig.create('SCHEDULER_RETRY_BACKOFF_MULTIPLIER', '2', 'Exponential backoff factor for retries', false, 'BACKEND'),
      AppConfig.create('SCHEDULER_DEAD_LETTER_QUEUE_RETENTION_DAYS', '14', 'Days to retain failed jobs in DLQ', false, 'BACKEND'),
      AppConfig.create('SCHEDULER_POLL_INTERVAL_MS', '5000', 'Task polling interval in milliseconds', false, 'BACKEND'),

      // System Flags
      AppConfig.create('FEATURE_NEW_CHECKOUT', 'true', 'Enable new checkout state machine flow', false, 'ALL'),
      AppConfig.create('SYSTEM_MAINTENANCE_MODE', 'false', 'Enable maintenance mode', false, 'ALL'),
      AppConfig.create('APP_NAME', 'Real Estate CareTaking', 'Platform branding name', false, 'FRONTEND')
    ];
    defaults.forEach(d => this.fallbackStore.set(d.key, d));
  }

  async findByKey(key: string, tenantId?: string): Promise<AppConfig | null> {
    const k = key.toUpperCase().trim();

    // 1. If tenantId is provided, first query tenant-specific relational setting
    if (tenantId) {
      try {
        const tenantRes = await dbPool.query(
          `SELECT key, value, description, is_encrypted, COALESCE(target, 'ALL') as target, updated_at
           FROM app_config.settings
           WHERE (key = $1 AND tenant_id = $2) OR (key = $3)`,
          [k, tenantId, `TENANT_${tenantId.toUpperCase()}_${k}`]
        );
        if (tenantRes.rows.length > 0) {
          return this.mapToDomain(tenantRes.rows[0]);
        }
      } catch {
        // Continue to legacy tenant key check or global fallback
      }

      // Check legacy flat key fallback: TENANT_${tenantId}_${k}
      const legacyTenantKey = `TENANT_${tenantId.toUpperCase()}_${k}`;
      const legacyConfig = this.fallbackStore.get(legacyTenantKey);
      if (legacyConfig) return legacyConfig;
    }

    // 2. Query global setting (where tenant_id IS NULL or empty)
    try {
      const res = await dbPool.query(
        `SELECT key, value, description, is_encrypted, COALESCE(target, 'ALL') as target, updated_at
         FROM app_config.settings
         WHERE key = $1 AND (tenant_id IS NULL OR tenant_id = '')`,
        [k]
      );
      if (res.rows.length === 0) return this.fallbackStore.get(k) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      // Fallback query if column target does not exist yet
      try {
        const fallbackRes = await dbPool.query(
          'SELECT key, value, description, is_encrypted, updated_at FROM app_config.settings WHERE key = $1 AND (tenant_id IS NULL OR tenant_id = \'\')',
          [k]
        );
        if (fallbackRes.rows.length === 0) return this.fallbackStore.get(k) || null;
        return this.mapToDomain(fallbackRes.rows[0]);
      } catch {
        return this.fallbackStore.get(k) || null;
      }
    }
  }

  async findAll(): Promise<AppConfig[]> {
    try {
      const res = await dbPool.query(
        'SELECT key, value, description, is_encrypted, COALESCE(target, \'ALL\') as target, updated_at FROM app_config.settings WHERE (tenant_id IS NULL OR tenant_id = \'\') ORDER BY key ASC'
      );
      if (res.rows.length === 0) return Array.from(this.fallbackStore.values());
      return res.rows.map(r => this.mapToDomain(r));
    } catch {
      try {
        const fallbackRes = await dbPool.query(
          'SELECT key, value, description, is_encrypted, updated_at FROM app_config.settings WHERE (tenant_id IS NULL OR tenant_id = \'\') ORDER BY key ASC'
        );
        if (fallbackRes.rows.length === 0) return Array.from(this.fallbackStore.values());
        return fallbackRes.rows.map(r => this.mapToDomain(r));
      } catch {
        return Array.from(this.fallbackStore.values());
      }
    }
  }

  async findByTarget(target: ConfigTarget): Promise<AppConfig[]> {
    const all = await this.findAll();
    return all.filter(c => c.target === target || c.target === 'ALL');
  }

  async save(config: AppConfig, tenantId?: string): Promise<void> {
    const isTenantSpecific = !!tenantId;
    const dbKey = isTenantSpecific && !config.key.startsWith('TENANT_')
      ? `TENANT_${tenantId.toUpperCase()}_${config.key}`
      : config.key;

    this.fallbackStore.set(dbKey, config);

    // If config is sensitive, encrypt at rest before database write
    const storedValue = config.isEncrypted
      ? piiCryptoService.encryptAtRest(config.value)
      : config.value;

    try {
      await dbPool.query(
        `INSERT INTO app_config.settings (key, value, description, is_encrypted, target, tenant_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           description = EXCLUDED.description,
           is_encrypted = EXCLUDED.is_encrypted,
           target = EXCLUDED.target,
           tenant_id = EXCLUDED.tenant_id,
           updated_at = EXCLUDED.updated_at`,
        [dbKey, storedValue, config.description || null, config.isEncrypted, config.target, tenantId || null, config.updatedAt]
      );
    } catch {
      try {
        await dbPool.query(
          `INSERT INTO app_config.settings (key, value, description, is_encrypted, updated_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (key) DO UPDATE SET
             value = EXCLUDED.value,
             description = EXCLUDED.description,
             is_encrypted = EXCLUDED.is_encrypted,
             updated_at = EXCLUDED.updated_at`,
          [config.key, storedValue, config.description || null, config.isEncrypted, config.updatedAt]
        );
      } catch (err) {
        logger.warn('Failed to persist config in DB, saved in fallback store', { key: config.key });
      }
    }
  }

  /**
   * Database-driven relational section retrieval for custom tenant configuration.
   */
  async findTenantSection(tenantId: string, section: string): Promise<Record<string, any> | null> {
    const cacheKey = `${tenantId}:${section.toLowerCase()}`;
    const memData = this.tenantSectionsStore.get(cacheKey);
    if (memData) return memData;

    try {
      const res = await dbPool.query(
        `SELECT config_data, is_encrypted FROM app_config.tenant_configurations
         WHERE tenant_id = $1 AND section = $2`,
        [tenantId, section.toLowerCase()]
      );

      if (res.rows.length === 0) return null;

      const row = res.rows[0];
      let data = row.config_data;

      // Decrypt if stored encrypted at rest
      if (row.is_encrypted) {
        if (typeof data === 'string') {
          const decryptedStr = piiCryptoService.decryptAtRest(data);
          data = JSON.parse(decryptedStr);
        } else if (data && typeof data === 'object') {
          // If stored as JSON with encrypted values
          const decryptedObj: Record<string, any> = {};
          for (const [k, v] of Object.entries(data)) {
            decryptedObj[k] = typeof v === 'string' ? piiCryptoService.decryptAtRest(v) : v;
          }
          data = decryptedObj;
        }
      }

      this.tenantSectionsStore.set(cacheKey, data);
      return data;
    } catch {
      return this.tenantSectionsStore.get(cacheKey) || null;
    }
  }

  /**
   * Database-driven relational section persistence for newly onboarded tenants.
   */
  async saveTenantSection(tenantId: string, section: string, data: Record<string, any>, isEncrypted = false): Promise<void> {
    const cacheKey = `${tenantId}:${section.toLowerCase()}`;
    this.tenantSectionsStore.set(cacheKey, data);

    let storedData: any = data;
    if (isEncrypted) {
      storedData = JSON.stringify(piiCryptoService.encryptAtRest(JSON.stringify(data)));
    }

    try {
      const recordId = crypto.randomUUID();
      await dbPool.query(
        `INSERT INTO app_config.tenant_configurations (id, tenant_id, section, config_data, is_encrypted, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, section) DO UPDATE SET
           config_data = EXCLUDED.config_data,
           is_encrypted = EXCLUDED.is_encrypted,
           updated_at = CURRENT_TIMESTAMP`,
        [recordId, tenantId, section.toLowerCase(), storedData, isEncrypted]
      );
    } catch (err: any) {
      logger.warn('Failed to persist tenant section in DB, saved in fallback store', {
        tenantId,
        section,
        error: err?.message
      });
    }
  }

  async findAllTenantSections(tenantId: string): Promise<Record<string, Record<string, any>>> {
    const result: Record<string, Record<string, any>> = {};
    try {
      const res = await dbPool.query(
        `SELECT section, config_data, is_encrypted FROM app_config.tenant_configurations WHERE tenant_id = $1`,
        [tenantId]
      );
      for (const row of res.rows) {
        let data = row.config_data;
        if (row.is_encrypted && typeof data === 'string') {
          data = JSON.parse(piiCryptoService.decryptAtRest(data));
        }
        result[row.section] = data;
      }
    } catch {
      // In-memory fallback
      for (const [key, val] of this.tenantSectionsStore.entries()) {
        if (key.startsWith(`${tenantId}:`)) {
          const sec = key.split(':')[1];
          if (sec) {
            result[sec] = val;
          }
        }
      }
    }
    return result;
  }

  private mapToDomain(row: any): AppConfig {
    const rawVal = row.value;
    // Decrypt if stored encrypted at rest
    const decryptedVal = row.is_encrypted
      ? piiCryptoService.decryptAtRest(rawVal)
      : rawVal;

    return AppConfig.reconstitute(row.key, {
      value: decryptedVal,
      description: row.description,
      isEncrypted: row.is_encrypted,
      target: (row.target as ConfigTarget) || 'ALL',
      updatedAt: new Date(row.updated_at)
    });
  }
}


