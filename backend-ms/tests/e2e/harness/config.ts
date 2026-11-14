/**
 * tests/e2e/harness/config.ts
 * Master Configuration for E2E Test Suite
 */

export const E2E_CONFIG = {
  // Base URLs
  GATEWAY_URL: process.env.GATEWAY_URL || 'http://127.0.0.1:4000',
  TEST_MODE: (process.env.TEST_MODE || 'auto') as 'auto' | 'live' | 'in-process',

  // Ports
  PORTS: {
    GATEWAY: 4000,
    IAM: 4001,
    ASSET: 4002,
    CONFIG: 4003,
    NOTIFICATION: 4004,
    SCHEDULER: 4005,
    ORDER: 4006,
    TRANSACTION: 4007,
    SEARCH: 4008,
    INVENTORY: 4009,
    AI: 4010,
    AUDIT: 4011,
    ORGANIZATION: 4012,
    RBAC: 4013
  },

  // Direct Service Health Check URLs
  SERVICE_URLS: {
    gateway: process.env.GATEWAY_URL || 'http://127.0.0.1:4000',
    iam: process.env.IAM_URL || 'http://127.0.0.1:4001',
    assets: process.env.ASSET_URL || 'http://127.0.0.1:4002',
    config: process.env.CONFIG_URL || 'http://127.0.0.1:4003',
    notifications: process.env.NOTIFICATION_URL || 'http://127.0.0.1:4004',
    scheduler: process.env.SCHEDULER_URL || 'http://127.0.0.1:4005',
    orders: process.env.ORDER_URL || 'http://127.0.0.1:4006',
    transactions: process.env.TRANSACTION_URL || 'http://127.0.0.1:4007',
    search: process.env.SEARCH_URL || 'http://127.0.0.1:4008',
    inventory: process.env.INVENTORY_URL || 'http://127.0.0.1:4009',
    ai: process.env.AI_URL || 'http://127.0.0.1:4010',
    audit: process.env.AUDIT_URL || 'http://127.0.0.1:4011',
    organizations: process.env.ORGANIZATION_URL || 'http://127.0.0.1:4012',
    rbac: process.env.RBAC_URL || 'http://127.0.0.1:4013'
  },

  // Security Secrets
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars',
  INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars',
  OIDC_ENCRYPTION_KEY: process.env.OIDC_ENCRYPTION_KEY || 'dev-oidc-encryption-secret-key-32-chars',

  // Standard Headers
  HEADERS: {
    TENANT: 'x-tenant-id',
    TENANT_SLUG: 'x-tenant-slug',
    DEVICE_FINGERPRINT: 'x-device-fingerprint',
    CORRELATION_ID: 'x-correlation-id',
    INTERNAL_SECRET: 'x-internal-secret',
    USER_ID: 'x-user-id',
    USER_ROLE: 'x-user-role',
    AUTHORIZATION: 'authorization'
  },

  // Test Personas & Tenants
  TENANTS: {
    ALPHA: { id: 'tenant-alpha', slug: 'alpha', name: 'Alpha Corp' },
    BETA: { id: 'tenant-beta', slug: 'beta', name: 'Beta Ltd' },
    DEFAULT: { id: 'default', slug: 'default', name: 'Default Tenant' }
  },

  DEVICE_FINGERPRINTS: {
    VALID: 'device-macbook-pro-m3-arm64-v1',
    SECONDARY: 'device-iphone-15-ios18-v1',
    SPOOFED: 'device-attacker-kali-linux-v1'
  },
  TEST_DEVICE_FINGERPRINT: 'device-macbook-pro-m3-arm64-v1',

  TIMEOUT_MS: 10000,
  RETRY_COUNT: 2,
  RETRY_DELAY_MS: 150
};
