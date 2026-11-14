import { ValidationError } from '../../shared/domain/errors.js';

export interface CreateUserRoleProps {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  roleName?: string;
  assignedBy?: string | null;
  createdAt?: Date;
}

export class UserRoleAssignment {
  private _id: string;
  private _tenantId: string;
  private _userId: string;
  private _roleId: string;
  private _roleName?: string;
  private _assignedBy: string | null;
  private _createdAt: Date;

  constructor(props: CreateUserRoleProps) {
    if (!props.id || props.id.trim() === '') {
      throw new ValidationError('Assignment ID cannot be empty');
    }
    if (!props.tenantId || props.tenantId.trim() === '') {
      throw new ValidationError('Tenant ID cannot be empty');
    }
    if (!props.userId || props.userId.trim() === '') {
      throw new ValidationError('User ID cannot be empty');
    }
    if (!props.roleId || props.roleId.trim() === '') {
      throw new ValidationError('Role ID cannot be empty');
    }

    this._id = props.id.trim();
    this._tenantId = props.tenantId.trim();
    this._userId = props.userId.trim();
    this._roleId = props.roleId.trim();
    this._roleName = props.roleName;
    this._assignedBy = props.assignedBy?.trim() || null;
    this._createdAt = props.createdAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get userId(): string { return this._userId; }
  get roleId(): string { return this._roleId; }
  get roleName(): string | undefined { return this._roleName; }
  get assignedBy(): string | null { return this._assignedBy; }
  get createdAt(): Date { return this._createdAt; }

  setRoleName(name: string): void {
    this._roleName = name;
  }

  toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      userId: this._userId,
      roleId: this._roleId,
      roleName: this._roleName,
      assignedBy: this._assignedBy,
      createdAt: this._createdAt.toISOString()
    };
  }
}

