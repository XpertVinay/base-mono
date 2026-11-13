import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import { EntityRecord } from '../mockBackend';
import { EntityRecordFormData } from '../../../features/records/recordSchema';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

const recordsPath = (subPath = ''): string => `${resolveServiceEndpoint('records')}${subPath}`;

export const recordsApi = {
  /**
   * List entity records for the active tenant
   */
  async list(options?: RequestContextOptions): Promise<ApiResult<EntityRecord[]>> {
    try {
      const res = await apiClient.get<unknown>(recordsPath(), options);
      return unwrapEnvelope<EntityRecord[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get an entity record by ID
   */
  async getById(id: string, options?: RequestContextOptions): Promise<ApiResult<EntityRecord>> {
    try {
      const res = await apiClient.get<unknown>(recordsPath(`/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<EntityRecord>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Create a new entity record
   */
  async create(
    payload: EntityRecordFormData,
    options?: RequestContextOptions
  ): Promise<ApiResult<EntityRecord>> {
    try {
      const res = await apiClient.post<unknown>(
        recordsPath(),
        {
          ...payload,
          tenantId: options?.tenantId,
        },
        options
      );
      return unwrapEnvelope<EntityRecord>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Update an existing entity record by ID
   */
  async update(
    id: string,
    payload: Partial<EntityRecordFormData>,
    options?: RequestContextOptions
  ): Promise<ApiResult<EntityRecord>> {
    try {
      const res = await apiClient.put<unknown>(
        recordsPath(`/${encodeURIComponent(id)}`),
        payload,
        options
      );
      return unwrapEnvelope<EntityRecord>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Delete an entity record by ID
   */
  async delete(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ success: boolean }>> {
    try {
      const res = await apiClient.delete<unknown>(recordsPath(`/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<{ success: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

