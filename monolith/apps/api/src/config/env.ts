import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  
  // Security
  JWT_SECRET: z.string().min(16).default('super-secret-development-jwt-key-replace-in-production-min-32-chars'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_SECRET: z.string().min(16).default('super-secret-refresh-token-key-replace-in-production-min-32'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
  PII_ENCRYPTION_KEY: z.string().min(16).default('pii-encryption-key-for-tenant-rest-and-flight-min32chars'),
  
  // PostgreSQL Database
  DATABASE_URL: z.string().optional().default('postgres://postgres:postgres@localhost:5432/monolith_db'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('monolith_db'),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_TIMEOUT_MS: z.coerce.number().default(5000),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Notification System - Adapter and Provider Configuration
  NOTIFICATION_DRY_RUN: z.preprocess(
    (val) => (val !== undefined ? val === 'true' || val === true : process.env.NODE_ENV !== 'production'),
    z.boolean()
  ).default(true),
  NOTIFICATION_EMAIL_PROVIDER: z.string().default('SENDGRID'),
  NOTIFICATION_SMS_PROVIDER: z.string().default('TWILIO'),
  NOTIFICATION_WHATSAPP_PROVIDER: z.string().default('META_CLOUD'),
  NOTIFICATION_PUSH_PROVIDER: z.string().default('FCM'),

  // SendGrid (Email)
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().default('noreply@monolith.local'),
  SENDGRID_FROM_NAME: z.string().default('Monolith Platform'),

  // Twilio (SMS)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // Meta Cloud (WhatsApp)
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_WHATSAPP_API_VERSION: z.string().default('v21.0'),

  // Firebase Cloud Messaging (FCM)
  FCM_PROJECT_ID: z.string().default('monolith-push-dev'),
  FCM_SERVER_KEY: z.string().optional(),
  FCM_BEARER_TOKEN: z.string().optional()
});

export type EnvConfig = z.infer<typeof envSchema>;

function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid application configuration:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const env = parseEnv();
