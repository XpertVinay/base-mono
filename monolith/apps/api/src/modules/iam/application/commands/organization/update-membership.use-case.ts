import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { UpdateMembershipRequestDto, OrganizationMembershipDto } from '@monolith/contracts';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class UpdateMembershipUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository
  ) {}

  async execute(adminUserId: string, organizationId: string, targetUserId: string, dto: UpdateMembershipRequestDto): Promise<OrganizationMembershipDto> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Organization '${organizationId}' not found`);
    }

    const adminMembership = await this.membershipRepo.findByOrgAndUser(organizationId, adminUserId);
    if (!adminMembership || !adminMembership.isActive() || (!adminMembership.isAdmin() && org.ownerUserId !== adminUserId)) {
      throw new ForbiddenError('Only organization administrators can update member roles or statuses');
    }

    const targetMembership = await this.membershipRepo.findByOrgAndUser(organizationId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundError(`Membership for user '${targetUserId}' not found in organization`);
    }

    // Owner cannot be suspended or demoted by another admin
    if (org.ownerUserId === targetUserId && (dto.status === 'SUSPENDED' || dto.status === 'REJECTED' || dto.role === 'MEMBER')) {
      throw new BadRequestError('Cannot modify status or demote the primary organization owner');
    }

    if (dto.role) {
      targetMembership.updateRole(dto.role);
    }

    if (dto.status) {
      if (dto.status === 'ACTIVE') {
        targetMembership.activate();
      } else if (dto.status === 'SUSPENDED') {
        targetMembership.suspend();
      } else if (dto.status === 'REJECTED') {
        targetMembership.reject();
      }
    }

    await this.membershipRepo.save(targetMembership);

    return {
      id: targetMembership.id,
      organizationId: targetMembership.organizationId,
      userId: targetMembership.userId,
      role: targetMembership.role,
      status: targetMembership.status,
      joinedAt: targetMembership.joinedAt?.toISOString() || null,
      createdAt: targetMembership.createdAt.toISOString(),
      updatedAt: targetMembership.updatedAt.toISOString()
    };
  }
}
