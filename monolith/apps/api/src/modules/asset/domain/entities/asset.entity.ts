import { Entity } from '../../../../shared/domain/entity.js';
import { v4 as uuidv4 } from 'uuid';

export interface AssetProps {
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Asset extends Entity<AssetProps> {
  private constructor(id: string, props: AssetProps) {
    super(id, props);
  }

  get name(): string { return this.props.name; }
  get mimeType(): string { return this.props.mimeType; }
  get sizeBytes(): number { return this.props.sizeBytes; }
  get storagePath(): string { return this.props.storagePath; }
  get ownerId(): string { return this.props.ownerId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public static create(name: string, mimeType: string, sizeBytes: number, storagePath: string, ownerId: string, id?: string): Asset {
    const now = new Date();
    return new Asset(id || uuidv4(), {
      name,
      mimeType,
      sizeBytes,
      storagePath,
      ownerId,
      createdAt: now,
      updatedAt: now
    });
  }

  public static reconstitute(id: string, props: AssetProps): Asset {
    return new Asset(id, props);
  }
}
