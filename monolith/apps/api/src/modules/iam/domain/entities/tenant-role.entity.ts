import { PlatformPermission, ALL_PLATFORM_PERMISSIONS } from '@monolith/contracts';

export interface CreateTenantRoleProps {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  permissions?: PlatformPermission[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class TenantRole {
  private _id: string;
  private _tenantId: string;
  private _name: string;
  private _description: string | null;
  private _isSystem: boolean;
  private _permissions: Set<PlatformPermission>;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CreateTenantRoleProps) {
    if (!props.id || props.id.trim() === '') {
      throw new Error('Tenant role ID cannot be empty');
    }
    if (!props.tenantId || props.tenantId.trim() === '') {
      throw new Error('Tenant ID cannot be empty');
    }
    if (!props.name || props.name.trim() === '') {
      throw new Error('Tenant role name cannot be empty');
    }

    this._id = props.id.trim();
    this._tenantId = props.tenantId.trim();
    this._name = props.name.trim().toUpperCase();
    this._description = props.description?.trim() || null;
    this._isSystem = Boolean(props.isSystem);
    this._permissions = new Set<PlatformPermission>();

    if (props.permissions && Array.isArray(props.permissions)) {
      props.permissions.forEach(perm => {
        if (ALL_PLATFORM_PERMISSIONS.includes(perm)) {
          this._permissions.add(perm);
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
  get permissions(): PlatformPermission[] { return Array.from(this._permissions); }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  hasPermission(permission: PlatformPermission): boolean {
    return this._permissions.has(permission);
  }

  addPermission(permission: PlatformPermission): void {
    if (!ALL_PLATFORM_PERMISSIONS.includes(permission)) {
      throw new Error(`Invalid platform permission: ${permission}`);
    }
    this._permissions.add(permission);
    this._updatedAt = new Date();
  }

  removePermission(permission: PlatformPermission): void {
    this._permissions.delete(permission);
    this._updatedAt = new Date();
  }

  setPermissions(permissions: PlatformPermission[]): void {
    this._permissions.clear();
    permissions.forEach(perm => {
      if (ALL_PLATFORM_PERMISSIONS.includes(perm)) {
        this._permissions.add(perm);
      } else {
        throw new Error(`Invalid platform permission: ${perm}`);
      }
    });
    this._updatedAt = new Date();
  }

  updateName(name: string): void {
    if (!name || name.trim() === '') {
      throw new Error('Role name cannot be empty');
    }
    this._name = name.trim().toUpperCase();
    this._updatedAt = new Date();
  }

  updateDescription(description?: string): void {
    this._description = description?.trim() || null;
    this._updatedAt = new Date();
  }
}
