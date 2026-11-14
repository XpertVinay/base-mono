import { v4 as uuidv4 } from 'uuid';
import { Role } from '../../domain/entities/role.entity.js';
import { IRoleRepository, ListRolesOptions } from '../../domain/repositories/role-repository.interface.js';
import { IPermissionRepository } from '../../domain/repositories/permission-repository.interface.js';
import { IUserRoleRepository } from '../../domain/repositories/user-role-repository.interface.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import {
  createRoleCreatedEvent,
  createRoleUpdatedEvent,
  createRoleDeletedEvent
} from '../../domain/events/rbac.events.js';
import { AppError, NotFoundError } from '../../shared/domain/errors.js';

export interface CreateRoleDTO {
  tenantId: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export class CreateRoleUseCase {
  constructor(
    private readonly roleRepo: IRoleRepository,
    private readonly permRepo: IPermissionRepository
  ) {}

  async execute(dto: CreateRoleDTO): Promise<Role> {
    const tenantId = dto.tenantId || 'default';
    const roleName = dto.name.trim().toUpperCase();

    const exists = await this.roleRepo.existsByName(tenantId, roleName);
    if (exists) {
      throw new AppError(`Role '${roleName}' already exists in tenant '${tenantId}'`, 409, 'ROLE_ALREADY_EXISTS');
    }

    if (dto.permissions && dto.permissions.length > 0) {
      const validPermissions = await this.permRepo.listByNames(dto.permissions);
      const validNames = new Set(validPermissions.map(p => p.name.toLowerCase()));
      for (const p of dto.permissions) {
        if (!validNames.has(p.toLowerCase()) && p !== '*') {
          throw new AppError(`Invalid permission: '${p}'`, 400, 'INVALID_PERMISSION');
        }
      }
    }

    const role = new Role({
      id: `role_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      tenantId,
      name: roleName,
      description: dto.description,
      isSystem: false,
      permissions: dto.permissions || []
    });

    const saved = await this.roleRepo.create(role);

    const evt = createRoleCreatedEvent({
      id: saved.id,
      tenantId: saved.tenantId,
      name: saved.name,
      isSystem: saved.isSystem,
      permissions: saved.permissions
    });
    await rabbitmq.publish(evt.eventName, evt);

    return saved;
  }
}

export class GetRoleByIdQuery {
  constructor(private readonly roleRepo: IRoleRepository) {}

  async execute(tenantId: string, id: string): Promise<Role> {
    const role = await this.roleRepo.findById(tenantId, id);
    if (!role) {
      throw new NotFoundError(`Role '${id}'`);
    }
    return role;
  }
}

export class ListRolesQuery {
  constructor(private readonly roleRepo: IRoleRepository) {}

  async execute(tenantId: string, options?: ListRolesOptions): Promise<{ items: Role[]; total: number }> {
    return this.roleRepo.list(tenantId, options);
  }
}

export interface UpdateRoleDTO {
  tenantId: string;
  id: string;
  name?: string;
  description?: string | null;
  permissions?: string[];
}

export class UpdateRoleUseCase {
  constructor(
    private readonly roleRepo: IRoleRepository,
    private readonly permRepo: IPermissionRepository
  ) {}

  async execute(dto: UpdateRoleDTO): Promise<Role> {
    const tenantId = dto.tenantId || 'default';
    const role = await this.roleRepo.findById(tenantId, dto.id);
    if (!role) {
      throw new NotFoundError(`Role '${dto.id}'`);
    }

    if (dto.name && dto.name.trim().toUpperCase() !== role.name) {
      if (role.isSystem) {
        throw new AppError('System roles cannot be renamed', 400, 'CANNOT_RENAME_SYSTEM_ROLE');
      }
      const exists = await this.roleRepo.existsByName(tenantId, dto.name.trim().toUpperCase(), role.id);
      if (exists) {
        throw new AppError(`Role '${dto.name.trim().toUpperCase()}' already exists`, 409, 'ROLE_ALREADY_EXISTS');
      }
    }

    if (dto.permissions !== undefined) {
      if (dto.permissions.length > 0) {
        const validPermissions = await this.permRepo.listByNames(dto.permissions);
        const validNames = new Set(validPermissions.map(p => p.name.toLowerCase()));
        for (const p of dto.permissions) {
          if (!validNames.has(p.toLowerCase()) && p !== '*') {
            throw new AppError(`Invalid permission: '${p}'`, 400, 'INVALID_PERMISSION');
          }
        }
      }
      role.setPermissions(dto.permissions);
    }

    role.updateDetails({
      name: dto.name,
      description: dto.description
    });

    const updated = await this.roleRepo.update(role);

    const evt = createRoleUpdatedEvent({
      id: updated.id,
      tenantId: updated.tenantId,
      name: updated.name,
      permissions: updated.permissions
    });
    await rabbitmq.publish(evt.eventName, evt);

    return updated;
  }
}

export class DeleteRoleUseCase {
  constructor(
    private readonly roleRepo: IRoleRepository,
    private readonly userRoleRepo: IUserRoleRepository
  ) {}

  async execute(tenantId: string, id: string): Promise<boolean> {
    const role = await this.roleRepo.findById(tenantId, id);
    if (!role) {
      throw new NotFoundError(`Role '${id}'`);
    }

    if (role.isSystem) {
      throw new AppError('Cannot delete system roles', 403, 'CANNOT_DELETE_SYSTEM_ROLE');
    }

    const assignedCount = await this.userRoleRepo.countAssignmentsByRoleId(tenantId, id);
    if (assignedCount > 0) {
      throw new AppError(
        `Cannot delete role '${role.name}'. It is actively assigned to ${assignedCount} user(s). Revoke all assignments first.`,
        400,
        'ROLE_IN_USE'
      );
    }

    const deleted = await this.roleRepo.delete(tenantId, id);

    const evt = createRoleDeletedEvent({
      roleId: id,
      tenantId,
      name: role.name
    });
    await rabbitmq.publish(evt.eventName, evt);

    return deleted;
  }
}
