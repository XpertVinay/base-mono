import { ScheduledJob } from '../entities/job.entity.js';

export interface ISchedulerRepository {
  findById(id: string): Promise<ScheduledJob | null>;
  findByName(name: string): Promise<ScheduledJob | null>;
  findAll(): Promise<ScheduledJob[]>;
  save(job: ScheduledJob): Promise<void>;
}
