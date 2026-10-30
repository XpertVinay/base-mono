import { v4 as uuidv4 } from 'uuid';
import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { Organization } from '../../../domain/entities/organization.entity.js';
import { OrganizationMembership } from '../../../domain/entities/organization-membership.entity.js';
import { CreateOrganizationRequestDto, OrganizationDto } from '@monolith/contracts';
import { ConflictError } from '../../../../../shared/presentation/error-handler.middleware.js';

export class CreateOrganizationUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository
  ) {}

  async execute(userId: string, dto: CreateOrganizationRequestDto): Promise<OrganizationDto> {
    const slug = (dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || uuidv4().slice(0, 8));

    const existing = await this.orgRepo.findBySlug(slug);
    if (existing) {
      throw new ConflictError(`Organization with slug '${slug}' already exists`);
    }

    const orgId = uuidv4();
    const org = new Organization({
      id: orgId,
      name: dto.name,
      slug,
      type: dto.type || 'PROPERTY_MANAGEMENT',
      status: 'ACTIVE',
      ownerUserId: userId,
      metadata: dto.metadata || {}
    });

    // Creator automatically becomes an active ADMIN member
    const membership = new OrganizationMembership({
      id: uuidv4(),
      organizationId: orgId,
      userId,
      role: 'ADMIN',
      status: 'ACTIVE',
      joinedAt: new Date()
    });

    await this.orgRepo.save(org);
    await this.membershipRepo.save(membership);

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
