import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { IUserRepository } from '../../../domain/repositories/user-repository.interface.js';
import { OrganizationMembershipDto } from '@monolith/contracts';
import { ForbiddenError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class ListOrganizationMembersQuery {
  constructor(
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly userRepo: IUserRepository
  ) {}

  async execute(requestingUserId: string, organizationId: string): Promise<OrganizationMembershipDto[]> {
    const callerMembership = await this.membershipRepo.findByOrgAndUser(organizationId, requestingUserId);
    if (!callerMembership || !callerMembership.isActive()) {
      throw new ForbiddenError('Access denied: User is not an active member of this organization');
    }

    const memberships = await this.membershipRepo.findByOrganizationId(organizationId);
    const results: OrganizationMembershipDto[] = [];

    for (const m of memberships) {
      const user = await this.userRepo.findById(m.userId);
      results.push({
        id: m.id,
        organizationId: m.organizationId,
        userId: m.userId,
        role: m.role,
        status: m.status,
        userEmail: user?.email,
        userName: user?.name,
        joinedAt: m.joinedAt?.toISOString() || null,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString()
      });
    }

    return results;
  }
}
