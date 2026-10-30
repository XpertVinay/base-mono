import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { ITenantRoleRepository } from '../../../domain/repositories/tenant-role-repository.interface.js';
import { TenantRoleDto, SYSTEM_ROLE_PERMISSIONS, SystemRoleName } from '@monolith/contracts';
import { NotFoundError, ForbiddenError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class GetTenantRoleQuery {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly tenantRoleRepo: ITenantRoleRepository
  ) {}

  async execute(organizationId: string, roleIdOrName: string, userId: string): Promise<TenantRoleDto> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Tenant organization '${organizationId}' not found`);
    }

    if (org.ownerUserId !== userId) {
      const membership = await this.membershipRepo.findByOrgAndUser(organizationId, userId);
      if (!membership || !membership.isActive()) {
        throw new ForbiddenError(`User is not an active member of organization '${org.name}'`);
      }
    }

    // Try finding by id
    let role = await this.tenantRoleRepo.findById(roleIdOrName);
    if (!role || role.tenantId !== organizationId) {
      role = await this.tenantRoleRepo.findByTenantAndName(organizationId, roleIdOrName);
    }

    if (role && role.tenantId === organizationId) {
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

    // Check system roles
    const normalized = roleIdOrName.replace(/^system-/, '').toUpperCase() as SystemRoleName;
    if (SYSTEM_ROLE_PERMISSIONS[normalized]) {
      return {
        id: `system-${normalized.toLowerCase()}`,
        tenantId: organizationId,
        name: normalized,
        description: `Built-in system role for ${normalized}`,
        isSystem: true,
        permissions: SYSTEM_ROLE_PERMISSIONS[normalized],
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString()
      };
    }

    throw new NotFoundError(`Role '${roleIdOrName}' not found in organization '${org.name}'`);
  }
}
