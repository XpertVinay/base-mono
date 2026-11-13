import { Entity } from '../../shared/domain/entity.js';

export interface AssetProps {
  tenantId?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Asset extends Entity<AssetProps> {
  private constructor(props: AssetProps, id?: string) {
    super(props, id);
  }

  public static create(props: AssetProps, id?: string): Asset {
    return new Asset(
      {
        ...props,
        tenantId: props.tenantId || 'default',
        createdAt: props.createdAt || new Date(),
        updatedAt: props.updatedAt || new Date()
      },
      id
    );
  }

  get tenantId(): string { return this.props.tenantId || 'default'; }
  get name(): string { return this.props.name; }
  get mimeType(): string { return this.props.mimeType; }
  get sizeBytes(): number { return this.props.sizeBytes; }
  get storagePath(): string { return this.props.storagePath; }
  get ownerId(): string { return this.props.ownerId; }
  get createdAt(): Date { return this.props.createdAt!; }
  get updatedAt(): Date { return this.props.updatedAt!; }

  public update(props: Partial<Pick<AssetProps, 'name' | 'mimeType' | 'sizeBytes' | 'storagePath'>>): void {
    if (props.name !== undefined) this.props.name = props.name;
    if (props.mimeType !== undefined) this.props.mimeType = props.mimeType;
    if (props.sizeBytes !== undefined) this.props.sizeBytes = props.sizeBytes;
    if (props.storagePath !== undefined) this.props.storagePath = props.storagePath;
    this.props.updatedAt = new Date();
  }
}
