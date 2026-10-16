export type JobStatus = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface ScheduledJobDto {
  id: string;
  name: string;
  cronExpression: string;
  status: JobStatus;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

export interface CreateScheduledJobRequestDto {
  name: string;
  cronExpression: string;
}
