import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { ITenantRoleRepository } from '../../../domain/repositories/tenant-role-repository.interface.js';
import { OrganizationMembershipDto, SYSTEM_ROLE_PERMISSIONS, SystemRoleName } from '@monolith/contracts';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError
} from '../../../../../shared/presentation/error-handler.middleware.js';

export interface AssignRoleToMemberCommand {
  organizationId: string;
  userId: string;
  targetUserId: string;
  roleIdOrName: string;
}

export class AssignRoleToMemberUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly tenantRoleRepo: ITenantRoleRepository
  ) {}

  async execute(command: AssignRoleToMemberCommand): Promise<OrganizationMembershipDto> {
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
      const callerMembership = await this.membershipRepo.findByOrgAndUser(command.organizationId, command.userId);
      if (!callerMembership || !callerMembership.isActive() || !callerMembership.isAdmin()) {
        throw new ForbiddenError('Only organization administrators can assign roles to members');
      }
    }

    // Owner Invariant: Primary organization owners cannot be demoted or re-assigned
    if (org.ownerUserId === command.targetUserId) {
      throw new ForbiddenError('Cannot modify the role of the primary organization owner');
    }

    const membership = await this.membershipRepo.findByOrgAndUser(command.organizationId, command.targetUserId);
    if (!membership) {
      throw new NotFoundError(`User '${command.targetUserId}' is not a member of organization '${org.name}'`);
    }

    const roleInput = command.roleIdOrName.trim();
    if (!roleInput) {
      throw new BadRequestError('Role ID or role name is required');
    }

    // 1. Check if roleInput is a custom tenant role by ID
    let matchedRole = await this.tenantRoleRepo.findById(roleInput);
    if (!matchedRole || matchedRole.tenantId !== command.organizationId) {
      // 2. Check if roleInput is a custom tenant role by name
      matchedRole = await this.tenantRoleRepo.findByTenantAndName(command.organizationId, roleInput);
    }

    if (matchedRole) {
      membership.assignTenantRole(matchedRole.id, matchedRole.name);
    } else if (SYSTEM_ROLE_PERMISSIONS[roleInput.toUpperCase() as SystemRoleName] || roleInput.toUpperCase() === 'ADMIN' || roleInput.toUpperCase() === 'MEMBER') {
      const normalizedName = roleInput.toUpperCase();
      membership.assignTenantRole(null, normalizedName);
    } else {
      throw new NotFoundError(`Role '${roleInput}' does not exist in organization '${org.name}'`);
    }

    await this.membershipRepo.save(membership);

    return {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      tenantRoleId: membership.tenantRoleId,
      status: membership.status,
      organizationName: org.name,
      joinedAt: membership.joinedAt?.toISOString() || null,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString()
    };
  }
}
