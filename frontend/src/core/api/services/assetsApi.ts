import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export interface AssetDto {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  storageProvider?: string;
  bucket?: string;
  key?: string;
  ownerId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateAssetPayload {
  name: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface AssetQueryParams {
  mimeType?: string;
  page?: number;
  limit?: number;
}

const assetsPath = (subPath = ''): string => `${resolveServiceEndpoint('assets')}${subPath}`;

export const assetsApi = {
  /**
   * List assets (with optional filter)
   */
  async list(
    params?: AssetQueryParams,
    options?: RequestContextOptions
  ): Promise<ApiResult<AssetDto[]>> {
    try {
      const res = await apiClient.get<unknown>(assetsPath(), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<AssetDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * List assets owned by the currently authenticated user
   */
  async getMyAssets(options?: RequestContextOptions): Promise<ApiResult<AssetDto[]>> {
    try {
      const res = await apiClient.get<unknown>(assetsPath('/my'), options);
      return unwrapEnvelope<AssetDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get asset details by ID
   */
  async getById(id: string, options?: RequestContextOptions): Promise<ApiResult<AssetDto>> {
    try {
      const res = await apiClient.get<unknown>(assetsPath(`/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<AssetDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Register file or media asset metadata
   */
  async create(
    payload: CreateAssetPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<AssetDto>> {
    try {
      const res = await apiClient.post<unknown>(assetsPath(), payload, options);
      return unwrapEnvelope<AssetDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Delete an asset by ID
   */
  async delete(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ deleted: boolean }>> {
    try {
      const res = await apiClient.delete<unknown>(assetsPath(`/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<{ deleted: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

