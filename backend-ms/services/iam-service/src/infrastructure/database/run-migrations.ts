import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';
import { logger } from '../../shared/infrastructure/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  logger.info('Starting database migrations for iam-service...');
  const migrationsDir = path.resolve(__dirname, '../../../migrations');

  if (!fs.existsSync(migrationsDir)) {
    logger.info('No migrations directory found, skipping.');
    process.exit(0);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    logger.info(`Applying migration: ${file}`);
    try {
      await dbPool.query(sql);
      logger.info(`Successfully applied: ${file}`);
    } catch (err) {
      logger.error(`Failed to apply migration ${file}`, err);
      process.exit(1);
    }
  }

  logger.info('Migrations completed cleanly.');
  await dbPool.close();
}

runMigrations().catch(err => {
  logger.error('Fatal migration error', err);
  process.exit(1);
});
