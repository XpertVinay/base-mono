import { ISchedulerRepository } from '../../domain/repositories/scheduler-repository.interface.js';
import { ScheduledJob } from '../../domain/entities/job.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresSchedulerRepository implements ISchedulerRepository {
  private fallbackStore: Map<string, ScheduledJob> = new Map();

  constructor() {
    // Seed default scheduled jobs
    const defaults = [
      ScheduledJob.create('OUTBOX_EVENT_DISPATCHER', '*/1 * * * *'),
      ScheduledJob.create('DAILY_RECONCILIATION_REPORT', '0 0 * * *'),
      ScheduledJob.create('INVENTORY_STOCK_SYNC', '*/15 * * * *')
    ];
    defaults.forEach(d => this.fallbackStore.set(d.id, d));
  }

  async findById(id: string): Promise<ScheduledJob | null> {
    try {
      const res = await dbPool.query(
        'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at FROM scheduler.jobs WHERE id = $1',
        [id]
      );
      if (res.rows.length === 0) return this.fallbackStore.get(id) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByName(name: string): Promise<ScheduledJob | null> {
    try {
      const res = await dbPool.query(
        'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at FROM scheduler.jobs WHERE name = $1',
        [name]
      );
      if (res.rows.length === 0) {
        for (const job of this.fallbackStore.values()) {
          if (job.name === name) return job;
        }
        return null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      for (const job of this.fallbackStore.values()) {
        if (job.name === name) return job;
      }
      return null;
    }
  }

  async findAll(): Promise<ScheduledJob[]> {
    try {
      const res = await dbPool.query(
        'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at FROM scheduler.jobs ORDER BY created_at ASC'
      );
      if (res.rows.length === 0) return Array.from(this.fallbackStore.values());
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values());
    }
  }

  async save(job: ScheduledJob): Promise<void> {
    this.fallbackStore.set(job.id, job);
    try {
      await dbPool.query(
        `INSERT INTO scheduler.jobs (id, name, cron_expression, status, last_run_at, next_run_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           last_run_at = EXCLUDED.last_run_at,
           next_run_at = EXCLUDED.next_run_at`,
        [job.id, job.name, job.cronExpression, job.status, job.lastRunAt || null, job.nextRunAt || null, job.createdAt]
      );
    } catch (err) {
      logger.warn('Failed to persist scheduler job in DB, stored in fallback store', { id: job.id });
    }
  }

  private mapToDomain(row: any): ScheduledJob {
    return ScheduledJob.reconstitute(row.id, {
      name: row.name,
      cronExpression: row.cron_expression,
      status: row.status,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
      nextRunAt: row.next_run_at ? new Date(row.next_run_at) : undefined,
      createdAt: new Date(row.created_at)
    });
  }
}
