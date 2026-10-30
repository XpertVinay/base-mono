import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { AppConfig } from '../../domain/entities/config.entity.js';
import {
  ConfigSection,
  TenantConfigDto,
  IamConfigDto,
  WhiteLabelConfigDto,
  AssetConfigDto,
  FinanceConfigDto,
  TransactionConfigDto,
  InventoryConfigDto,
  OrderConfigDto,
  PropertyConfigDto,
  SearchConfigDto,
  SchedulerConfigDto,
  SectionConfigMap
} from '@monolith/contracts';

export class SectionConfigService {
  constructor(private readonly repository: IConfigRepository) {}

  private async getVal(key: string, defaultVal: string, tenantId?: string): Promise<string> {
    const config = await this.repository.findByKey(key, tenantId);
    if (config && config.value) return config.value;
    return defaultVal;
  }

  private async getBool(key: string, defaultVal: boolean, tenantId?: string): Promise<boolean> {
    const v = await this.getVal(key, String(defaultVal), tenantId);
    return v.toLowerCase() === 'true';
  }

  private async getNum(key: string, defaultVal: number, tenantId?: string): Promise<number> {
    const v = await this.getVal(key, String(defaultVal), tenantId);
    const n = Number(v);
    return isNaN(n) ? defaultVal : n;
  }

  private async getJson<T>(key: string, defaultVal: T, tenantId?: string): Promise<T> {
    const v = await this.getVal(key, '', tenantId);
    if (!v) return defaultVal;
    try {
      return JSON.parse(v) as T;
    } catch {
      return defaultVal;
    }
  }

  private async applyTenantDbOverrides<T extends Record<string, any>>(section: ConfigSection, base: T, tenantId?: string): Promise<T> {
    if (!tenantId) return base;
    const dbSection = await this.repository.findTenantSection(tenantId, section);
    if (dbSection) {
      return { ...base, ...dbSection };
    }
    return base;
  }

  public async getTenantConfig(tenantId?: string): Promise<TenantConfigDto> {
    const base: TenantConfigDto = {
      multiTenancyEnabled: await this.getBool('TENANT_MULTI_TENANCY_ENABLED', true, tenantId),
      isolationMode: (await this.getVal('TENANT_ISOLATION_MODE', 'ROW_LEVEL', tenantId)) as any,
      defaultTenantId: await this.getVal('TENANT_DEFAULT_ID', '00000000-0000-0000-0000-000000000001', tenantId),
      headerKey: await this.getVal('TENANT_HEADER_KEY', 'x-tenant-id', tenantId),
      subdomainRoutingEnabled: await this.getBool('TENANT_SUBDOMAIN_ROUTING_ENABLED', false, tenantId),
      maxTenants: await this.getNum('TENANT_MAX_TENANTS', 100, tenantId),
      enforceTenantIsolation: await this.getBool('TENANT_ENFORCE_ISOLATION', true, tenantId)
    };
    return this.applyTenantDbOverrides('tenant', base, tenantId);
  }

  public async getIamConfig(tenantId?: string): Promise<IamConfigDto> {
    const base: IamConfigDto = {
      jwtAlgorithm: (await this.getVal('IAM_JWT_ALGORITHM', 'RS256', tenantId)) as 'RS256' | 'HS256',
      jwtPublicKey: await this.getVal('IAM_JWT_PUBLIC_KEY', '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0mock-public-key\n-----END PUBLIC KEY-----', tenantId),
      jwtPrivateKey: await this.getVal('IAM_JWT_PRIVATE_KEY', '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0mock-private-key\n-----END RSA PRIVATE KEY-----', tenantId),
      jwtExpiresIn: await this.getVal('IAM_JWT_EXPIRES_IN', '1h', tenantId),
      jwtRefreshExpiresIn: await this.getVal('IAM_JWT_REFRESH_EXPIRES_IN', '7d', tenantId),
      bcryptSaltRounds: await this.getNum('IAM_BCRYPT_SALT_ROUNDS', 10, tenantId),
      mfaEnabled: await this.getBool('IAM_MFA_ENABLED', false, tenantId),
      passwordMinLength: await this.getNum('IAM_PASSWORD_MIN_LENGTH', 8, tenantId),
      passwordRequireSpecialChar: await this.getBool('IAM_PASSWORD_REQUIRE_SPECIAL_CHAR', true, tenantId),
      maxLoginAttempts: await this.getNum('MAX_LOGIN_ATTEMPTS', 5, tenantId),
      lockoutDurationMinutes: await this.getNum('IAM_LOCKOUT_DURATION_MINUTES', 15, tenantId),
      sessionTimeoutMinutes: await this.getNum('IAM_SESSION_TIMEOUT_MINUTES', 60, tenantId)
    };
    return this.applyTenantDbOverrides('iam', base, tenantId);
  }

