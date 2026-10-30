import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { IOrganizationInvitationRepository } from '../../../domain/repositories/organization-invitation-repository.interface.js';
import { OrganizationInvitation } from '../../../domain/entities/organization-invitation.entity.js';
import { CreateInvitationRequestDto, OrganizationInvitationDto } from '@monolith/contracts';
import { NotFoundError, ForbiddenError, ConflictError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class InviteMemberUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly invitationRepo: IOrganizationInvitationRepository
  ) {}

  async execute(userId: string, organizationId: string, dto: CreateInvitationRequestDto): Promise<OrganizationInvitationDto> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Organization '${organizationId}' not found`);
    }

    const callerMembership = await this.membershipRepo.findByOrgAndUser(organizationId, userId);
    if (!callerMembership || !callerMembership.isActive() || (!callerMembership.isAdmin() && org.ownerUserId !== userId)) {
      throw new ForbiddenError('Only organization administrators can invite new members');
    }

    const email = dto.email.toLowerCase().trim();

    // Check if there is already an active pending invitation
    const existingInvitations = await this.invitationRepo.findByEmail(email);
    const activeInv = existingInvitations.find(i => i.organizationId === organizationId && i.status === 'PENDING' && !i.isExpired());
    if (activeInv) {
      throw new ConflictError(`An active invitation for ${email} already exists`);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresInDays = dto.expiresInDays || 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = new OrganizationInvitation({
      id: uuidv4(),
      organizationId,
      invitedEmail: email,
      invitedByUserId: userId,
      role: dto.role || 'MEMBER',
      token,
      status: 'PENDING',
      expiresAt
    });

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
