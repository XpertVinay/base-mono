import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export interface ScheduledJobDto {
  id: string;
  name: string;
  cronExpression: string;
  targetService: string;
  targetEndpoint: string;
  payload?: Record<string, unknown>;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

export interface CreateJobPayload {
  name: string;
  cronExpression: string;
  targetService: string;
  targetEndpoint: string;
  payload?: Record<string, unknown>;
  enabled?: boolean;
}

const schedulerPath = (subPath = ''): string => `${resolveServiceEndpoint('scheduler')}${subPath}`;

export const schedulerApi = {
  /**
   * List all registered scheduled cron jobs
   */
  async listJobs(options?: RequestContextOptions): Promise<ApiResult<ScheduledJobDto[]>> {
    try {
      const res = await apiClient.get<unknown>(schedulerPath('/jobs'), options);
      return unwrapEnvelope<ScheduledJobDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Register a new scheduled cron job
   */
  async createJob(
    payload: CreateJobPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<ScheduledJobDto>> {
    try {
      const res = await apiClient.post<unknown>(schedulerPath('/jobs'), payload, options);
      return unwrapEnvelope<ScheduledJobDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Manually trigger immediate execution of a scheduled job
   */
  async triggerJob(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ triggered: boolean; jobId: string }>> {
    try {
      const res = await apiClient.post<unknown>(
        schedulerPath(`/jobs/${encodeURIComponent(id)}/trigger`),
        {},
        options
      );
      return unwrapEnvelope<{ triggered: boolean; jobId: string }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Delete a scheduled cron job
   */
  async deleteJob(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ deleted: boolean }>> {
    try {
      const res = await apiClient.delete<unknown>(
        schedulerPath(`/jobs/${encodeURIComponent(id)}`),
        options
      );
      return unwrapEnvelope<{ deleted: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

