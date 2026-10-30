export type ConfigTarget = 'BACKEND' | 'FRONTEND' | 'ALL';

export type ConfigSection =
  | 'tenant'
  | 'iam'
  | 'white-label'
  | 'asset'
  | 'finance'
  | 'transaction'
  | 'inventory'
  | 'order'
  | 'property'
  | 'search'
  | 'scheduler';

export interface AppConfigDto {
  key: string;
  value: string;
  description?: string;
  isEncrypted: boolean;
  target?: ConfigTarget;
  updatedAt: string;
}

export interface SetConfigRequestDto {
  key: string;
  value: string;
  description?: string;
  isEncrypted?: boolean;
  target?: ConfigTarget;
}

export interface ClientConfigMapDto {
  [key: string]: string;
}

// 1. Multi-Tenant Configuration
export interface TenantConfigDto {
  multiTenancyEnabled: boolean;
  isolationMode: 'ROW_LEVEL' | 'SCHEMA_LEVEL' | 'DATABASE_LEVEL';
  defaultTenantId: string;
  headerKey: string;
  subdomainRoutingEnabled: boolean;
  maxTenants: number;
  enforceTenantIsolation: boolean;
}

// 2. IAM Configuration (Authentication & Authorization with RBAC JWT asymmetric keys)
export interface IamConfigDto {
  jwtAlgorithm: 'RS256' | 'HS256';
  jwtPublicKey?: string;
  jwtPrivateKey?: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  bcryptSaltRounds: number;
  mfaEnabled: boolean;
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
}

// 3. White-Label Configuration
export interface WhiteLabelConfigDto {
  brandName: string;
  companyName: string;
  portalTitle: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  supportEmail: string;
  customDomainEnabled: boolean;
  emailFooterText: string;
}

// 4. Asset Module Configuration
export interface AssetConfigDto {
  storageProvider: 'LOCAL' | 'S3' | 'GCS' | 'MINIO';
  bucketName: string;
  region: string;
  cdnBaseUrl?: string;
  maxUploadSizeBytes: number;
  allowedMimeTypes: string[];
  presignedUrlTtlSeconds: number;
  virusScanningEnabled: boolean;
}

// 5. Finance Module Configuration (Logging matrix & compliance)
export interface FinanceConfigDto {
  defaultCurrency: string;
  fiscalYearStartMonth: number;
  taxRatePercentage: number;
  auditLoggingEnabled: boolean;
  invoiceDueDays: number;
  reconciliationScheduleCron: string;
  ledgerImmutabilityStrict: boolean;
}

// 5b. Transaction Module Configuration (Provider configs & dynamic routing)
export interface TransactionConfigDto {
  activePaymentGateway: 'STRIPE' | 'PAYPAL' | 'RAZORPAY' | 'MOCK';
  enabledGateways: string[];
  stripePublicKey?: string;
  stripeWebhookSecret?: string;
  paypalClientId?: string;
  razorpayKeyId?: string;
  transactionFeePercentage: number;
  autoCapture: boolean;
  maxRetryAttempts: number;
}

// 6. Inventory Module Configuration (Product & service availability)
export interface InventoryConfigDto {
  stockTrackingEnabled: boolean;
  lowStockThreshold: number;
  autoReserveOnOrder: boolean;
  reservationExpiryMinutes: number;
  allowBackorders: boolean;
  serviceAvailabilityBufferMinutes: number;
}

// 7. Order Module Configuration (Bookings & Orders)
export interface OrderConfigDto {
  bookingConfirmationMode: 'MANUAL' | 'AUTO';
  cancellationWindowHours: number;
  orderAutoExpiryMinutes: number;
  defaultOrderStatusWorkflow: string[];
  invoicePrefix: string;
  minimumOrderAmount: number;
}

// 8. Property & Service Module Configuration
export interface PropertyConfigDto {
  defaultInspectionIntervalDays: number;
  caretakingServiceTypes: string[];
  requireApprovalBeforeListing: boolean;
  maxPhotosPerProperty: number;
  enableVirtualTour: boolean;
  emergencyContactRequired: boolean;
}

// 9. Search Module Configuration (Elasticsearch index & full-text search)
export interface SearchConfigDto {
  searchEngine: 'POSTGRES_FTS' | 'ELASTICSEARCH' | 'OPENSEARCH';
  elasticIndexPrefix: string;
  searchableEntities: string[];
  fuzzinessLevel: 'AUTO' | '0' | '1' | '2';
  highlightEnabled: boolean;
  maxSearchResults: number;
  minimumMatchScore: number;
}

// 10. Scheduler Module Configuration
export interface SchedulerConfigDto {
  cronEngineEnabled: boolean;
  maxConcurrentJobs: number;
  jobRetryLimit: number;
  retryBackoffMultiplier: number;
  deadLetterQueueRetentionDays: number;
  pollIntervalMs: number;
}

export interface SectionConfigMap {
  tenant: TenantConfigDto;
  iam: IamConfigDto;
  'white-label': WhiteLabelConfigDto;
  asset: AssetConfigDto;
  finance: FinanceConfigDto;
  transaction: TransactionConfigDto;
  inventory: InventoryConfigDto;
  order: OrderConfigDto;
  property: PropertyConfigDto;
  search: SearchConfigDto;
  scheduler: SchedulerConfigDto;
}
