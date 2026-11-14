import { Job } from '../entities/job.entity.js';

export interface ISchedulerRepository {
  findById(id: string, tenantId?: string): Promise<Job | null>;
  findByName(name: string, tenantId?: string): Promise<Job | null>;
  listAll(tenantId?: string): Promise<Job[]>;
  save(job: Job): Promise<void>;
  update(job: Job): Promise<void>;
  delete(id: string, tenantId?: string): Promise<boolean>;
}
