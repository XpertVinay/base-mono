export type JobStatus = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface ScheduledJobDto {
  id: string;
  tenantId?: string;
  name: string;
  cronExpression: string;
  status: JobStatus;
  lastRunAt?: string;
  nextRunAt?: string;
  failureReason?: string;
  createdAt: string;
}

export interface CreateScheduledJobRequestDto {
  tenantId?: string;
  name: string;
  cronExpression: string;
}

export interface JobRunDto {
  id: string;
  jobId: string;
  tenantId?: string;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  failureReason?: string;
}
