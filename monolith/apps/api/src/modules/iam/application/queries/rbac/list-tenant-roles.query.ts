import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { ITenantRoleRepository } from '../../../domain/repositories/tenant-role-repository.interface.js';
import { TenantRoleDto, SYSTEM_ROLE_PERMISSIONS } from '@monolith/contracts';
import { NotFoundError, ForbiddenError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class ListTenantRolesQuery {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly tenantRoleRepo: ITenantRoleRepository
  ) {}

  async execute(organizationId: string, userId: string): Promise<TenantRoleDto[]> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Tenant organization '${organizationId}' not found`);
    }

    // Must be owner or active member
    if (org.ownerUserId !== userId) {
      const membership = await this.membershipRepo.findByOrgAndUser(organizationId, userId);
      if (!membership || !membership.isActive()) {
        throw new ForbiddenError(`User is not an active member of organization '${org.name}'`);
      }
    }

    // Fetch custom roles for this tenant
    const customRoles = await this.tenantRoleRepo.findByTenantId(organizationId);
    const result: TenantRoleDto[] = customRoles.map(r => ({
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      description: r.description || undefined,
      isSystem: r.isSystem,
      permissions: r.permissions,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));

    // If custom roles don't already include system default roles, list default templates as system roles
    const existingNames = new Set(result.map(r => r.name));
    for (const [sysName, perms] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
      if (!existingNames.has(sysName)) {
        result.push({
          id: `system-${sysName.toLowerCase()}`,
          tenantId: organizationId,
          name: sysName,
          description: `Built-in system role for ${sysName}`,
          isSystem: true,
          permissions: perms,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString()
        });
      }
    }

    return result;
  }
}
