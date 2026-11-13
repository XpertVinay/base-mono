import { ISchedulerRepository } from '../../domain/repositories/scheduler-repository.interface.js';
import { Job } from '../../domain/entities/job.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresSchedulerRepository implements ISchedulerRepository {
  async findById(id: string): Promise<Job | null> {
    const res = await dbPool.query(
      'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at FROM scheduler.jobs WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findByName(name: string): Promise<Job | null> {
    const res = await dbPool.query(
      'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at FROM scheduler.jobs WHERE name = $1',
      [name]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async listAll(): Promise<Job[]> {
    const res = await dbPool.query(
      'SELECT id, name, cron_expression, status, last_run_at, next_run_at, created_at FROM scheduler.jobs ORDER BY created_at DESC'
    );
    return res.rows.map(row => this.mapToDomain(row));
  }

  async save(job: Job): Promise<void> {
    await dbPool.query(
      `INSERT INTO scheduler.jobs (id, name, cron_expression, status, last_run_at, next_run_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [job.id, job.name, job.cronExpression, job.status, job.lastRunAt, job.nextRunAt, job.createdAt]
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

  async delete(id: string): Promise<boolean> {
    const res = await dbPool.query('DELETE FROM scheduler.jobs WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  private mapToDomain(row: any): Job {
    const job = Job.create(
      {
        name: row.name,
        cronExpression: row.cron_expression
      },
      row.id
    );
    if (row.status === 'RUNNING') job.markRunning();
    if (row.status === 'COMPLETED') job.markCompleted();
    if (row.status === 'FAILED') job.markFailed();
    return job;
  }
}
