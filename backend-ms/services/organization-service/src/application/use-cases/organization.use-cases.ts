import { Organization } from '../../domain/entities/organization.entity.js';
import { OrganizationMember } from '../../domain/entities/organization-member.entity.js';
import { IOrganizationRepository, FindOrganizationsFilter } from '../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMemberRepository, FindMembersFilter } from '../../domain/repositories/organization-member-repository.interface.js';
import {
  OrganizationCreatedEvent,
  OrganizationUpdatedEvent,
  OrganizationStatusChangedEvent,
  OrganizationDeletedEvent,
  OrganizationMemberAddedEvent,
  OrganizationMemberRemovedEvent
} from '../../domain/events/organization.events.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { Result } from '../../shared/domain/result.js';
import {
  MemberRole,
  MemberStatus,
  OrganizationAddress,
  OrganizationDto,
  OrganizationMemberDto,
  OrganizationSettings,
  OrganizationStatus,
  OrganizationTier,
  PaginationMeta
} from '../../shared/contracts/index.js';

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  legalName?: string;
  status?: OrganizationStatus;
  tier?: OrganizationTier;
  industry?: string;
  taxId?: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  address?: OrganizationAddress;
  settings?: Partial<OrganizationSettings>;
  maxUsers?: number;
  initialOwner?: {
    userId: string;
    email: string;
    name: string;
  };
  correlationId?: string;
}

export class CreateOrganizationUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly memberRepo: IOrganizationMemberRepository
  ) {}

  async execute(input: CreateOrganizationInput): Promise<Result<OrganizationDto, string>> {
    try {
      const sanitizedSlug = Organization.sanitizeSlug(input.slug);
      if (!sanitizedSlug) {
        return Result.fail('Invalid organization slug. Must contain letters, numbers, or hyphens.');
      }

      const slugTaken = await this.orgRepo.existsBySlug(sanitizedSlug);
      if (slugTaken) {
        return Result.fail(`Organization slug '${sanitizedSlug}' is already taken.`);
      }

      const organization = Organization.create({
        name: input.name,
        slug: sanitizedSlug,
        legalName: input.legalName,
        status: input.status,
        tier: input.tier,
        industry: input.industry,
        taxId: input.taxId,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        website: input.website,
        address: input.address,
        settings: input.settings,
        maxUsers: input.maxUsers
      });

      await this.orgRepo.save(organization);

      // If initial owner user is provided, add them automatically as OWNER
      if (input.initialOwner?.userId) {
        const owner = OrganizationMember.create({
          organizationId: organization.id,
          userId: input.initialOwner.userId,
          email: input.initialOwner.email,
          name: input.initialOwner.name,
          role: 'OWNER',
          status: 'ACTIVE'
        });
        await this.memberRepo.saveMember(owner);
      }

      const orgDto = organization.toDto();
      const event = new OrganizationCreatedEvent(orgDto, input.correlationId);
      await rabbitmq.publish('organization.created', event.toIntegrationEvent());

      return Result.ok(orgDto);
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to create organization');
    }
  }
}

export class GetOrganizationQuery {
  constructor(private readonly orgRepo: IOrganizationRepository) {}

  async execute(idOrSlug: string): Promise<Result<OrganizationDto, string>> {
    try {
      let org = await this.orgRepo.findById(idOrSlug);
      if (!org) {
        org = await this.orgRepo.findBySlug(idOrSlug);
      }
      if (!org) {
        return Result.fail(`Organization '${idOrSlug}' not found`);
      }
      return Result.ok(org.toDto());
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to retrieve organization');
    }
  }
}

export class ListOrganizationsQuery {
  constructor(private readonly orgRepo: IOrganizationRepository) {}

