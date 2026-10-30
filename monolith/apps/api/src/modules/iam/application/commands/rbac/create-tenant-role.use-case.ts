import crypto from 'crypto';
import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { ITenantRoleRepository } from '../../../domain/repositories/tenant-role-repository.interface.js';
import { TenantRole } from '../../../domain/entities/tenant-role.entity.js';
import {
  PlatformPermission,
  ALL_PLATFORM_PERMISSIONS,
  TenantRoleDto
} from '@monolith/contracts';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError
} from '../../../../../shared/presentation/error-handler.middleware.js';

export interface CreateTenantRoleCommand {
  organizationId: string;
  userId: string;
  name: string;
  description?: string;
  permissions: PlatformPermission[];
}

export class CreateTenantRoleUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly tenantRoleRepo: ITenantRoleRepository
  ) {}

  async execute(command: CreateTenantRoleCommand): Promise<TenantRoleDto> {
    const org = await this.orgRepo.findById(command.organizationId);
    if (!org) {
      throw new NotFoundError(`Tenant organization '${command.organizationId}' not found`);
    }

    if (!org.isAccessible()) {
      throw new ForbiddenError(`Organization '${org.name}' is ${org.status.toLowerCase()}`);
    }

    // Authorization: Must be organization owner or admin member
    const isOwner = org.ownerUserId === command.userId;
    if (!isOwner) {
      const membership = await this.membershipRepo.findByOrgAndUser(command.organizationId, command.userId);
      if (!membership || !membership.isActive() || !membership.isAdmin()) {
        throw new ForbiddenError('Only organization administrators can create custom roles');
      }
    }

    const trimmedName = command.name?.trim().toUpperCase();
    if (!trimmedName) {
      throw new BadRequestError('Role name is required');
    }

    // Check for existing role with same name in tenant
    const existing = await this.tenantRoleRepo.findByTenantAndName(command.organizationId, trimmedName);
    if (existing) {
      throw new ConflictError(`Role '${trimmedName}' already exists in this organization`);
    }

    // Validate permissions
    const invalidPerms = command.permissions.filter(p => !ALL_PLATFORM_PERMISSIONS.includes(p));
    if (invalidPerms.length > 0) {
      throw new BadRequestError(`Invalid platform permission(s): ${invalidPerms.join(', ')}`);
    }

    const role = new TenantRole({
      id: crypto.randomUUID(),
      tenantId: command.organizationId,
      name: trimmedName,
      description: command.description,
      isSystem: false,
      permissions: command.permissions
    });

    await this.tenantRoleRepo.save(role);

    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      description: role.description || undefined,
      isSystem: role.isSystem,
      permissions: role.permissions,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString()
    };
  }
}
