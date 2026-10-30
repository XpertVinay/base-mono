import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { UserOrganizationContextDto } from '@monolith/contracts';
import { NotFoundError, ForbiddenError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class ValidateTenantContextQuery {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository
  ) {}

  async execute(userId: string, organizationId: string): Promise<UserOrganizationContextDto> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Tenant organization '${organizationId}' not found`);
    }

    if (!org.isAccessible()) {
      throw new ForbiddenError(`Tenant organization '${org.name}' is currently ${org.status.toLowerCase()}`);
    }

    const membership = await this.membershipRepo.findByOrgAndUser(organizationId, userId);
    if (!membership) {
      throw new ForbiddenError(`User is not a member of organization '${org.name}'`);
    }

    if (membership.status === 'SUSPENDED') {
      throw new ForbiddenError(`User membership in organization '${org.name}' is suspended`);
    }

    if (membership.status === 'PENDING') {
      throw new ForbiddenError(`User membership in organization '${org.name}' is pending approval`);
    }

    if (!membership.isActive()) {
      throw new ForbiddenError(`User membership in organization '${org.name}' is not active`);
    }

    return {
      activeOrganization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type,
        status: org.status,
        ownerUserId: org.ownerUserId,
        metadata: org.metadata,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString()
      },
      membership: {
        id: membership.id,
        organizationId: membership.organizationId,
        userId: membership.userId,
        role: membership.role,
        status: membership.status,
        organizationName: org.name,
        joinedAt: membership.joinedAt?.toISOString() || null,
        createdAt: membership.createdAt.toISOString(),
        updatedAt: membership.updatedAt.toISOString()
      },
      isOwner: org.ownerUserId === userId,
      isAdmin: membership.isAdmin() || org.ownerUserId === userId
    };
  }
}
