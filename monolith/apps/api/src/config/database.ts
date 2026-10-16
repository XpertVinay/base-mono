import { env } from './env.js';

export const databaseConfig = {
  connectionString: env.DATABASE_URL,
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  min: env.DB_POOL_MIN,
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: env.DB_TIMEOUT_MS,
  idleTimeoutMillis: 30000
};
