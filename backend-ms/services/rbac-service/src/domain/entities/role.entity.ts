import { ValidationError } from '../../shared/domain/errors.js';

export interface CreateRoleProps {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  permissions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class Role {
  private _id: string;
  private _tenantId: string;
  private _name: string;
  private _description: string | null;
  private _isSystem: boolean;
  private _permissions: Set<string>;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CreateRoleProps) {
    if (!props.id || props.id.trim() === '') {
      throw new ValidationError('Role ID cannot be empty');
    }
    if (!props.tenantId || props.tenantId.trim() === '') {
      throw new ValidationError('Tenant ID cannot be empty');
    }
    if (!props.name || props.name.trim() === '') {
      throw new ValidationError('Role name cannot be empty');
    }

    this._id = props.id.trim();
    this._tenantId = props.tenantId.trim();
    this._name = props.name.trim().toUpperCase();
    this._description = props.description?.trim() || null;
    this._isSystem = Boolean(props.isSystem);
    this._permissions = new Set<string>();

    if (props.permissions && Array.isArray(props.permissions)) {
      props.permissions.forEach(p => {
        if (p && typeof p === 'string' && p.trim()) {
          this._permissions.add(p.trim().toLowerCase());
        }
      });
    }

    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get tenantId(): string { return this._tenantId; }
  get name(): string { return this._name; }
  get description(): string | null { return this._description; }
  get isSystem(): boolean { return this._isSystem; }
  get permissions(): string[] { return Array.from(this._permissions).sort(); }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  hasPermission(permission: string): boolean {
    if (!permission) return false;
    const perm = permission.trim().toLowerCase();
    // Wildcard matching e.g. 'iam:*' matches 'iam:members:read'
    if (this._permissions.has('*') || this._permissions.has(perm)) {
      return true;
    }
    const [domain] = perm.split(':');
    if (domain && this._permissions.has(`${domain}:*`)) {
      return true;
    }
    return false;
  }

  addPermission(permission: string): void {
    if (!permission || permission.trim() === '') {
      throw new ValidationError('Permission name cannot be empty');
    }
    this._permissions.add(permission.trim().toLowerCase());
    this._updatedAt = new Date();
  }

  removePermission(permission: string): void {
    if (!permission) return;
    this._permissions.delete(permission.trim().toLowerCase());
    this._updatedAt = new Date();
  }

  setPermissions(permissions: string[]): void {
    this._permissions.clear();
    if (Array.isArray(permissions)) {
      permissions.forEach(p => {
        if (p && typeof p === 'string' && p.trim()) {
          this._permissions.add(p.trim().toLowerCase());
        }
      });
    }
    this._updatedAt = new Date();
  }

  updateDetails(props: { name?: string; description?: string | null }): void {
    if (this._isSystem && props.name && props.name.trim().toUpperCase() !== this._name) {
      throw new ValidationError('System roles cannot be renamed');
    }
    if (props.name !== undefined) {
      if (!props.name || props.name.trim() === '') {
        throw new ValidationError('Role name cannot be empty');
      }
      this._name = props.name.trim().toUpperCase();
    }
    if (props.description !== undefined) {
      this._description = props.description?.trim() || null;
    }
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this._id,
      tenantId: this._tenantId,
      name: this._name,
      description: this._description,
      isSystem: this._isSystem,
      permissions: this.permissions,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }
}