  public async getWhiteLabelConfig(tenantId?: string): Promise<WhiteLabelConfigDto> {
    const base: WhiteLabelConfigDto = {
      brandName: await this.getVal('WHITE_LABEL_BRAND_NAME', 'Real Estate CareTaking', tenantId),
      companyName: await this.getVal('WHITE_LABEL_COMPANY_NAME', 'CareTaking Global Platform Inc.', tenantId),
      portalTitle: await this.getVal('WHITE_LABEL_PORTAL_TITLE', 'CareTaking Portal', tenantId),
      logoUrl: await this.getVal('WHITE_LABEL_LOGO_URL', 'https://assets.monolith.local/logo.svg', tenantId),
      faviconUrl: await this.getVal('WHITE_LABEL_FAVICON_URL', 'https://assets.monolith.local/favicon.ico', tenantId),
      primaryColor: await this.getVal('WHITE_LABEL_PRIMARY_COLOR', '#6366f1', tenantId),
      secondaryColor: await this.getVal('WHITE_LABEL_SECONDARY_COLOR', '#0ea5e9', tenantId),
      accentColor: await this.getVal('WHITE_LABEL_ACCENT_COLOR', '#10b981', tenantId),
      supportEmail: await this.getVal('WHITE_LABEL_SUPPORT_EMAIL', 'support@caretaking.local', tenantId),
      customDomainEnabled: await this.getBool('WHITE_LABEL_CUSTOM_DOMAIN_ENABLED', true, tenantId),
      emailFooterText: await this.getVal('WHITE_LABEL_EMAIL_FOOTER_TEXT', '© 2026 CareTaking Platform. All rights reserved.', tenantId)
    };
    return this.applyTenantDbOverrides('white-label', base, tenantId);
  }

  public async getAssetConfig(tenantId?: string): Promise<AssetConfigDto> {
    const base: AssetConfigDto = {
      storageProvider: (await this.getVal('ASSET_STORAGE_PROVIDER', 'LOCAL', tenantId)) as any,
      bucketName: await this.getVal('ASSET_BUCKET_NAME', 'monolith-assets-bucket', tenantId),
      region: await this.getVal('ASSET_REGION', 'us-east-1', tenantId),
      cdnBaseUrl: await this.getVal('ASSET_CDN_BASE_URL', 'https://cdn.monolith.local/assets', tenantId),
      maxUploadSizeBytes: await this.getNum('ASSET_MAX_UPLOAD_SIZE_BYTES', 52428800, tenantId),
      allowedMimeTypes: await this.getJson<string[]>('ASSET_ALLOWED_MIME_TYPES', [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
      ], tenantId),
      presignedUrlTtlSeconds: await this.getNum('ASSET_PRESIGNED_URL_TTL_SECONDS', 3600, tenantId),
      virusScanningEnabled: await this.getBool('ASSET_VIRUS_SCANNING_ENABLED', false, tenantId)
    };
    return this.applyTenantDbOverrides('asset', base, tenantId);
  }

