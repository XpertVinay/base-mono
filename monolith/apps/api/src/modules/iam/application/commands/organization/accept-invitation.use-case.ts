import { v4 as uuidv4 } from 'uuid';
import { IOrganizationInvitationRepository } from '../../../domain/repositories/organization-invitation-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { OrganizationMembership } from '../../../domain/entities/organization-membership.entity.js';
import { OrganizationMembershipDto } from '@monolith/contracts';
import { NotFoundError, BadRequestError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class AcceptInvitationUseCase {
  constructor(
    private readonly invitationRepo: IOrganizationInvitationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly orgRepo: IOrganizationRepository
  ) {}

  async execute(userId: string, token: string): Promise<OrganizationMembershipDto> {
    const invitation = await this.invitationRepo.findByToken(token);
    if (!invitation) {
      throw new NotFoundError('Invitation not found or invalid token');
    }

    if (invitation.isExpired()) {
      invitation.accept(); // will throw or transition to EXPIRED
    }

    const org = await this.orgRepo.findById(invitation.organizationId);
    if (!org || !org.isAccessible()) {
      throw new BadRequestError('Organization is not active or no longer exists');
    }

    // Accept invitation
    invitation.accept();
    await this.invitationRepo.save(invitation);

    // Create or activate membership
    let membership = await this.membershipRepo.findByOrgAndUser(invitation.organizationId, userId);
    if (membership) {
      membership.activate();
      membership.updateRole(invitation.role);
    } else {
      membership = new OrganizationMembership({
        id: uuidv4(),
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
        status: 'ACTIVE',
        joinedAt: new Date()
      });
    }

    await this.membershipRepo.save(membership);

    return {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
      organizationName: org.name,
      joinedAt: membership.joinedAt?.toISOString() || null,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString()
    };
  }
}
