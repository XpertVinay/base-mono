import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export interface RoleDto {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  tenantId?: string;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionDto {
  id: string;
  name: string;
  action: string;
  resource: string;
  category: string;
  description?: string;
  isSystem?: boolean;
}

export interface UserRoleAssignmentDto {
  id?: string;
  userId: string;
  roleId: string;
  roleName: string;
  assignedAt: string;
  assignedBy?: string;
}

export interface RoleQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isSystem?: boolean;
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  permissions?: string[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
}

export interface PermissionQueryParams {
  category?: string;
  page?: number;
  limit?: number;
}

export interface CreatePermissionPayload {
  name: string;
  action: string;
  resource: string;
  category: string;
  description?: string;
}

export interface UpdatePermissionPayload {
  name?: string;
  description?: string;
  category?: string;
}

export interface CheckPermissionPayload {
  permission?: string;
  action?: string;
  resource?: string;
}

export interface CheckPermissionResultDto {
  granted: boolean;
  userId: string;
  permission?: string;
  reason?: string;
}

const rbacPath = (subPath = ''): string => `${resolveServiceEndpoint('rbac')}${subPath}`;

export const rbacApi = {
  // --- Roles CRUD ---
  async listRoles(
    params?: RoleQueryParams,
    options?: RequestContextOptions
  ): Promise<ApiResult<RoleDto[]>> {
    try {
      const res = await apiClient.get<unknown>(rbacPath('/roles'), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<RoleDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async getRole(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<RoleDto>> {
    try {
      const res = await apiClient.get<unknown>(rbacPath(`/roles/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<RoleDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async createRole(
    payload: CreateRolePayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<RoleDto>> {
    try {
      const res = await apiClient.post<unknown>(rbacPath('/roles'), payload, options);
      return unwrapEnvelope<RoleDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async updateRole(
    id: string,
    payload: UpdateRolePayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<RoleDto>> {
    try {
      const res = await apiClient.put<unknown>(
        rbacPath(`/roles/${encodeURIComponent(id)}`),
        payload,
        options
      );
      return unwrapEnvelope<RoleDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async deleteRole(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ deleted: boolean }>> {
    try {
      const res = await apiClient.delete<unknown>(rbacPath(`/roles/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<{ deleted: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async getRolePermissions(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<string[]>> {
    try {
      const res = await apiClient.get<unknown>(
        rbacPath(`/roles/${encodeURIComponent(id)}/permissions`),
        options
      );
      return unwrapEnvelope<string[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async updateRolePermissions(
    id: string,
    permissions: string[],
    options?: RequestContextOptions
  ): Promise<ApiResult<{ updated: boolean; permissions: string[] }>> {
    try {
      const res = await apiClient.put<unknown>(
        rbacPath(`/roles/${encodeURIComponent(id)}/permissions`),
        { permissions },
        options
      );
      return unwrapEnvelope<{ updated: boolean; permissions: string[] }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async getRoleUsers(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<Array<{ id: string; email: string; name: string }>>> {
    try {
      const res = await apiClient.get<unknown>(rbacPath(`/roles/${encodeURIComponent(id)}/users`), options);
      return unwrapEnvelope<Array<{ id: string; email: string; name: string }>>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  // --- Permissions CRUD ---
  async listPermissions(
    params?: PermissionQueryParams,
    options?: RequestContextOptions
  ): Promise<ApiResult<PermissionDto[]>> {
    try {
      const res = await apiClient.get<unknown>(rbacPath('/permissions'), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<PermissionDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async getPermission(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<PermissionDto>> {
    try {
      const res = await apiClient.get<unknown>(
        rbacPath(`/permissions/${encodeURIComponent(id)}`),
        options
      );
      return unwrapEnvelope<PermissionDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async createPermission(
    payload: CreatePermissionPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<PermissionDto>> {
    try {
      const res = await apiClient.post<unknown>(rbacPath('/permissions'), payload, options);
      return unwrapEnvelope<PermissionDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async updatePermission(
    id: string,
    payload: UpdatePermissionPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<PermissionDto>> {
    try {
      const res = await apiClient.put<unknown>(
        rbacPath(`/permissions/${encodeURIComponent(id)}`),
        payload,
        options
      );
      return unwrapEnvelope<PermissionDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async deletePermission(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ deleted: boolean }>> {
    try {
      const res = await apiClient.delete<unknown>(
        rbacPath(`/permissions/${encodeURIComponent(id)}`),
        options
      );
      return unwrapEnvelope<{ deleted: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async listPermissionCategories(
    options?: RequestContextOptions
  ): Promise<ApiResult<string[]>> {
    try {
      const res = await apiClient.get<unknown>(rbacPath('/permissions/categories'), options);
      return unwrapEnvelope<string[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  // --- User Role Assignments & Checks ---
  async getUserRoles(
    userId: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<UserRoleAssignmentDto[]>> {
    try {
      const res = await apiClient.get<unknown>(
        rbacPath(`/users/${encodeURIComponent(userId)}/roles`),
        options
      );
      return unwrapEnvelope<UserRoleAssignmentDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async assignUserRole(
    userId: string,
    roleId: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<UserRoleAssignmentDto>> {
    try {
      const res = await apiClient.post<unknown>(
        rbacPath(`/users/${encodeURIComponent(userId)}/roles`),
        { roleId },
        options
      );
      return unwrapEnvelope<UserRoleAssignmentDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async revokeUserRole(
    userId: string,
    roleId: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ revoked: boolean }>> {
    try {
      const res = await apiClient.delete<unknown>(
        rbacPath(`/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`),
        options
      );
      return unwrapEnvelope<{ revoked: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async getUserPermissions(
    userId: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<string[]>> {
    try {
      const res = await apiClient.get<unknown>(
        rbacPath(`/users/${encodeURIComponent(userId)}/permissions`),
        options
      );
      return unwrapEnvelope<string[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  async checkPermission(
    userId: string,
    payload: CheckPermissionPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<CheckPermissionResultDto>> {
    try {
      const res = await apiClient.post<unknown>(
        rbacPath(`/users/${encodeURIComponent(userId)}/check-permission`),
        payload,
        options
      );
      return unwrapEnvelope<CheckPermissionResultDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

