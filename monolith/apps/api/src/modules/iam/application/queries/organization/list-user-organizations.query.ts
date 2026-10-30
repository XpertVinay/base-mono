import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { OrganizationMembershipDto } from '@monolith/contracts';

export class ListUserOrganizationsQuery {
  constructor(
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly orgRepo: IOrganizationRepository
  ) {}

  async execute(userId: string): Promise<OrganizationMembershipDto[]> {
    const memberships = await this.membershipRepo.findByUserId(userId);
    const results: OrganizationMembershipDto[] = [];

    for (const m of memberships) {
      const org = await this.orgRepo.findById(m.organizationId);
      results.push({
        id: m.id,
        organizationId: m.organizationId,
        userId: m.userId,
        role: m.role,
        status: m.status,
        organizationName: org?.name || 'Unknown Organization',
        joinedAt: m.joinedAt?.toISOString() || null,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString()
      });
    }

    return results;
  }
}