  public async getFinanceConfig(tenantId?: string): Promise<FinanceConfigDto> {
    const base: FinanceConfigDto = {
      defaultCurrency: await this.getVal('DEFAULT_CURRENCY', 'USD', tenantId),
      fiscalYearStartMonth: await this.getNum('FINANCE_FISCAL_YEAR_START_MONTH', 1, tenantId),
      taxRatePercentage: await this.getNum('FINANCE_TAX_RATE_PERCENTAGE', 18, tenantId),
      auditLoggingEnabled: await this.getBool('FINANCE_AUDIT_LOGGING_ENABLED', true, tenantId),
      invoiceDueDays: await this.getNum('FINANCE_INVOICE_DUE_DAYS', 30, tenantId),
      reconciliationScheduleCron: await this.getVal('FINANCE_RECONCILIATION_SCHEDULE_CRON', '0 0 * * *', tenantId),
      ledgerImmutabilityStrict: await this.getBool('FINANCE_LEDGER_IMMUTABILITY_STRICT', true, tenantId)
    };
    return this.applyTenantDbOverrides('finance', base, tenantId);
  }

  public async getTransactionConfig(tenantId?: string): Promise<TransactionConfigDto> {
    const base: TransactionConfigDto = {
      activePaymentGateway: (await this.getVal('ACTIVE_PAYMENT_GATEWAY', 'STRIPE', tenantId)) as any,
      enabledGateways: await this.getJson<string[]>('TRANSACTION_ENABLED_GATEWAYS', [
        'STRIPE',
        'PAYPAL',
        'RAZORPAY',
        'MOCK'
      ], tenantId),
      stripePublicKey: await this.getVal('TRANSACTION_STRIPE_PUBLIC_KEY', 'pk_test_sample', tenantId),
      stripeWebhookSecret: await this.getVal('TRANSACTION_STRIPE_WEBHOOK_SECRET', 'whsec_sample', tenantId),
      paypalClientId: await this.getVal('TRANSACTION_PAYPAL_CLIENT_ID', 'paypal_client_sample', tenantId),
      razorpayKeyId: await this.getVal('TRANSACTION_RAZORPAY_KEY_ID', 'rzp_test_sample', tenantId),
      transactionFeePercentage: await this.getNum('TRANSACTION_FEE_PERCENTAGE', 2.5, tenantId),
      autoCapture: await this.getBool('TRANSACTION_AUTO_CAPTURE', true, tenantId),
      maxRetryAttempts: await this.getNum('TRANSACTION_MAX_RETRY_ATTEMPTS', 3, tenantId)
    };
    return this.applyTenantDbOverrides('transaction', base, tenantId);
  }

  public async getInventoryConfig(tenantId?: string): Promise<InventoryConfigDto> {
    const base: InventoryConfigDto = {
      stockTrackingEnabled: await this.getBool('INVENTORY_STOCK_TRACKING_ENABLED', true, tenantId),
      lowStockThreshold: await this.getNum('INVENTORY_LOW_STOCK_THRESHOLD', 10, tenantId),
      autoReserveOnOrder: await this.getBool('INVENTORY_AUTO_RESERVE_ON_ORDER', true, tenantId),
      reservationExpiryMinutes: await this.getNum('INVENTORY_RESERVATION_EXPIRY_MINUTES', 15, tenantId),
      allowBackorders: await this.getBool('INVENTORY_ALLOW_BACKORDERS', false, tenantId),
      serviceAvailabilityBufferMinutes: await this.getNum('INVENTORY_SERVICE_AVAILABILITY_BUFFER_MINUTES', 30, tenantId)
    };
    return this.applyTenantDbOverrides('inventory', base, tenantId);
  }

  public async getOrderConfig(tenantId?: string): Promise<OrderConfigDto> {
    const base: OrderConfigDto = {
      bookingConfirmationMode: (await this.getVal('ORDER_BOOKING_CONFIRMATION_MODE', 'AUTO', tenantId)) as any,
      cancellationWindowHours: await this.getNum('ORDER_CANCELLATION_WINDOW_HOURS', 24, tenantId),
      orderAutoExpiryMinutes: await this.getNum('ORDER_AUTO_EXPIRY_MINUTES', 30, tenantId),
      defaultOrderStatusWorkflow: await this.getJson<string[]>('ORDER_DEFAULT_STATUS_WORKFLOW', [
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'COMPLETED',
        'CANCELLED'
      ], tenantId),
      invoicePrefix: await this.getVal('ORDER_INVOICE_PREFIX', 'INV-', tenantId),
      minimumOrderAmount: await this.getNum('ORDER_MINIMUM_ORDER_AMOUNT', 10, tenantId)
    };
    return this.applyTenantDbOverrides('order', base, tenantId);
  }

