import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { ISchedulerRepository } from '../../domain/repositories/scheduler-repository.interface.js';
import { Job } from '../../domain/entities/job.entity.js';
import { JobDto } from '../../shared/contracts/index.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface CreateJobInput {
  name: string;
  cronExpression: string;
}

export class CreateJobUseCase implements UseCase<CreateJobInput, JobDto> {
  constructor(private readonly repo: ISchedulerRepository) {}

  async execute(input: CreateJobInput): Promise<Result<JobDto>> {
    const job = Job.create({
      name: input.name,
      cronExpression: input.cronExpression
    });

    await this.repo.save(job);

    return Result.ok({
      id: job.id,
      name: job.name,
      cronExpression: job.cronExpression,
      status: job.status,
      lastRunAt: job.lastRunAt?.toISOString(),
      nextRunAt: job.nextRunAt?.toISOString(),
      createdAt: job.createdAt.toISOString()
    });
  }
}

export class ListJobsQuery implements UseCase<void, JobDto[]> {
  constructor(private readonly repo: ISchedulerRepository) {}

  async execute(): Promise<Result<JobDto[]>> {
    const jobs = await this.repo.listAll();
    return Result.ok(
      jobs.map(j => ({
        id: j.id,
        name: j.name,
        cronExpression: j.cronExpression,
        status: j.status,
        lastRunAt: j.lastRunAt?.toISOString(),
        nextRunAt: j.nextRunAt?.toISOString(),
        createdAt: j.createdAt.toISOString()
      }))
    );
  }
}

export class TriggerJobUseCase implements UseCase<{ id: string }, JobDto> {
  constructor(
    private readonly repo: ISchedulerRepository,
    private readonly tasks: Map<string, () => Promise<void>>
  ) {}

  async execute(input: { id: string }): Promise<Result<JobDto>> {
    const job = await this.repo.findById(input.id);
    if (!job) {
      return Result.fail('Job not found');
    }

    job.markRunning();
    await this.repo.update(job);

    const task = this.tasks.get(job.name);
    try {
      if (task) {
        logger.info(`Executing job task ${job.name}`);
        await task();
      } else {
        logger.info(`Simulated execution for scheduled job ${job.name}`);
      }
      job.markCompleted();
    } catch (err) {
      logger.error(`Job execution failed for ${job.name}`, err);
      job.markFailed();
    }

    await this.repo.update(job);

    return Result.ok({
      id: job.id,
      name: job.name,
      cronExpression: job.cronExpression,
      status: job.status,
      lastRunAt: job.lastRunAt?.toISOString(),
      nextRunAt: job.nextRunAt?.toISOString(),
      createdAt: job.createdAt.toISOString()
    });
  }
}
