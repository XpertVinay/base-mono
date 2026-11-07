import { ISchedulerRepository, JobRunRecord } from '../../domain/repositories/scheduler-repository.interface.js';
import { ScheduledJob } from '../../domain/entities/job.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresSchedulerRepository implements ISchedulerRepository {
  private fallbackStore: Map<string, ScheduledJob> = new Map();
  private jobRunsFallbackStore: Map<string, JobRunRecord[]> = new Map();

  constructor() {
    // Seed default scheduled jobs as system jobs
    const defaults = [
      ScheduledJob.create('OUTBOX_EVENT_DISPATCHER', '*/1 * * * *'),
      ScheduledJob.create('DAILY_RECONCILIATION_REPORT', '0 0 * * *'),
      ScheduledJob.create('INVENTORY_STOCK_SYNC', '*/15 * * * *')
    ];
    defaults.forEach(d => this.fallbackStore.set(d.id, this.cloneJob(d)));
  }

  async findById(id: string, tenantId?: string): Promise<ScheduledJob | null> {
    try {
      let sql = 'SELECT id, tenant_id, name, cron_expression, status, last_run_at, next_run_at, failure_reason, created_at FROM scheduler.jobs WHERE id = $1';
      const params: any[] = [id];

      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.getFromFallback(id, tenantId);
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.getFromFallback(id, tenantId);
    }
  }

  async findByName(name: string, tenantId?: string): Promise<ScheduledJob | null> {
    try {
      let sql = 'SELECT id, tenant_id, name, cron_expression, status, last_run_at, next_run_at, failure_reason, created_at FROM scheduler.jobs WHERE name = $1';
      const params: any[] = [name];

      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.findByNameInFallback(name, tenantId);
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.findByNameInFallback(name, tenantId);
    }
  }

  async findAll(tenantId?: string): Promise<ScheduledJob[]> {
    try {
      let sql = 'SELECT id, tenant_id, name, cron_expression, status, last_run_at, next_run_at, failure_reason, created_at FROM scheduler.jobs';
      const params: any[] = [];

      if (tenantId) {
        sql += ' WHERE tenant_id = $1 OR tenant_id IS NULL';
        params.push(tenantId);
      }

      sql += ' ORDER BY created_at ASC';

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.findAllInFallback(tenantId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return this.findAllInFallback(tenantId);
    }
  }

  async save(job: ScheduledJob): Promise<void> {
    this.fallbackStore.set(job.id, this.cloneJob(job));
    try {
      await dbPool.query(
        `INSERT INTO scheduler.jobs (id, tenant_id, name, cron_expression, status, last_run_at, next_run_at, failure_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           last_run_at = EXCLUDED.last_run_at,
           next_run_at = EXCLUDED.next_run_at,
           failure_reason = EXCLUDED.failure_reason`,
        [
          job.id,
          job.tenantId || null,
          job.name,
          job.cronExpression,
          job.status,
          job.lastRunAt || null,
          job.nextRunAt || null,
          job.failureReason || null,
          job.createdAt
        ]
      );
    } catch (err) {
      logger.warn('Failed to persist scheduler job in DB, stored in fallback store', { id: job.id });
    }
  }

  async saveJobRun(run: JobRunRecord): Promise<void> {
    const list = this.jobRunsFallbackStore.get(run.jobId) || [];
    list.push({ ...run });
    this.jobRunsFallbackStore.set(run.jobId, list);

    try {
      await dbPool.query(
        `INSERT INTO scheduler.job_runs (id, job_id, tenant_id, status, started_at, completed_at, duration_ms, failure_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          run.id,
          run.jobId,
          run.tenantId || null,
          run.status,
          run.startedAt,
          run.completedAt || null,
          run.durationMs ?? null,
          run.failureReason || null
        ]
      );
    } catch (err) {
      logger.warn('Failed to persist job run in DB, stored in fallback store', { id: run.id, jobId: run.jobId });
    }
  }

  async findJobRuns(jobId: string, tenantId?: string): Promise<JobRunRecord[]> {
    try {
      let sql = 'SELECT id, job_id, tenant_id, status, started_at, completed_at, duration_ms, failure_reason FROM scheduler.job_runs WHERE job_id = $1';
      const params: any[] = [jobId];

      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }

      sql += ' ORDER BY started_at DESC';

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.findJobRunsInFallback(jobId, tenantId);
      }
      return res.rows.map(r => ({
        id: r.id,
        jobId: r.job_id,
        tenantId: r.tenant_id || undefined,
        status: r.status,
        startedAt: new Date(r.started_at),
        completedAt: r.completed_at ? new Date(r.completed_at) : undefined,
        durationMs: r.duration_ms ?? undefined,
        failureReason: r.failure_reason || undefined
      }));
    } catch {
      return this.findJobRunsInFallback(jobId, tenantId);
    }
  }

  private getFromFallback(id: string, tenantId?: string): ScheduledJob | null {
    const job = this.fallbackStore.get(id);
    if (!job) return null;
    if (tenantId && job.tenantId && job.tenantId !== tenantId) return null;
    return this.cloneJob(job);
  }

  private findByNameInFallback(name: string, tenantId?: string): ScheduledJob | null {
    for (const job of this.fallbackStore.values()) {
      if (job.name === name) {
        if (!tenantId || !job.tenantId || job.tenantId === tenantId) {
          return this.cloneJob(job);
        }
      }
    }
    return null;
  }

  private findAllInFallback(tenantId?: string): ScheduledJob[] {
    const jobs: ScheduledJob[] = [];
    for (const job of this.fallbackStore.values()) {
      if (!tenantId || !job.tenantId || job.tenantId === tenantId) {
        jobs.push(this.cloneJob(job));
      }
    }
    return jobs;
  }

  private findJobRunsInFallback(jobId: string, tenantId?: string): JobRunRecord[] {
    const runs = this.jobRunsFallbackStore.get(jobId) || [];
    return runs
      .filter(r => !tenantId || !r.tenantId || r.tenantId === tenantId)
      .map(r => ({ ...r }));
  }

  private cloneJob(job: ScheduledJob): ScheduledJob {
    return ScheduledJob.reconstitute(job.id, {
      name: job.name,
      cronExpression: job.cronExpression,
      status: job.status,
      tenantId: job.tenantId,
      lastRunAt: job.lastRunAt ? new Date(job.lastRunAt.getTime()) : undefined,
      nextRunAt: job.nextRunAt ? new Date(job.nextRunAt.getTime()) : undefined,
      failureReason: job.failureReason,
      createdAt: new Date(job.createdAt.getTime())
    });
  }

  private mapToDomain(row: any): ScheduledJob {
    return ScheduledJob.reconstitute(row.id, {
      name: row.name,
      cronExpression: row.cron_expression,
      status: row.status,
      tenantId: row.tenant_id || undefined,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
      nextRunAt: row.next_run_at ? new Date(row.next_run_at) : undefined,
      failureReason: row.failure_reason || undefined,
      createdAt: new Date(row.created_at)
    });
  }
}