  public async getPropertyConfig(tenantId?: string): Promise<PropertyConfigDto> {
    const base: PropertyConfigDto = {
      defaultInspectionIntervalDays: await this.getNum('PROPERTY_DEFAULT_INSPECTION_INTERVAL_DAYS', 30, tenantId),
      caretakingServiceTypes: await this.getJson<string[]>('PROPERTY_CARETAKING_SERVICE_TYPES', [
        'CLEANING',
        'SECURITY_CHECK',
        'GARDENING',
        'MAINTENANCE_AUDIT',
        'PEST_CONTROL'
      ], tenantId),
      requireApprovalBeforeListing: await this.getBool('PROPERTY_REQUIRE_APPROVAL_BEFORE_LISTING', true, tenantId),
      maxPhotosPerProperty: await this.getNum('PROPERTY_MAX_PHOTOS_PER_PROPERTY', 25, tenantId),
      enableVirtualTour: await this.getBool('PROPERTY_ENABLE_VIRTUAL_TOUR', true, tenantId),
      emergencyContactRequired: await this.getBool('PROPERTY_EMERGENCY_CONTACT_REQUIRED', true, tenantId)
    };
    return this.applyTenantDbOverrides('property', base, tenantId);
  }

  public async getSearchConfig(tenantId?: string): Promise<SearchConfigDto> {
    const base: SearchConfigDto = {
      searchEngine: (await this.getVal('SEARCH_ENGINE', 'POSTGRES_FTS', tenantId)) as any,
      elasticIndexPrefix: await this.getVal('SEARCH_ELASTIC_INDEX_PREFIX', 'monolith_search', tenantId),
      searchableEntities: await this.getJson<string[]>('SEARCH_SEARCHABLE_ENTITIES', [
        'property',
        'order',
        'asset',
        'transaction'
      ], tenantId),
      fuzzinessLevel: (await this.getVal('SEARCH_FUZZINESS_LEVEL', 'AUTO', tenantId)) as any,
      highlightEnabled: await this.getBool('SEARCH_HIGHLIGHT_ENABLED', true, tenantId),
      maxSearchResults: await this.getNum('SEARCH_MAX_SEARCH_RESULTS', 50, tenantId),
      minimumMatchScore: await this.getNum('SEARCH_MINIMUM_MATCH_SCORE', 0.5, tenantId)
    };
    return this.applyTenantDbOverrides('search', base, tenantId);
  }

  public async getSchedulerConfig(tenantId?: string): Promise<SchedulerConfigDto> {
    const base: SchedulerConfigDto = {
      cronEngineEnabled: await this.getBool('SCHEDULER_CRON_ENGINE_ENABLED', true, tenantId),
      maxConcurrentJobs: await this.getNum('SCHEDULER_MAX_CONCURRENT_JOBS', 10, tenantId),
      jobRetryLimit: await this.getNum('SCHEDULER_JOB_RETRY_LIMIT', 3, tenantId),
      retryBackoffMultiplier: await this.getNum('SCHEDULER_RETRY_BACKOFF_MULTIPLIER', 2, tenantId),
      deadLetterQueueRetentionDays: await this.getNum('SCHEDULER_DEAD_LETTER_QUEUE_RETENTION_DAYS', 14, tenantId),
      pollIntervalMs: await this.getNum('SCHEDULER_POLL_INTERVAL_MS', 5000, tenantId)
    };
    return this.applyTenantDbOverrides('scheduler', base, tenantId);
  }