  async execute(
    filter: FindOrganizationsFilter
  ): Promise<Result<{ items: OrganizationDto[]; pagination: PaginationMeta }, string>> {
    try {
      const page = Math.max(1, filter.page || 1);
      const limit = Math.min(100, Math.max(1, filter.limit || 20));

      const { items, total } = await this.orgRepo.findAll({
        ...filter,
        page,
        limit
      });

      const totalPages = Math.ceil(total / limit) || 1;

      return Result.ok({
        items: items.map((org) => org.toDto()),
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to list organizations');
    }
  }
}

export interface UpdateOrganizationInput {
  id: string;
  name?: string;
  legalName?: string;
  industry?: string;
  taxId?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: OrganizationAddress;
  tier?: OrganizationTier;
  maxUsers?: number;
  settings?: Partial<OrganizationSettings>;
  correlationId?: string;
}

export class UpdateOrganizationUseCase {
  constructor(private readonly orgRepo: IOrganizationRepository) {}

  async execute(input: UpdateOrganizationInput): Promise<Result<OrganizationDto, string>> {
    try {
      const organization = await this.orgRepo.findById(input.id);
      if (!organization) {
        return Result.fail(`Organization with ID '${input.id}' not found`);
      }

      organization.updateDetails({
        name: input.name,
        legalName: input.legalName,
        industry: input.industry,
        taxId: input.taxId,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        website: input.website,
        address: input.address,
        tier: input.tier,
        maxUsers: input.maxUsers
      });

      if (input.settings) {
        organization.updateSettings(input.settings);
      }

      await this.orgRepo.save(organization);

      const orgDto = organization.toDto();
      const event = new OrganizationUpdatedEvent(orgDto, input, input.correlationId);
      await rabbitmq.publish('organization.updated', event.toIntegrationEvent());

      return Result.ok(orgDto);
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to update organization');
    }
  }
}

export class UpdateOrganizationStatusUseCase {
  constructor(private readonly orgRepo: IOrganizationRepository) {}

  async execute(params: {
    id: string;
    status: OrganizationStatus;
    correlationId?: string;
  }): Promise<Result<OrganizationDto, string>> {
    try {
      const organization = await this.orgRepo.findById(params.id);
      if (!organization) {
        return Result.fail(`Organization with ID '${params.id}' not found`);
      }

      const oldStatus = organization.status;
      organization.updateStatus(params.status);
      await this.orgRepo.save(organization);

      const event = new OrganizationStatusChangedEvent(organization.id, oldStatus, params.status, params.correlationId);
      await rabbitmq.publish('organization.status_changed', event.toIntegrationEvent());

      return Result.ok(organization.toDto());
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to update organization status');
    }
  }
}

export class DeleteOrganizationUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly memberRepo: IOrganizationMemberRepository
  ) {}

  async execute(id: string, correlationId?: string): Promise<Result<boolean, string>> {
    try {
      const organization = await this.orgRepo.findById(id);
      if (!organization) {
        return Result.fail(`Organization with ID '${id}' not found`);
      }

      if (organization.id === 'default' || organization.slug === 'default') {
        return Result.fail('Cannot delete default system organization');
      }

      await this.memberRepo.deleteByOrg(id);
      const deleted = await this.orgRepo.delete(id);

      if (deleted) {
        const event = new OrganizationDeletedEvent(organization.id, organization.slug, correlationId);
        await rabbitmq.publish('organization.deleted', event.toIntegrationEvent());
      }

      return Result.ok(deleted);
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to delete organization');
    }
  }
}

export interface AddMemberInput {
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  role?: MemberRole;
  status?: MemberStatus;
  correlationId?: string;
}

