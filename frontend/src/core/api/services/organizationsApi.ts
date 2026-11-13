import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export type OrganizationTier = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'DEACTIVATED';
export type OrganizationMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'BILLING_ADMIN';
export type OrganizationMemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface OrganizationBranding {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  industry: string;
  tier: OrganizationTier;
  status: OrganizationStatus;
  branding?: OrganizationBranding;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberDto {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  role: OrganizationMemberRole;
  status: OrganizationMemberStatus;
  joinedAt: string;
}

export interface OrganizationQueryParams {
  search?: string;
  status?: OrganizationStatus;
  tier?: OrganizationTier;
  industry?: string;
  page?: number;
  limit?: number;
}

export interface CreateOrganizationPayload {
  name: string;
  slug?: string;
  domain?: string;
  industry: string;
  tier?: OrganizationTier;
  ownerEmail?: string;
  branding?: OrganizationBranding;
  settings?: Record<string, unknown>;
}

export interface UpdateOrganizationPayload {
  name?: string;
  domain?: string;
  industry?: string;
  tier?: OrganizationTier;
  branding?: OrganizationBranding;
  settings?: Record<string, unknown>;
}

export interface MemberQueryParams {
  role?: OrganizationMemberRole;
  status?: OrganizationMemberStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AddOrganizationMemberPayload {
  email: string;
  name?: string;
  role: OrganizationMemberRole;
}

export interface UpdateOrganizationMemberPayload {
  role?: OrganizationMemberRole;
  status?: OrganizationMemberStatus;
}

const orgPath = (subPath = ''): string => `${resolveServiceEndpoint('organizations')}${subPath}`;

export const organizationsApi = {
  /**
   * List organizations with optional filtering and pagination
   */
  async list(
    params?: OrganizationQueryParams,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrganizationDto[]>> {
    try {
      const res = await apiClient.get<unknown>(orgPath(), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<OrganizationDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get organization by ID or slug
   */
  async getByIdOrSlug(
    idOrSlug: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrganizationDto>> {
    try {
      const res = await apiClient.get<unknown>(orgPath(`/${encodeURIComponent(idOrSlug)}`), options);
      return unwrapEnvelope<OrganizationDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Create a new organization
   */
  async create(
    payload: CreateOrganizationPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrganizationDto>> {
    try {
      const res = await apiClient.post<unknown>(orgPath(), payload, options);
      return unwrapEnvelope<OrganizationDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Fully update an organization by ID
   */
  async update(
    id: string,
    payload: UpdateOrganizationPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrganizationDto>> {
    try {
      const res = await apiClient.put<unknown>(orgPath(`/${encodeURIComponent(id)}`), payload, options);
      return unwrapEnvelope<OrganizationDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Partially update an organization by ID
   */
  async patch(
    id: string,
    payload: Partial<UpdateOrganizationPayload>,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrganizationDto>> {
    try {
      const res = await apiClient.patch<unknown>(orgPath(`/${encodeURIComponent(id)}`), payload, options);
      return unwrapEnvelope<OrganizationDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Soft-delete an organization by ID
   */
  async delete(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ deleted: boolean }>> {
    try {
      const res = await apiClient.delete<unknown>(orgPath(`/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<{ deleted: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Update organization status (e.g. ACTIVE, SUSPENDED, TRIAL, DEACTIVATED)
   */
  async updateStatus(
    id: string,
    status: OrganizationStatus,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrganizationDto>> {
    try {
      const res = await apiClient.patch<unknown>(
        orgPath(`/${encodeURIComponent(id)}/status`),
        { status },
        options
      );
      return unwrapEnvelope<OrganizationDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * List members of an organization
   */
  async listMembers(
    id: string,
    params?: MemberQueryParams,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrganizationMemberDto[]>> {
    try {
      const res = await apiClient.get<unknown>(orgPath(`/${encodeURIComponent(id)}/members`), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<OrganizationMemberDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Add a member to an organization
   */
  async addMember(
    id: string,
    payload: AddOrganizationMemberPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrganizationMemberDto>> {
    try {
      const res = await apiClient.post<unknown>(
        orgPath(`/${encodeURIComponent(id)}/members`),
        payload,
        options
      );
      return unwrapEnvelope<OrganizationMemberDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Update an organization member's role or status
   */
  async updateMember(
    id: string,
    memberId: string,
    payload: UpdateOrganizationMemberPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrganizationMemberDto>> {
    try {
      const res = await apiClient.patch<unknown>(
        orgPath(`/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`),
        payload,
        options
      );
      return unwrapEnvelope<OrganizationMemberDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Remove a member from an organization
   */
  async removeMember(
    id: string,
    memberId: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ removed: boolean }>> {
    try {
      const res = await apiClient.delete<unknown>(
        orgPath(`/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`),
        options
      );
      return unwrapEnvelope<{ removed: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

