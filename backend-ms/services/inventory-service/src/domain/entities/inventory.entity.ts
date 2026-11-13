import { Entity } from '../../shared/domain/entity.js';

export interface InventoryProps {
  tenantId?: string;
  sku: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  updatedAt?: Date;
}

export class InventoryItem extends Entity<InventoryProps> {
  private constructor(props: InventoryProps, id: string) {
    super(props, id);
  }

  public static create(productId: string, props: InventoryProps): InventoryItem {
    return new InventoryItem(
      {
        ...props,
        tenantId: props.tenantId || 'default',
        updatedAt: props.updatedAt || new Date()
      },
      productId
    );
  }

  get productId(): string { return this._id; }
  get tenantId(): string { return this.props.tenantId || 'default'; }
  get sku(): string { return this.props.sku; }
  get availableQuantity(): number { return this.props.availableQuantity; }
  get reservedQuantity(): number { return this.props.reservedQuantity; }
  get totalQuantity(): number { return this.props.totalQuantity; }
  get updatedAt(): Date { return this.props.updatedAt!; }

  public reserve(quantity: number): boolean {
    if (this.props.availableQuantity < quantity) {
      return false;
    }
    this.props.availableQuantity -= quantity;
    this.props.reservedQuantity += quantity;
    this.props.updatedAt = new Date();
    return true;
  }

  public release(quantity: number): void {
    const toRelease = Math.min(this.props.reservedQuantity, quantity);
    this.props.reservedQuantity -= toRelease;
    this.props.availableQuantity += toRelease;
    this.props.updatedAt = new Date();
  }

  public addStock(quantity: number): void {
    this.props.availableQuantity += quantity;
    this.props.totalQuantity += quantity;
    this.props.updatedAt = new Date();
  }

  public updateDetails(props: {
    sku?: string;
    availableQuantity?: number;
    totalQuantity?: number;
    reservedQuantity?: number;
  }): void {
    if (props.sku !== undefined) this.props.sku = props.sku;
    if (props.availableQuantity !== undefined) this.props.availableQuantity = props.availableQuantity;
    if (props.totalQuantity !== undefined) this.props.totalQuantity = props.totalQuantity;
    if (props.reservedQuantity !== undefined) this.props.reservedQuantity = props.reservedQuantity;
    this.props.updatedAt = new Date();
  }
}