export class AddOrganizationMemberUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly memberRepo: IOrganizationMemberRepository
  ) {}

  async execute(input: AddMemberInput): Promise<Result<OrganizationMemberDto, string>> {
    try {
      const organization = await this.orgRepo.findById(input.organizationId);
      if (!organization) {
        return Result.fail(`Organization '${input.organizationId}' not found`);
      }

      if (organization.status !== 'ACTIVE' && organization.status !== 'TRIAL') {
        return Result.fail(`Cannot add members to organization in '${organization.status}' status`);
      }

      if (!organization.isEmailAllowed(input.email)) {
        return Result.fail(`Email domain is not authorized by organization policy`);
      }

      const existing = await this.memberRepo.findByOrgAndUser(input.organizationId, input.userId);
      if (existing) {
        return Result.fail(`User '${input.userId}' is already a member of this organization`);
      }

      const currentCount = await this.memberRepo.countByOrg(input.organizationId);
      if (currentCount >= organization.maxUsers) {
        return Result.fail(`Member limit reached for tier '${organization.tier}' (Max: ${organization.maxUsers})`);
      }

      const member = OrganizationMember.create({
        organizationId: input.organizationId,
        userId: input.userId,
        email: input.email,
        name: input.name,
        role: input.role || 'MEMBER',
        status: input.status || 'ACTIVE'
      });

      await this.memberRepo.saveMember(member);

      const memberDto = member.toDto();
      const event = new OrganizationMemberAddedEvent(memberDto, input.correlationId);
      await rabbitmq.publish('organization.member_added', event.toIntegrationEvent());

      return Result.ok(memberDto);
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to add organization member');
    }
  }
}

export class ListOrganizationMembersQuery {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly memberRepo: IOrganizationMemberRepository
  ) {}

  async execute(
    organizationId: string,
    filter: FindMembersFilter
  ): Promise<Result<{ items: OrganizationMemberDto[]; pagination: PaginationMeta }, string>> {
    try {
      const exists = await this.orgRepo.exists(organizationId);
      if (!exists) {
        return Result.fail(`Organization '${organizationId}' not found`);
      }

      const page = Math.max(1, filter.page || 1);
      const limit = Math.min(100, Math.max(1, filter.limit || 20));

      const { items, total } = await this.memberRepo.findAllByOrg(organizationId, {
        ...filter,
        page,
        limit
      });

      const totalPages = Math.ceil(total / limit) || 1;

      return Result.ok({
        items: items.map((m) => m.toDto()),
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to list members');
    }
  }
}

export class UpdateOrganizationMemberRoleUseCase {
  constructor(private readonly memberRepo: IOrganizationMemberRepository) {}

  async execute(params: {
    memberId: string;
    role?: MemberRole;
    status?: MemberStatus;
  }): Promise<Result<OrganizationMemberDto, string>> {
    try {
      const member = await this.memberRepo.findById(params.memberId);
      if (!member) {
        return Result.fail(`Organization member '${params.memberId}' not found`);
      }

      if (params.role) member.updateRole(params.role);
      if (params.status) member.updateStatus(params.status);

      await this.memberRepo.saveMember(member);
      return Result.ok(member.toDto());
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to update member');
    }
  }
}

export class RemoveOrganizationMemberUseCase {
  constructor(private readonly memberRepo: IOrganizationMemberRepository) {}

  async execute(params: {
    organizationId: string;
    memberId: string;
    correlationId?: string;
  }): Promise<Result<boolean, string>> {
    try {
      const member = await this.memberRepo.findById(params.memberId);
      if (!member || member.organizationId !== params.organizationId) {
        return Result.fail(`Member not found in organization`);
      }

      if (member.role === 'OWNER') {
        const { items } = await this.memberRepo.findAllByOrg(params.organizationId, { role: 'OWNER' });
        if (items.length <= 1) {
          return Result.fail('Cannot remove the sole OWNER of an organization. Transfer ownership first.');
        }
      }

      const removed = await this.memberRepo.delete(params.memberId);
      if (removed) {
        const event = new OrganizationMemberRemovedEvent(params.organizationId, params.memberId, member.userId, params.correlationId);
        await rabbitmq.publish('organization.member_removed', event.toIntegrationEvent());
      }

      return Result.ok(removed);
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to remove member');
    }
  }
}
