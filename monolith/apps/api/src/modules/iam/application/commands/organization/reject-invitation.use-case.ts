import { IOrganizationInvitationRepository } from '../../../domain/repositories/organization-invitation-repository.interface.js';
import { OrganizationInvitationDto } from '@monolith/contracts';
import { NotFoundError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class RejectInvitationUseCase {
  constructor(
    private readonly invitationRepo: IOrganizationInvitationRepository
  ) {}

  async execute(token: string): Promise<OrganizationInvitationDto> {
    const invitation = await this.invitationRepo.findByToken(token);
    if (!invitation) {
      throw new NotFoundError('Invitation not found or invalid token');
    }

    invitation.reject();
    await this.invitationRepo.save(invitation);

    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      invitedEmail: invitation.invitedEmail,
      invitedByUserId: invitation.invitedByUserId,
      role: invitation.role,
      token: invitation.token,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      updatedAt: invitation.updatedAt.toISOString()
    };
  }
}
