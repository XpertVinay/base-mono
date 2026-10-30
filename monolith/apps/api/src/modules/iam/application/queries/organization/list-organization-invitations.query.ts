import { IOrganizationInvitationRepository } from '../../../domain/repositories/organization-invitation-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { OrganizationInvitationDto } from '@monolith/contracts';
import { ForbiddenError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class ListOrganizationInvitationsQuery {
  constructor(
    private readonly invitationRepo: IOrganizationInvitationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository
  ) {}

  async execute(requestingUserId: string, organizationId: string): Promise<OrganizationInvitationDto[]> {
    const callerMembership = await this.membershipRepo.findByOrgAndUser(organizationId, requestingUserId);
    if (!callerMembership || !callerMembership.isActive() || !callerMembership.isAdmin()) {
      throw new ForbiddenError('Access denied: Only organization administrators can view invitations');
    }

    const invitations = await this.invitationRepo.findByOrganizationId(organizationId);
    return invitations.map(inv => ({
      id: inv.id,
      organizationId: inv.organizationId,
      invitedEmail: inv.invitedEmail,
      invitedByUserId: inv.invitedByUserId,
      role: inv.role,
      token: inv.token,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString()
    }));
  }
}
