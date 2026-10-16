import { Job } from '../entities/job.entity.js';

export interface ISchedulerRepository {
  findById(id: string): Promise<Job | null>;
  findByName(name: string): Promise<Job | null>;
  listAll(): Promise<Job[]>;
  save(job: Job): Promise<void>;
  update(job: Job): Promise<void>;
}
