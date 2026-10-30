import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { ITenantRoleRepository } from '../../../domain/repositories/tenant-role-repository.interface.js';
import {
  PlatformPermission,
  ALL_PLATFORM_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  SystemRoleName,
  TenantUserPermissionsDto
} from '@monolith/contracts';
import { NotFoundError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class EvaluatePermissionQuery {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly tenantRoleRepo: ITenantRoleRepository
  ) {}

  async execute(userId: string, organizationId: string): Promise<TenantUserPermissionsDto> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Tenant organization '${organizationId}' not found`);
    }

    // 1. Owner Invariant: Primary organization owners inherently satisfy all tenant permissions
    if (org.ownerUserId === userId) {
      return {
        userId,
        tenantId: organizationId,
        isOwner: true,
        roles: ['ORGANIZATION_OWNER'],
        permissions: [...ALL_PLATFORM_PERMISSIONS]
      };
    }

    // 2. Fetch Membership
    const membership = await this.membershipRepo.findByOrgAndUser(organizationId, userId);
    if (!membership || !membership.isActive()) {
      return {
        userId,
        tenantId: organizationId,
        isOwner: false,
        roles: membership ? [membership.role] : [],
        permissions: []
      };
    }

    // 3. Resolve permissions from custom tenant role and/or membership role
    const permissionsSet = new Set<PlatformPermission>();
    const rolesList = new Set<string>();

    if (membership.role) {
      rolesList.add(membership.role);
    }

    // Check custom role assigned by ID
    if (membership.tenantRoleId) {
      const assignedRole = await this.tenantRoleRepo.findById(membership.tenantRoleId);
      if (assignedRole && assignedRole.tenantId === organizationId) {
        rolesList.add(assignedRole.name);
        for (const p of assignedRole.permissions) {
          permissionsSet.add(p);
        }
      }
    }

    // Check if tenant has customized role matching membership role name
    if (membership.role) {
      const customRoleByName = await this.tenantRoleRepo.findByTenantAndName(organizationId, membership.role);
      if (customRoleByName) {
        rolesList.add(customRoleByName.name);
        for (const p of customRoleByName.permissions) {
          permissionsSet.add(p);
        }
      } else if (membership.role === 'ADMIN' || membership.role === 'ORGANIZATION_ADMIN') {
        // ADMIN membership role has full access within tenant
        for (const p of ALL_PLATFORM_PERMISSIONS) {
          permissionsSet.add(p);
        }
      } else if (SYSTEM_ROLE_PERMISSIONS[membership.role as SystemRoleName]) {
        // Fall back to baseline system role permissions
        for (const p of SYSTEM_ROLE_PERMISSIONS[membership.role as SystemRoleName]) {
          permissionsSet.add(p);
        }
      }
    }

    return {
      userId,
      tenantId: organizationId,
      isOwner: false,
      roles: Array.from(rolesList),
      permissions: Array.from(permissionsSet)
    };
  }
}
