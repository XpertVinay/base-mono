import { IUserRoleRepository } from '../../domain/repositories/user-role-repository.interface.js';
import { UserRoleAssignment } from '../../domain/entities/user-role-assignment.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresUserRoleRepository implements IUserRoleRepository {
  async assignRole(assignment: UserRoleAssignment): Promise<UserRoleAssignment> {
    await dbPool.query(
      `INSERT INTO rbac.user_roles (id, tenant_id, user_id, role_id, assigned_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING`,
      [
        assignment.id,
        assignment.tenantId,
        assignment.userId,
        assignment.roleId,
        assignment.assignedBy,
        assignment.createdAt
      ]
    );
    return assignment;
  }

  async revokeRole(tenantId: string, userId: string, roleId: string): Promise<boolean> {
    const res = await dbPool.query(
      `DELETE FROM rbac.user_roles
       WHERE (tenant_id = $1 OR tenant_id = 'default') AND user_id = $2 AND role_id = $3`,
      [tenantId, userId, roleId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getUserRoles(tenantId: string, userId: string): Promise<UserRoleAssignment[]> {
    const res = await dbPool.query(
      `SELECT ur.id, ur.tenant_id, ur.user_id, ur.role_id, ur.assigned_by, ur.created_at, r.name as role_name
       FROM rbac.user_roles ur
       INNER JOIN rbac.roles r ON r.id = ur.role_id
       WHERE (ur.tenant_id = $1 OR ur.tenant_id = 'default') AND ur.user_id = $2
       ORDER BY ur.created_at DESC`,
      [tenantId, userId]
    );
    return res.rows.map(this.mapRowToEntity);
  }

  async getUsersByRole(tenantId: string, roleId: string): Promise<UserRoleAssignment[]> {
    const res = await dbPool.query(
      `SELECT ur.id, ur.tenant_id, ur.user_id, ur.role_id, ur.assigned_by, ur.created_at, r.name as role_name
       FROM rbac.user_roles ur
       INNER JOIN rbac.roles r ON r.id = ur.role_id
       WHERE (ur.tenant_id = $1 OR ur.tenant_id = 'default') AND ur.role_id = $2
       ORDER BY ur.created_at DESC`,
      [tenantId, roleId]
    );
    return res.rows.map(this.mapRowToEntity);
  }

  async hasRole(tenantId: string, userId: string, roleIdOrName: string): Promise<boolean> {
    const res = await dbPool.query(
      `SELECT 1
       FROM rbac.user_roles ur
       INNER JOIN rbac.roles r ON r.id = ur.role_id
       WHERE (ur.tenant_id = $1 OR ur.tenant_id = 'default')
         AND ur.user_id = $2
         AND (ur.role_id = $3 OR UPPER(r.name) = UPPER($3))
       LIMIT 1`,
      [tenantId, userId, roleIdOrName]
    );
    return res.rows.length > 0;
  }

  async getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    const res = await dbPool.query(
      `SELECT DISTINCT p.name
       FROM rbac.user_roles ur
       INNER JOIN rbac.role_permissions rp ON rp.role_id = ur.role_id
       INNER JOIN rbac.permissions p ON p.id = rp.permission_id
       WHERE (ur.tenant_id = $1 OR ur.tenant_id = 'default') AND ur.user_id = $2
       ORDER BY p.name ASC`,
      [tenantId, userId]
    );
    return res.rows.map(r => r.name);
  }

  async countAssignmentsByRoleId(tenantId: string, roleId: string): Promise<number> {
    const res = await dbPool.query(
      `SELECT COUNT(*) as count
       FROM rbac.user_roles
       WHERE (tenant_id = $1 OR tenant_id = 'default') AND role_id = $2`,
      [tenantId, roleId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  async assignmentExists(tenantId: string, userId: string, roleId: string): Promise<boolean> {
    const res = await dbPool.query(
      `SELECT 1
       FROM rbac.user_roles
       WHERE (tenant_id = $1 OR tenant_id = 'default') AND user_id = $2 AND role_id = $3
       LIMIT 1`,
      [tenantId, userId, roleId]
    );
    return res.rows.length > 0;
  }

  private mapRowToEntity(row: any): UserRoleAssignment {
    return new UserRoleAssignment({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      roleId: row.role_id,
      roleName: row.role_name,
      assignedBy: row.assigned_by,
      createdAt: new Date(row.created_at)
    });
  }
}

