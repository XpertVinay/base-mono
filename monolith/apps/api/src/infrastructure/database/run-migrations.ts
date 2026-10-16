import { DatabaseMigrator } from './migrator.js';
import { dbPool } from './connection-pool.js';
import { logger } from '../../shared/infrastructure/logger.js';

async function main() {
  const migrator = new DatabaseMigrator();
  try {
    const health = await dbPool.checkHealth();
    if (health.status === 'DOWN') {
      logger.error('Cannot run migrations: PostgreSQL database is unreachable.', undefined, { error: health.error });
      process.exit(1);
    }

    const result = await migrator.runMigrations();
    logger.info('Migration run completed successfully', result);
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed with critical error', err);
    process.exit(1);
  } finally {
    await dbPool.close();
  }
}

main();
