import pg from 'pg';
import { logger } from '../logger.js';

const { Pool } = pg;

export class DatabasePool {
  private static instance: DatabasePool;
  private pool: pg.Pool;

  private constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'microservices_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle database client', err);
    });
  }

  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  public getPool(): pg.Pool {
    return this.pool;
  }

  public async query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (duration > 500) {
        logger.warn(`Slow query detected: ${duration}ms`, { text });
      }
      return res;
    } catch (error) {
      logger.error('Database query error', error, { text });
      throw error;
    }
  }

  public async withTenantContext<T>(
    tenantId: string,
    fn: (client: pg.PoolClient) => Promise<T>,
    options?: { readOnly?: boolean; statementTimeoutMs?: number }
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query(options?.readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      if (options?.statementTimeoutMs && options.statementTimeoutMs > 0) {
        await client.query(`SELECT set_config('statement_timeout', $1, true)`, [String(options.statementTimeoutMs)]);
      }
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export const dbPool = DatabasePool.getInstance();

