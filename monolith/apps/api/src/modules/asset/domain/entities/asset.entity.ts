import { Entity } from '../../../../shared/domain/entity.js';
import { v4 as uuidv4 } from 'uuid';
import { AssetCategory, AssetStatus } from '@monolith/contracts';

export interface AssetProps {
  tenantId: string;
  ownerId: string;
  name: string;
  category: AssetCategory;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  status: AssetStatus;
  checksum?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAssetEntityProps {
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  ownerId: string;
  tenantId?: string;
  category?: AssetCategory;
  status?: AssetStatus;
  checksum?: string;
}

export class Asset extends Entity<AssetProps> {
  private constructor(id: string, props: AssetProps) {
    super(id, props);
  }

  get tenantId(): string { return this.props.tenantId; }
  get ownerId(): string { return this.props.ownerId; }
  get name(): string { return this.props.name; }
  get category(): AssetCategory { return this.props.category; }
  get mimeType(): string { return this.props.mimeType; }
  get sizeBytes(): number { return this.props.sizeBytes; }
  get storagePath(): string { return this.props.storagePath; }
  get status(): AssetStatus { return this.props.status; }
  get checksum(): string | undefined { return this.props.checksum; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public markActive(checksum?: string): void {
    this.props.status = 'ACTIVE';
    if (checksum) {
      this.props.checksum = checksum;
    }
    this.props.updatedAt = new Date();
  }

  public markQuarantined(): void {
    this.props.status = 'QUARANTINED';
    this.props.updatedAt = new Date();
  }

  public markArchived(): void {
    this.props.status = 'ARCHIVED';
    this.props.updatedAt = new Date();
  }

  public static create(props: CreateAssetEntityProps, id?: string): Asset {
    const now = new Date();
    return new Asset(id || uuidv4(), {
      tenantId: props.tenantId || 'default-tenant',
      ownerId: props.ownerId,
      name: props.name,
      category: props.category || 'GENERAL',
      mimeType: props.mimeType,
      sizeBytes: props.sizeBytes,
      storagePath: props.storagePath,
      status: props.status || 'PENDING_UPLOAD',
      checksum: props.checksum,
      createdAt: now,
      updatedAt: now
    });
  }

  public static reconstitute(id: string, props: AssetProps): Asset {
    return new Asset(id, props);
  }
}
