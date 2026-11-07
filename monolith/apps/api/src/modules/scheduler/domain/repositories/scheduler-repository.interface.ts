import { ScheduledJob } from '../entities/job.entity.js';
import { JobStatus } from '@monolith/contracts';

export interface JobRunRecord {
  id: string;
  jobId: string;
  tenantId?: string;
  status: JobStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  failureReason?: string;
}

export interface ISchedulerRepository {
  findById(id: string, tenantId?: string): Promise<ScheduledJob | null>;
  findByName(name: string, tenantId?: string): Promise<ScheduledJob | null>;
  findAll(tenantId?: string): Promise<ScheduledJob[]>;
  save(job: ScheduledJob): Promise<void>;
  saveJobRun(run: JobRunRecord): Promise<void>;
  findJobRuns(jobId: string, tenantId?: string): Promise<JobRunRecord[]>;
}
