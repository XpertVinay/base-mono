import { ISchedulerRepository } from '../../domain/repositories/scheduler-repository.interface.js';
import { JobStatus } from '../../domain/entities/job.entity.js';
import { Result } from '../../shared/domain/result.js';

export interface GetJobByIdDTO {
  id: string;
}

export interface UpdateJobDTO {
  id: string;
  name?: string;
  cronExpression?: string;
  status?: JobStatus;
}

export interface DeleteJobDTO {
  id: string;
}

export class GetJobByIdQuery {
  constructor(private readonly repo: ISchedulerRepository) {}

  async execute(dto: GetJobByIdDTO): Promise<Result<any>> {
    const job = await this.repo.findById(dto.id);
    if (!job) {
      return Result.fail('Job not found');
    }

    return Result.ok({
      id: job.id,
      name: job.name,
      cronExpression: job.cronExpression,
      status: job.status,
      lastRunAt: job.lastRunAt,
      nextRunAt: job.nextRunAt,
      createdAt: job.createdAt
    });
  }
}

export class UpdateJobUseCase {
  constructor(private readonly repo: ISchedulerRepository) {}

  async execute(dto: UpdateJobDTO): Promise<Result<any>> {
    const job = await this.repo.findById(dto.id);
    if (!job) {
      return Result.fail('Job not found');
    }

    job.update({
      name: dto.name,
      cronExpression: dto.cronExpression,
      status: dto.status
    });

    await this.repo.update(job);

    return Result.ok({
      id: job.id,
      name: job.name,
      cronExpression: job.cronExpression,
      status: job.status,
      lastRunAt: job.lastRunAt,
      nextRunAt: job.nextRunAt,
      createdAt: job.createdAt
    });
  }
}

export class DeleteJobUseCase {
  constructor(private readonly repo: ISchedulerRepository) {}

  async execute(dto: DeleteJobDTO): Promise<Result<{ id: string; deleted: boolean }>> {
    const job = await this.repo.findById(dto.id);
    if (!job) {
      return Result.fail('Job not found');
    }

    const deleted = await this.repo.delete(dto.id);
    if (!deleted) {
      return Result.fail('Failed to delete job');
    }

    return Result.ok({ id: dto.id, deleted: true });
  }
}

