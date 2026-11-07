import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ISchedulerRepository } from '../../domain/repositories/scheduler-repository.interface.js';
import { ScheduledJob } from '../../domain/entities/job.entity.js';
import { ScheduledJobDto, CreateScheduledJobRequestDto, JobRunDto } from '@monolith/contracts';
import { NotFoundError } from '../../../../shared/presentation/error-handler.middleware.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class ListJobsQuery implements IQuery<{ tenantId?: string } | void, ScheduledJobDto[]> {
  constructor(private readonly repository: ISchedulerRepository) {}

  async execute(input?: { tenantId?: string }): Promise<Result<ScheduledJobDto[], Error>> {
    try {
      const jobs = await this.repository.findAll(input?.tenantId);
      return Result.ok(jobs.map(j => ({
        id: j.id,
        tenantId: j.tenantId,
        name: j.name,
        cronExpression: j.cronExpression,
        status: j.status,
        lastRunAt: j.lastRunAt?.toISOString(),
        nextRunAt: j.nextRunAt?.toISOString(),
        failureReason: j.failureReason,
        createdAt: j.createdAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetJobByIdQuery implements IQuery<{ id: string; tenantId?: string }, ScheduledJobDto> {
  constructor(private readonly repository: ISchedulerRepository) {}

  async execute({ id, tenantId }: { id: string; tenantId?: string }): Promise<Result<ScheduledJobDto, Error>> {
    try {
      const job = await this.repository.findById(id, tenantId);
      if (!job) {
        return Result.fail(new NotFoundError(`Scheduled job with id '${id}'`));
      }
      return Result.ok({
        id: job.id,
        tenantId: job.tenantId,
        name: job.name,
        cronExpression: job.cronExpression,
        status: job.status,
        lastRunAt: job.lastRunAt?.toISOString(),
        nextRunAt: job.nextRunAt?.toISOString(),
        failureReason: job.failureReason,
        createdAt: job.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class CreateJobUseCase implements IUseCase<CreateScheduledJobRequestDto, ScheduledJobDto> {
  constructor(private readonly repository: ISchedulerRepository) {}

  async execute(input: CreateScheduledJobRequestDto): Promise<Result<ScheduledJobDto, Error>> {
    try {
      const job = ScheduledJob.create(input.name, input.cronExpression, input.tenantId);
      await this.repository.save(job);

      return Result.ok({
        id: job.id,
        tenantId: job.tenantId,
        name: job.name,
        cronExpression: job.cronExpression,
        status: job.status,
        lastRunAt: job.lastRunAt?.toISOString(),
        nextRunAt: job.nextRunAt?.toISOString(),
        failureReason: job.failureReason,
        createdAt: job.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class TriggerJobUseCase implements IUseCase<{ id: string; tenantId?: string }, ScheduledJobDto> {
  constructor(
    private readonly repository: ISchedulerRepository,
    private readonly jobTasks: Map<string, () => Promise<void>>
  ) {}

  async execute({ id, tenantId }: { id: string; tenantId?: string }): Promise<Result<ScheduledJobDto, Error>> {
    try {
      const job = await this.repository.findById(id, tenantId);
      if (!job) return Result.fail(new NotFoundError(`Scheduled job with id '${id}'`));

      const runId = uuidv4();
      const startedAt = new Date();

      job.startExecution();
      await this.repository.save(job);

      logger.info(`Scheduler executing task for job: ${job.name}`, { jobId: job.id, tenantId: job.tenantId });

      try {
        const task = this.jobTasks.get(job.name);
        if (task) {
          await task();
        } else {
          logger.info(`Default no-op heartbeat executed for job: ${job.name}`);
        }

        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        job.recordExecutionSuccess();
        await this.repository.save(job);

        await this.repository.saveJobRun({
          id: runId,
          jobId: job.id,
          tenantId: job.tenantId,
          status: 'COMPLETED',
          startedAt,
          completedAt,
          durationMs
        });
      } catch (executionErr: any) {
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();
        const failureReason = executionErr?.message || 'Execution error';

        job.recordExecutionFailure(failureReason);
        await this.repository.save(job);

        await this.repository.saveJobRun({
          id: runId,
          jobId: job.id,
          tenantId: job.tenantId,
          status: 'FAILED',
          startedAt,
          completedAt,
          durationMs,
          failureReason
        });

        logger.error(`Scheduler task failed for job: ${job.name}`, { error: failureReason, jobId: job.id });
      }

      return Result.ok({
        id: job.id,
        tenantId: job.tenantId,
        name: job.name,
        cronExpression: job.cronExpression,
        status: job.status,
        lastRunAt: job.lastRunAt?.toISOString(),
        nextRunAt: job.nextRunAt?.toISOString(),
        failureReason: job.failureReason,
        createdAt: job.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListJobRunsQuery implements IQuery<{ jobId: string; tenantId?: string }, JobRunDto[]> {
  constructor(private readonly repository: ISchedulerRepository) {}

  async execute({ jobId, tenantId }: { jobId: string; tenantId?: string }): Promise<Result<JobRunDto[], Error>> {
    try {
      const runs = await this.repository.findJobRuns(jobId, tenantId);
      return Result.ok(runs.map(r => ({
        id: r.id,
        jobId: r.jobId,
        tenantId: r.tenantId,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString(),
        durationMs: r.durationMs,
        failureReason: r.failureReason
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
