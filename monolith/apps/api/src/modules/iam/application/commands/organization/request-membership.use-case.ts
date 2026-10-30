import { v4 as uuidv4 } from 'uuid';
import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { OrganizationMembership } from '../../../domain/entities/organization-membership.entity.js';
import { OrganizationMembershipDto } from '@monolith/contracts';
import { NotFoundError, ConflictError, BadRequestError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class RequestMembershipUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository
  ) {}

  async execute(userId: string, organizationId: string): Promise<OrganizationMembershipDto> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Organization '${organizationId}' not found`);
    }

    if (!org.isAccessible()) {
      throw new BadRequestError('Organization is currently suspended or archived');
    }

    const existing = await this.membershipRepo.findByOrgAndUser(organizationId, userId);
    if (existing) {
      if (existing.isActive()) {
        throw new ConflictError('User is already an active member of this organization');
      }
      if (existing.status === 'PENDING') {
        throw new ConflictError('Membership request is already pending approval');
      }
      if (existing.status === 'SUSPENDED') {
        throw new ConflictError('User membership is suspended; contact organization administrator');
      }
    }

    const membership = new OrganizationMembership({
      id: existing ? existing.id : uuidv4(),
      organizationId,
      userId,
      role: 'MEMBER',
      status: 'PENDING',
      joinedAt: null
    });

    await this.membershipRepo.save(membership);

    return {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
      organizationName: org.name,
      joinedAt: null,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString()
    };
  }
}
