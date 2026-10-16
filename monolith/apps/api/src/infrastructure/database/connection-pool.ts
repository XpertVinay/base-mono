import pg from 'pg';
import { databaseConfig } from '../../config/database.js';
import { logger } from '../../shared/infrastructure/logger.js';

const { Pool } = pg;

export interface IDatabaseClient {
  query<R = any>(text: string, params?: any[]): Promise<{ rows: R[]; rowCount: number }>;
}

export class DatabasePool implements IDatabaseClient {
  private static instance: DatabasePool;
  private pool: pg.Pool;
  private isConnected = false;

  public get isHealthy(): boolean {
    return this.isConnected;
  }

  private constructor() {
    this.pool = new Pool({
      connectionString: databaseConfig.connectionString,
      min: databaseConfig.min,
      max: databaseConfig.max,
      connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
      idleTimeoutMillis: databaseConfig.idleTimeoutMillis
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  public async query<R = any>(text: string, params?: any[]): Promise<{ rows: R[]; rowCount: number }> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return { rows: res.rows, rowCount: res.rowCount ?? 0 };
    } catch (error) {
      logger.error('Database query error', error, { text, params });
      throw error;
    }
  }

  public async getClient(): Promise<pg.PoolClient> {
    return this.pool.connect();
  }

  public async checkHealth(): Promise<{ status: 'UP' | 'DOWN'; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.pool.query('SELECT 1');
      const latencyMs = Date.now() - start;
      this.isConnected = true;
      return { status: 'UP', latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      this.isConnected = false;
      return { 
        status: 'DOWN', 
        latencyMs, 
        error: err instanceof Error ? err.message : 'Database ping failed' 
      };
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    logger.info('PostgreSQL connection pool closed');
  }
}

export const dbPool = DatabasePool.getInstance();
