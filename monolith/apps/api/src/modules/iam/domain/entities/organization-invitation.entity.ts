import { MembershipRole, InvitationStatus } from '@monolith/contracts';

export interface CreateOrganizationInvitationProps {
  id: string;
  organizationId: string;
  invitedEmail: string;
  invitedByUserId: string;
  role?: MembershipRole | string;
  token: string;
  status?: InvitationStatus;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class OrganizationInvitation {
  private _id: string;
  private _organizationId: string;
  private _invitedEmail: string;
  private _invitedByUserId: string;
  private _role: MembershipRole | string;
  private _token: string;
  private _status: InvitationStatus;
  private _expiresAt: Date;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CreateOrganizationInvitationProps) {
    if (!props.id || props.id.trim() === '') {
      throw new Error('Invitation ID cannot be empty');
    }
    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new Error('Organization ID cannot be empty');
    }
    if (!props.invitedEmail || props.invitedEmail.trim() === '') {
      throw new Error('Invited email cannot be empty');
    }
    if (!props.invitedByUserId || props.invitedByUserId.trim() === '') {
      throw new Error('InvitedBy user ID cannot be empty');
    }
    if (!props.token || props.token.trim() === '') {
      throw new Error('Invitation token cannot be empty');
    }

    this._id = props.id.trim();
    this._organizationId = props.organizationId.trim();
    this._invitedEmail = props.invitedEmail.toLowerCase().trim();
    this._invitedByUserId = props.invitedByUserId.trim();
    this._role = props.role || 'MEMBER';
    this._token = props.token.trim();
    this._status = props.status || 'PENDING';
    this._expiresAt = props.expiresAt;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get organizationId(): string { return this._organizationId; }
  get invitedEmail(): string { return this._invitedEmail; }
  get invitedByUserId(): string { return this._invitedByUserId; }
  get role(): MembershipRole | string { return this._role; }
  get token(): string { return this._token; }
  get status(): InvitationStatus { return this._status; }
  get expiresAt(): Date { return this._expiresAt; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  accept(): void {
    if (this._status !== 'PENDING') {
      throw new Error(`Cannot accept invitation with status: ${this._status}`);
    }
    if (this.isExpired()) {
      this._status = 'EXPIRED';
      this._updatedAt = new Date();
      throw new Error('Invitation has expired');
    }
    this._status = 'ACCEPTED';
    this._updatedAt = new Date();
  }

  reject(): void {
    if (this._status !== 'PENDING') {
      throw new Error(`Cannot reject invitation with status: ${this._status}`);
    }
    this._status = 'REJECTED';
    this._updatedAt = new Date();
  }
}

