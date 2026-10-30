import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { OrganizationDto } from '@monolith/contracts';
import { NotFoundError, ForbiddenError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class GetOrganizationQuery {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository
  ) {}

  async execute(identifier: string, requestingUserId?: string, isPlatformAdmin: boolean = false): Promise<OrganizationDto> {
    let org = await this.orgRepo.findById(identifier);
    if (!org) {
      org = await this.orgRepo.findBySlug(identifier);
    }

    if (!org) {
      throw new NotFoundError(`Organization '${identifier}' not found`);
    }

    if (requestingUserId && !isPlatformAdmin) {
      const membership = await this.membershipRepo.findByOrgAndUser(org.id, requestingUserId);
      if (!membership || !membership.isActive()) {
        throw new ForbiddenError(`Access denied: User is not an active member of organization '${org.name}'`);
      }
    }

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