  public async getSection<K extends ConfigSection>(
    section: K,
    tenantId?: string
  ): Promise<SectionConfigMap[K]> {
    switch (section) {
      case 'tenant':
        return (await this.getTenantConfig(tenantId)) as SectionConfigMap[K];
      case 'iam':
        return (await this.getIamConfig(tenantId)) as SectionConfigMap[K];
      case 'white-label':
        return (await this.getWhiteLabelConfig(tenantId)) as SectionConfigMap[K];
      case 'asset':
        return (await this.getAssetConfig(tenantId)) as SectionConfigMap[K];
      case 'finance':
        return (await this.getFinanceConfig(tenantId)) as SectionConfigMap[K];
      case 'transaction':
        return (await this.getTransactionConfig(tenantId)) as SectionConfigMap[K];
      case 'inventory':
        return (await this.getInventoryConfig(tenantId)) as SectionConfigMap[K];
      case 'order':
        return (await this.getOrderConfig(tenantId)) as SectionConfigMap[K];
      case 'property':
        return (await this.getPropertyConfig(tenantId)) as SectionConfigMap[K];
      case 'search':
        return (await this.getSearchConfig(tenantId)) as SectionConfigMap[K];
      case 'scheduler':
        return (await this.getSchedulerConfig(tenantId)) as SectionConfigMap[K];
      default:
        throw new Error(`Unknown configuration section: ${section}`);
    }
  }

  public async updateSection<K extends ConfigSection>(
    section: K,
    payload: Partial<SectionConfigMap[K]>,
    tenantId?: string
  ): Promise<SectionConfigMap[K]> {
    // 1. If tenantId is present, persist relational section in tenant_configurations table
    if (tenantId) {
      const isEncrypted = section === 'iam' || section === 'transaction';
      await this.repository.saveTenantSection(tenantId, section, payload as Record<string, any>, isEncrypted);
    }

    for (const [propKey, propVal] of Object.entries(payload)) {
      if (propVal === undefined) continue;
      const formattedKey = this.toConfigKey(section, propKey);
      const stringValue = typeof propVal === 'object' ? JSON.stringify(propVal) : String(propVal);

      const target = (section === 'white-label' || section === 'tenant' || section === 'property')
        ? 'ALL'
        : 'BACKEND';

      const configEntity = AppConfig.create(
        formattedKey,
        stringValue,
        `Section '${section}' property '${propKey}'`,
        propKey.toLowerCase().includes('secret') || propKey.toLowerCase().includes('private'),
        target
      );

      await this.repository.save(configEntity, tenantId);
    }

    const updated = await this.getSection(section, tenantId);
    return this.sanitizeForPresentation(section, updated);
  }

  public sanitizeForPresentation(section: ConfigSection, data: any): any {
    if (!data || typeof data !== 'object') return data;
    const sanitized = { ...data };

    if (section === 'iam') {
      // NEVER leak RSA private key or symmetric secret material over REST APIs
      if (sanitized.jwtPrivateKey) {
        sanitized.jwtPrivateKey = '[PROTECTED_ASYMMETRIC_KEY]';
      }
    }

    if (section === 'transaction') {
      if (sanitized.stripeWebhookSecret) {
        sanitized.stripeWebhookSecret = '[PROTECTED_WEBHOOK_SECRET]';
      }
    }

    return sanitized;
  }

  public async getSanitizedSection<K extends ConfigSection>(
    section: K,
    tenantId?: string
  ): Promise<SectionConfigMap[K]> {
    const raw = await this.getSection(section, tenantId);
    return this.sanitizeForPresentation(section, raw);
  }

  public async getAllSectionsSummary(tenantId?: string): Promise<Record<ConfigSection, any>> {
    const sections: ConfigSection[] = [
      'tenant',
      'iam',
      'white-label',
      'asset',
      'finance',
      'transaction',
      'inventory',
      'order',
      'property',
      'search',
      'scheduler'
    ];

    const result: any = {};
    for (const sec of sections) {
      result[sec] = await this.getSanitizedSection(sec, tenantId);
    }
    return result;
  }


  private toConfigKey(section: string, propName: string): string {
    const snakeProp = propName.replace(/([A-Z])/g, '_$1').toUpperCase();

    // Map special keys cleanly
    if (propName === 'activePaymentGateway') return 'ACTIVE_PAYMENT_GATEWAY';
    if (propName === 'defaultCurrency') return 'DEFAULT_CURRENCY';
    if (propName === 'maxLoginAttempts') return 'MAX_LOGIN_ATTEMPTS';

    const secPrefix = section.toUpperCase().replace('-', '_');
    return `${secPrefix}_${snakeProp}`;
  }
}
