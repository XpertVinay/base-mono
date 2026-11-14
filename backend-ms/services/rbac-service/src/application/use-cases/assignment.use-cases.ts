import { v4 as uuidv4 } from 'uuid';
import { UserRoleAssignment } from '../../domain/entities/user-role-assignment.entity.js';
import { IUserRoleRepository } from '../../domain/repositories/user-role-repository.interface.js';
import { IRoleRepository } from '../../domain/repositories/role-repository.interface.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import {
  createUserRoleAssignedEvent,
  createUserRoleRevokedEvent
} from '../../domain/events/rbac.events.js';
import { AppError, NotFoundError } from '../../shared/domain/errors.js';

export interface AssignRoleDTO {
  tenantId: string;
  userId: string;
  roleId: string;
  assignedBy?: string | null;
}

export class AssignRoleToUserUseCase {
  constructor(
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly roleRepo: IRoleRepository
  ) {}

  async execute(dto: AssignRoleDTO): Promise<UserRoleAssignment> {
    const tenantId = dto.tenantId || 'default';
    const role = await this.roleRepo.findById(tenantId, dto.roleId);
    if (!role) {
      throw new NotFoundError(`Role '${dto.roleId}' in tenant '${tenantId}'`);
    }

    const alreadyAssigned = await this.userRoleRepo.assignmentExists(tenantId, dto.userId, dto.roleId);
    if (alreadyAssigned) {
      throw new AppError(`Role '${role.name}' is already assigned to user '${dto.userId}'`, 409, 'ROLE_ALREADY_ASSIGNED');
    }

    const assignment = new UserRoleAssignment({
      id: `ura_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      tenantId,
      userId: dto.userId,
      roleId: dto.roleId,
      roleName: role.name,
      assignedBy: dto.assignedBy
    });

    const saved = await this.userRoleRepo.assignRole(assignment);

    const evt = createUserRoleAssignedEvent({
      assignmentId: saved.id,
      tenantId: saved.tenantId,
      userId: saved.userId,
      roleId: saved.roleId,
      assignedBy: saved.assignedBy
    });
    await rabbitmq.publish(evt.eventName, evt);

    return saved;
  }
}

export class RevokeRoleFromUserUseCase {
  constructor(
    private readonly userRoleRepo: IUserRoleRepository
  ) {}

  async execute(tenantId: string, userId: string, roleId: string): Promise<boolean> {
    const exists = await this.userRoleRepo.assignmentExists(tenantId, userId, roleId);
    if (!exists) {
      throw new NotFoundError(`Role assignment for user '${userId}' and role '${roleId}'`);
    }

    const revoked = await this.userRoleRepo.revokeRole(tenantId, userId, roleId);

    const evt = createUserRoleRevokedEvent({
      tenantId,
      userId,
      roleId
    });
    await rabbitmq.publish(evt.eventName, evt);

    return revoked;
  }
}

export class GetUserRolesQuery {
  constructor(private readonly userRoleRepo: IUserRoleRepository) {}

  async execute(tenantId: string, userId: string): Promise<UserRoleAssignment[]> {
    return this.userRoleRepo.getUserRoles(tenantId, userId);
  }
}

export class ListRoleUsersQuery {
  constructor(
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly roleRepo: IRoleRepository
  ) {}

  async execute(tenantId: string, roleId: string): Promise<UserRoleAssignment[]> {
    const role = await this.roleRepo.findById(tenantId, roleId);
    if (!role) {
      throw new NotFoundError(`Role '${roleId}' in tenant '${tenantId}'`);
    }
    return this.userRoleRepo.getUsersByRole(tenantId, roleId);
  }
}

export interface CheckPermissionResult {
  userId: string;
  tenantId: string;
  permission: string;
  allowed: boolean;
  userRoles: string[];
  permissions: string[];
}

export class CheckUserPermissionQuery {
  constructor(
    private readonly userRoleRepo: IUserRoleRepository
  ) {}

  async execute(tenantId: string, userId: string, permission: string): Promise<CheckPermissionResult> {
    const assignments = await this.userRoleRepo.getUserRoles(tenantId, userId);
    const userRoles = assignments.map(a => a.roleName || a.roleId);
    const permissions = await this.userRoleRepo.getUserPermissions(tenantId, userId);

    const perm = permission.trim().toLowerCase();
    const permSet = new Set(permissions.map(p => p.toLowerCase()));

    let allowed = false;
    if (permSet.has('*') || permSet.has(perm)) {
      allowed = true;
    } else {
      const [domain] = perm.split(':');
      if (domain && permSet.has(`${domain}:*`)) {
        allowed = true;
      }
    }

    return {
      userId,
      tenantId,
      permission,
      allowed,
      userRoles,
      permissions
    };
  }
}
