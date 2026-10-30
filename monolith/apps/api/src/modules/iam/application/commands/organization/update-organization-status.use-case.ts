import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { UpdateOrganizationStatusRequestDto, OrganizationDto } from '@monolith/contracts';
import { NotFoundError, ForbiddenError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class UpdateOrganizationStatusUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository
  ) {}

  async execute(userId: string, isPlatformAdmin: boolean, organizationId: string, dto: UpdateOrganizationStatusRequestDto): Promise<OrganizationDto> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Organization '${organizationId}' not found`);
    }

    if (!isPlatformAdmin) {
      const membership = await this.membershipRepo.findByOrgAndUser(organizationId, userId);
      if (!membership || !membership.isActive() || (!membership.isAdmin() && org.ownerUserId !== userId)) {
        throw new ForbiddenError('Only organization administrators or platform admins can alter organization status');
      }
    }

    org.updateStatus(dto.status);
    await this.orgRepo.save(org);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      status: org.status,
      ownerUserId: org.ownerUserId,
      metadata: org.metadata,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString()
    };
  }
}
