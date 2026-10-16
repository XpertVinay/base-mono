import { Entity } from '../../shared/domain/entity.js';

export interface InventoryProps {
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
        updatedAt: props.updatedAt || new Date()
      },
      productId
    );
  }

  get productId(): string { return this._id; }
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
}
