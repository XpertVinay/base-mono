import pg from 'pg';
import { dbPool } from './connection-pool.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface ITransactionContext {
  query<R = any>(text: string, params?: any[]): Promise<{ rows: R[]; rowCount: number }>;
}

export class TransactionManager {
  public static async runInTransaction<T>(
    operation: (ctx: ITransactionContext) => Promise<T>
  ): Promise<T> {
    const client: pg.PoolClient = await dbPool.getClient();
    try {
      await client.query('BEGIN');
      const ctx: ITransactionContext = {
        query: async (text: string, params?: any[]) => {
          const res = await client.query(text, params);
          return { rows: res.rows, rowCount: res.rowCount ?? 0 };
        }
      };

      const result = await operation(ctx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back due to error', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
