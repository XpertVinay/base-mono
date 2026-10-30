import { MembershipRole, MembershipStatus } from '@monolith/contracts';

export interface CreateOrganizationMembershipProps {
  id: string;
  organizationId: string;
  userId: string;
  role?: MembershipRole | string;
  tenantRoleId?: string | null;
  status?: MembershipStatus;
  joinedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class OrganizationMembership {
  private _id: string;
  private _organizationId: string;
  private _userId: string;
  private _role: MembershipRole | string;
  private _tenantRoleId: string | null;
  private _status: MembershipStatus;
  private _joinedAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CreateOrganizationMembershipProps) {
    if (!props.id || props.id.trim() === '') {
      throw new Error('Membership ID cannot be empty');
    }
    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new Error('Organization ID cannot be empty');
    }
    if (!props.userId || props.userId.trim() === '') {
      throw new Error('User ID cannot be empty');
    }

    this._id = props.id.trim();
    this._organizationId = props.organizationId.trim();
    this._userId = props.userId.trim();
    this._role = props.role || 'MEMBER';
    this._tenantRoleId = props.tenantRoleId ?? null;
    this._status = props.status || 'ACTIVE';
    this._joinedAt = props.joinedAt !== undefined ? props.joinedAt : (this._status === 'ACTIVE' ? new Date() : null);
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get organizationId(): string { return this._organizationId; }
  get userId(): string { return this._userId; }
  get role(): MembershipRole | string { return this._role; }
  get tenantRoleId(): string | null { return this._tenantRoleId; }
  get status(): MembershipStatus { return this._status; }
  get joinedAt(): Date | null { return this._joinedAt; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  assignTenantRole(tenantRoleId: string | null, roleName?: string): void {
    this._tenantRoleId = tenantRoleId;
    if (roleName) {
      this._role = roleName;
    }
    this._updatedAt = new Date();
  }

  activate(): void {
    this._status = 'ACTIVE';
    if (!this._joinedAt) {
      this._joinedAt = new Date();
    }
    this._updatedAt = new Date();
  }

  suspend(): void {
    this._status = 'SUSPENDED';
    this._updatedAt = new Date();
  }

  reject(): void {
    this._status = 'REJECTED';
    this._updatedAt = new Date();
  }

  updateRole(role: MembershipRole | string): void {
    this._role = role;
    this._updatedAt = new Date();
  }

  isActive(): boolean {
    return this._status === 'ACTIVE';
  }

  isAdmin(): boolean {
    return this._role === 'ADMIN';
  }
}

