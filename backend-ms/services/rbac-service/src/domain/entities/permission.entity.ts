export interface CreatePermissionProps {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  isSystem?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Permission {
  private _id: string;
  private _name: string;
  private _category: string;
  private _description: string | null;
  private _isSystem: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CreatePermissionProps) {
    if (!props.id || props.id.trim() === '') {
      throw new Error('Permission ID cannot be empty');
    }
    if (!props.name || props.name.trim() === '') {
      throw new Error('Permission name cannot be empty');
    }
    if (!props.category || props.category.trim() === '') {
      throw new Error('Permission category cannot be empty');
    }

    this._id = props.id.trim();
    this._name = props.name.trim().toLowerCase();
    this._category = props.category.trim().toLowerCase();
    this._description = props.description?.trim() || null;
    this._isSystem = Boolean(props.isSystem);
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get category(): string { return this._category; }
  get description(): string | null { return this._description; }
  get isSystem(): boolean { return this._isSystem; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  updateDescription(description?: string | null): void {
    this._description = description?.trim() || null;
    this._updatedAt = new Date();
  }

  updateCategory(category: string): void {
    if (!category || category.trim() === '') {
      throw new Error('Category cannot be empty');
    }
    this._category = category.trim().toLowerCase();
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this._id,
      name: this._name,
      category: this._category,
      description: this._description,
      isSystem: this._isSystem,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }
}

