import { ISchedulerRepository } from '../../domain/repositories/scheduler-repository.interface.js';
import { Job } from '../../domain/entities/job.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresSchedulerRepository implements ISchedulerRepository {
  async findById(id: string, tenantId?: string): Promise<Job | null> {
    const query = tenantId
      ? 'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at, tenant_id FROM scheduler.jobs WHERE id = $1 AND (tenant_id = $2 OR tenant_id = \'default\')'
      : 'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at, tenant_id FROM scheduler.jobs WHERE id = $1';
    const params = tenantId ? [id, tenantId] : [id];
    const res = await dbPool.query(query, params);
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findByName(name: string, tenantId?: string): Promise<Job | null> {
    const query = tenantId
      ? 'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at, tenant_id FROM scheduler.jobs WHERE name = $1 AND (tenant_id = $2 OR tenant_id = \'default\')'
      : 'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at, tenant_id FROM scheduler.jobs WHERE name = $1';
    const params = tenantId ? [name, tenantId] : [name];
    const res = await dbPool.query(query, params);
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async listAll(tenantId?: string): Promise<Job[]> {
    const query = tenantId
      ? 'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at, tenant_id FROM scheduler.jobs WHERE tenant_id = $1 OR tenant_id = \'default\' ORDER BY created_at DESC'
      : 'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at, tenant_id FROM scheduler.jobs ORDER BY created_at DESC';
    const params = tenantId ? [tenantId] : [];
    const res = await dbPool.query(query, params);
    return res.rows.map(row => this.mapToDomain(row));
  }

  async save(job: Job): Promise<void> {
    await dbPool.query(
      `INSERT INTO scheduler.jobs (id, name, cron_expression, status, last_run_at, next_run_at, created_at, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [job.id, job.name, job.cronExpression, job.status, job.lastRunAt, job.nextRunAt, job.createdAt, job.tenantId || 'default']
    );
  }

  async update(job: Job): Promise<void> {
    await dbPool.query(
      `UPDATE scheduler.jobs
       SET name = $2, cron_expression = $3, status = $4, last_run_at = $5, next_run_at = $6
       WHERE id = $1`,
      [job.id, job.name, job.cronExpression, job.status, job.lastRunAt, job.nextRunAt]
    );
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const query = tenantId
      ? 'DELETE FROM scheduler.jobs WHERE id = $1 AND tenant_id = $2'
      : 'DELETE FROM scheduler.jobs WHERE id = $1';
    const params = tenantId ? [id, tenantId] : [id];
    const res = await dbPool.query(query, params);
    return (res.rowCount ?? 0) > 0;
  }

  private mapToDomain(row: any): Job {
    const job = Job.create(
      {
        name: row.name,
        cronExpression: row.cron_expression,
        tenantId: row.tenant_id
      },
      row.id
    );
    if (row.status === 'RUNNING') job.markRunning();
    if (row.status === 'COMPLETED') job.markCompleted();
    if (row.status === 'FAILED') job.markFailed();
    return job;
  }
}
