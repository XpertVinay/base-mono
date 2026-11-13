import { DomainEvent } from '../../shared/domain/domain-event.js';
import { DomainIntegrationEvent, OrganizationDto, OrganizationMemberDto } from '../../shared/contracts/index.js';

export class OrganizationCreatedEvent implements DomainEvent {
  public readonly dateTimeOccurred: Date = new Date();

  constructor(
    public readonly organization: OrganizationDto,
    public readonly correlationId?: string
  ) {}

  getAggregateId(): string {
    return this.organization.id;
  }

  toIntegrationEvent(): DomainIntegrationEvent<OrganizationDto> {
    return {
      id: `evt-${crypto.randomUUID()}`,
      eventName: 'organization.created',
      aggregateId: this.organization.id,
      occurredAt: this.dateTimeOccurred.toISOString(),
      payload: this.organization,
      version: 1,
      tenantId: this.organization.id
    };
  }
}

export class OrganizationUpdatedEvent implements DomainEvent {
  public readonly dateTimeOccurred: Date = new Date();

  constructor(
    public readonly organization: OrganizationDto,
    public readonly changes: Record<string, any>,
    public readonly correlationId?: string
  ) {}

  getAggregateId(): string {
    return this.organization.id;
  }

  toIntegrationEvent(): DomainIntegrationEvent<{ organization: OrganizationDto; changes: Record<string, any> }> {
    return {
      id: `evt-${crypto.randomUUID()}`,
      eventName: 'organization.updated',
      aggregateId: this.organization.id,
      occurredAt: this.dateTimeOccurred.toISOString(),
      payload: {
        organization: this.organization,
        changes: this.changes
      },
      version: 1,
      tenantId: this.organization.id
    };
  }
}

export class OrganizationStatusChangedEvent implements DomainEvent {
  public readonly dateTimeOccurred: Date = new Date();

  constructor(
    public readonly organizationId: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly correlationId?: string
  ) {}

  getAggregateId(): string {
    return this.organizationId;
  }

  toIntegrationEvent(): DomainIntegrationEvent<{ organizationId: string; oldStatus: string; newStatus: string }> {
    return {
      id: `evt-${crypto.randomUUID()}`,
      eventName: 'organization.status_changed',
      aggregateId: this.organizationId,
      occurredAt: this.dateTimeOccurred.toISOString(),
      payload: {
        organizationId: this.organizationId,
        oldStatus: this.oldStatus,
        newStatus: this.newStatus
      },
      version: 1,
      tenantId: this.organizationId
    };
  }
}

export class OrganizationDeletedEvent implements DomainEvent {
  public readonly dateTimeOccurred: Date = new Date();

  constructor(
    public readonly organizationId: string,
    public readonly slug: string,
    public readonly correlationId?: string
  ) {}

  getAggregateId(): string {
    return this.organizationId;
  }

  toIntegrationEvent(): DomainIntegrationEvent<{ organizationId: string; slug: string }> {
    return {
      id: `evt-${crypto.randomUUID()}`,
      eventName: 'organization.deleted',
      aggregateId: this.organizationId,
      occurredAt: this.dateTimeOccurred.toISOString(),
      payload: {
        organizationId: this.organizationId,
        slug: this.slug
      },
      version: 1,
      tenantId: this.organizationId
    };
  }
}

export class OrganizationMemberAddedEvent implements DomainEvent {
  public readonly dateTimeOccurred: Date = new Date();

  constructor(
    public readonly member: OrganizationMemberDto,
    public readonly correlationId?: string
  ) {}

  getAggregateId(): string {
    return this.member.organizationId;
  }

  toIntegrationEvent(): DomainIntegrationEvent<OrganizationMemberDto> {
    return {
      id: `evt-${crypto.randomUUID()}`,
      eventName: 'organization.member_added',
      aggregateId: this.member.organizationId,
      occurredAt: this.dateTimeOccurred.toISOString(),
      payload: this.member,
      version: 1,
      tenantId: this.member.organizationId
    };
  }
}

export class OrganizationMemberRemovedEvent implements DomainEvent {
  public readonly dateTimeOccurred: Date = new Date();

  constructor(
    public readonly organizationId: string,
    public readonly memberId: string,
    public readonly userId: string,
    public readonly correlationId?: string
  ) {}

  getAggregateId(): string {
    return this.organizationId;
  }

  toIntegrationEvent(): DomainIntegrationEvent<{ organizationId: string; memberId: string; userId: string }> {
    return {
      id: `evt-${crypto.randomUUID()}`,
      eventName: 'organization.member_removed',
      aggregateId: this.organizationId,
      occurredAt: this.dateTimeOccurred.toISOString(),
      payload: {
        organizationId: this.organizationId,
        memberId: this.memberId,
        userId: this.userId
      },
      version: 1,
      tenantId: this.organizationId
    };
  }
}
