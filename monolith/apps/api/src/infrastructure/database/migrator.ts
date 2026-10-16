import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbPool } from './connection-pool.js';
import { logger } from '../../shared/infrastructure/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseMigrator {
  private migrationsDir: string;

  constructor(customMigrationsDir?: string) {
    this.migrationsDir = customMigrationsDir || path.resolve(__dirname, '../../../migrations');
  }

  public async runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
    logger.info('Starting database migration runner...');

    const client = await dbPool.getClient();
    try {
      // 1. Create migrations tracking table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS public._migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Fetch applied migrations
      const { rows } = await client.query<{ name: string }>('SELECT name FROM public._migrations ORDER BY id ASC');
      const appliedSet = new Set(rows.map(r => r.name));

      // 3. Read migration files
      if (!fs.existsSync(this.migrationsDir)) {
        logger.warn(`Migrations directory not found at: ${this.migrationsDir}`);
        return { applied: [], skipped: [] };
      }

      const files = fs.readdirSync(this.migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      const applied: string[] = [];
      const skipped: string[] = [];

      for (const file of files) {
        if (appliedSet.has(file)) {
          skipped.push(file);
          continue;
        }

        logger.info(`Applying migration: ${file}`);
        const sqlContent = fs.readFileSync(path.join(this.migrationsDir, file), 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sqlContent);
          await client.query('INSERT INTO public._migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          applied.push(file);
          logger.info(`Successfully applied migration: ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          logger.error(`Migration ${file} failed. Rolled back.`, error);
          throw error;
        }
      }

      logger.info(`Database migrations finished. Applied: ${applied.length}, Skipped: ${skipped.length}`);
      return { applied, skipped };
    } finally {
      client.release();
    }
  }
}
