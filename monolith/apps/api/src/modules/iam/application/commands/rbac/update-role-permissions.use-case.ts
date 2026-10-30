import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { ITenantRoleRepository } from '../../../domain/repositories/tenant-role-repository.interface.js';
import {
  PlatformPermission,
  ALL_PLATFORM_PERMISSIONS,
  TenantRoleDto
} from '@monolith/contracts';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError
} from '../../../../../shared/presentation/error-handler.middleware.js';

export interface UpdateRolePermissionsCommand {
  organizationId: string;
  roleId: string;
  userId: string;
  permissions: PlatformPermission[];
}

export class UpdateRolePermissionsUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly tenantRoleRepo: ITenantRoleRepository
  ) {}

  async execute(command: UpdateRolePermissionsCommand): Promise<TenantRoleDto> {
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
        throw new ForbiddenError('Only organization administrators can update role permissions');
      }
    }

    const role = await this.tenantRoleRepo.findById(command.roleId);
    if (!role || role.tenantId !== command.organizationId) {
      throw new NotFoundError(`Role '${command.roleId}' not found in this organization`);
    }

    // Validate permissions
    const invalidPerms = command.permissions.filter(p => !ALL_PLATFORM_PERMISSIONS.includes(p));
    if (invalidPerms.length > 0) {
      throw new BadRequestError(`Invalid platform permission(s): ${invalidPerms.join(', ')}`);
    }

    role.setPermissions(command.permissions);
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
