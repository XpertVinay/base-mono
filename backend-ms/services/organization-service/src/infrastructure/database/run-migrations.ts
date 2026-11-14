import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';
import { logger } from '../../shared/infrastructure/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  logger.info('Starting database migrations for organization-service...');
  const migrationsDir = path.resolve(__dirname, '../../../migrations');

  if (!fs.existsSync(migrationsDir)) {
    logger.info('No migrations directory found, skipping.');
    return;
  }

  const pool = dbPool.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('organization-service-migrations'))");

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      logger.info(`Applying migration: ${file}`);
      await client.query(sql);
      logger.info(`Successfully applied: ${file}`);
    }

    await client.query('COMMIT');
    logger.info('Organization-service migrations completed cleanly.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Failed to apply migrations in organization-service', err);
    throw err;
  } finally {
    client.release();
  }
}

const isCliEntry = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isCliEntry) {
  runMigrations()
    .then(() => dbPool.close())
    .catch((err) => {
      logger.error('Fatal migration error in organization-service', err);
      process.exit(1);
    });
}

export { runMigrations };
