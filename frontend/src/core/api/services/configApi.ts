import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export type ConfigTarget = 'BACKEND' | 'FRONTEND' | 'ALL';

export interface ConfigSettingDto {
  key: string;
  value: string;
  description?: string;
  isEncrypted?: boolean;
  target?: ConfigTarget;
  updatedAt?: string;
}

export interface SetConfigPayload {
  key: string;
  value: string;
  description?: string;
  isEncrypted?: boolean;
  target?: ConfigTarget;
}

const configPath = (subPath = ''): string => `${resolveServiceEndpoint('config')}${subPath}`;

export const configApi = {
  /**
   * List all stored dynamic system configuration settings
   */
  async list(options?: RequestContextOptions): Promise<ApiResult<ConfigSettingDto[]>> {
    try {
      const res = await apiClient.get<unknown>(configPath(), options);
      return unwrapEnvelope<ConfigSettingDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get specific dynamic configuration setting by key
   */
  async getByKey(
    key: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<ConfigSettingDto>> {
    try {
      const res = await apiClient.get<unknown>(configPath(`/${encodeURIComponent(key)}`), options);
      return unwrapEnvelope<ConfigSettingDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Set (create or update) a dynamic configuration key-value pair
   */
  async set(
    payload: SetConfigPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<ConfigSettingDto>> {
    try {
      const res = await apiClient.post<unknown>(configPath(), payload, options);
      return unwrapEnvelope<ConfigSettingDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Delete a dynamic configuration key
   */
  async delete(
    key: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ deleted: boolean; key: string }>> {
    try {
      const res = await apiClient.delete<unknown>(configPath(`/${encodeURIComponent(key)}`), options);
      return unwrapEnvelope<{ deleted: boolean; key: string }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get client-accessible configuration key-value map for frontend
   */
  async getClientConfig(options?: RequestContextOptions): Promise<ApiResult<Record<string, string>>> {
    try {
      const res = await apiClient.get<unknown>(configPath('/client'), options);
      return unwrapEnvelope<Record<string, string>>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get modular sections summary (Multi-Tenant, IAM, White-label, etc.)
   */
  async getSectionsSummary(
    tenantId?: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<Record<string, unknown>>> {
    try {
      const res = await apiClient.get<unknown>(configPath('/sections'), {
        ...options,
        params: tenantId ? { tenantId } : undefined,
      });
      return unwrapEnvelope<Record<string, unknown>>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get a specific modular configuration section
   */
  async getSection(
    section: string,
    tenantId?: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<Record<string, unknown>>> {
    try {
      const res = await apiClient.get<unknown>(configPath(`/sections/${encodeURIComponent(section)}`), {
        ...options,
        params: tenantId ? { tenantId } : undefined,
      });
      return unwrapEnvelope<Record<string, unknown>>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Update a specific modular configuration section
   */
  async updateSection(
    section: string,
    payload: Record<string, unknown>,
    tenantId?: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<Record<string, unknown>>> {
    try {
      const res = await apiClient.put<unknown>(
        configPath(`/sections/${encodeURIComponent(section)}`),
        payload,
        {
          ...options,
          params: tenantId ? { tenantId } : undefined,
        }
      );
      return unwrapEnvelope<Record<string, unknown>>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

