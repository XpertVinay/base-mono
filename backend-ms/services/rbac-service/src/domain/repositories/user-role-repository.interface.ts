import { UserRoleAssignment } from '../entities/user-role-assignment.entity.js';

export interface IUserRoleRepository {
  assignRole(assignment: UserRoleAssignment): Promise<UserRoleAssignment>;
  revokeRole(tenantId: string, userId: string, roleId: string): Promise<boolean>;
  getUserRoles(tenantId: string, userId: string): Promise<UserRoleAssignment[]>;
  getUsersByRole(tenantId: string, roleId: string): Promise<UserRoleAssignment[]>;
  hasRole(tenantId: string, userId: string, roleIdOrName: string): Promise<boolean>;
  getUserPermissions(tenantId: string, userId: string): Promise<string[]>;
  countAssignmentsByRoleId(tenantId: string, roleId: string): Promise<number>;
  assignmentExists(tenantId: string, userId: string, roleId: string): Promise<boolean>;
}

