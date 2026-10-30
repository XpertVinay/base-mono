import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class RemoveMemberUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository
  ) {}

  async execute(adminUserId: string, organizationId: string, targetUserId: string): Promise<void> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Organization '${organizationId}' not found`);
    }

    const adminMembership = await this.membershipRepo.findByOrgAndUser(organizationId, adminUserId);
    if (!adminMembership || !adminMembership.isActive() || (!adminMembership.isAdmin() && org.ownerUserId !== adminUserId)) {
      throw new ForbiddenError('Only organization administrators can remove members');
    }

    if (org.ownerUserId === targetUserId) {
      throw new BadRequestError('Cannot remove primary organization owner');
    }

    const targetMembership = await this.membershipRepo.findByOrgAndUser(organizationId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundError(`Membership for user '${targetUserId}' not found in organization`);
    }

    await this.membershipRepo.delete(targetMembership.id);
  }
}
