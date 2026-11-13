import { Entity } from '../../shared/domain/entity.js';
import {
  MemberRole,
  MemberStatus,
  OrganizationMemberDto
} from '../../shared/contracts/index.js';

export interface OrganizationMemberProps {
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class OrganizationMember extends Entity<OrganizationMemberProps> {
  private constructor(props: OrganizationMemberProps, id?: string) {
    super(props, id);
  }

  public static create(
    params: {
      organizationId: string;
      userId: string;
      email: string;
      name: string;
      role?: MemberRole;
      status?: MemberStatus;
    },
    id?: string
  ): OrganizationMember {
    const email = params.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Valid member email is required');
    }

    return new OrganizationMember(
      {
        organizationId: params.organizationId,
        userId: params.userId,
        email,
        name: params.name.trim(),
        role: params.role || 'MEMBER',
        status: params.status || 'ACTIVE',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      id
    );
  }

  public static reconstitute(props: OrganizationMemberProps, id: string): OrganizationMember {
    return new OrganizationMember(props, id);
  }

  get organizationId(): string { return this.props.organizationId; }
  get userId(): string { return this.props.userId; }
  get email(): string { return this.props.email; }
  get name(): string { return this.props.name; }
  get role(): MemberRole { return this.props.role; }
  get status(): MemberStatus { return this.props.status; }
  get joinedAt(): Date { return this.props.joinedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public updateRole(newRole: MemberRole): void {
    if (this.props.role === newRole) return;
    this.props.role = newRole;
    this.props.updatedAt = new Date();
  }

  public updateStatus(newStatus: MemberStatus): void {
    if (this.props.status === newStatus) return;
    this.props.status = newStatus;
    this.props.updatedAt = new Date();
  }

  public toDto(): OrganizationMemberDto {
    return {
      id: this.id,
      organizationId: this.organizationId,
      userId: this.userId,
      email: this.email,
      name: this.name,
      role: this.role,
      status: this.status,
      joinedAt: this.joinedAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
