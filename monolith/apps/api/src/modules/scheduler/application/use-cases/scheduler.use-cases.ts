import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ISchedulerRepository } from '../../domain/repositories/scheduler-repository.interface.js';
import { ScheduledJob } from '../../domain/entities/job.entity.js';
import { ScheduledJobDto, CreateScheduledJobRequestDto } from '@monolith/contracts';
import { NotFoundError } from '../../../../shared/presentation/error-handler.middleware.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class ListJobsQuery implements IQuery<void, ScheduledJobDto[]> {
  constructor(private readonly repository: ISchedulerRepository) {}

  async execute(): Promise<Result<ScheduledJobDto[], Error>> {
    try {
      const jobs = await this.repository.findAll();
      return Result.ok(jobs.map(j => ({
        id: j.id,
        name: j.name,
        cronExpression: j.cronExpression,
        status: j.status,
        lastRunAt: j.lastRunAt?.toISOString(),
        nextRunAt: j.nextRunAt?.toISOString(),
        createdAt: j.createdAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class CreateJobUseCase implements IUseCase<CreateScheduledJobRequestDto, ScheduledJobDto> {
  constructor(private readonly repository: ISchedulerRepository) {}

  async execute(input: CreateScheduledJobRequestDto): Promise<Result<ScheduledJobDto, Error>> {
    try {
      const job = ScheduledJob.create(input.name, input.cronExpression);
      await this.repository.save(job);

      return Result.ok({
        id: job.id,
        name: job.name,
        cronExpression: job.cronExpression,
        status: job.status,
        lastRunAt: job.lastRunAt?.toISOString(),
        nextRunAt: job.nextRunAt?.toISOString(),
        createdAt: job.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class TriggerJobUseCase implements IUseCase<{ id: string }, ScheduledJobDto> {
  constructor(
    private readonly repository: ISchedulerRepository,
    private readonly jobTasks: Map<string, () => Promise<void>>
  ) {}

  async execute({ id }: { id: string }): Promise<Result<ScheduledJobDto, Error>> {
    try {
      const job = await this.repository.findById(id);
      if (!job) return Result.fail(new NotFoundError(`Scheduled job with id '${id}'`));

      logger.info(`Scheduler executing task for job: ${job.name}`);
      const task = this.jobTasks.get(job.name);
      if (task) {
        await task();
      } else {
        logger.info(`Default no-op heartbeat executed for job: ${job.name}`);
      }

      job.recordExecutionSuccess();
      await this.repository.save(job);

      return Result.ok({
        id: job.id,
        name: job.name,
        cronExpression: job.cronExpression,
        status: job.status,
        lastRunAt: job.lastRunAt?.toISOString(),
        nextRunAt: job.nextRunAt?.toISOString(),
        createdAt: job.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
