import { Entity } from '../../../../shared/domain/entity.js';

export interface InventoryProps {
  sku: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  updatedAt: Date;
}

export class InventoryItem extends Entity<InventoryProps> {
  private constructor(productId: string, props: InventoryProps) {
    super(productId, props);
  }

  get productId(): string { return this._id; }
  get sku(): string { return this.props.sku; }
  get availableQuantity(): number { return this.props.availableQuantity; }
  get reservedQuantity(): number { return this.props.reservedQuantity; }
  get totalQuantity(): number { return this.props.totalQuantity; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public reserve(quantity: number): void {
    if (quantity <= 0) throw new Error('Reserve quantity must be positive');
    if (this.props.availableQuantity < quantity) {
      throw new Error(`Insufficient inventory for product '${this.productId}'. Available: ${this.props.availableQuantity}, requested: ${quantity}`);
    }

    this.props.availableQuantity -= quantity;
    this.props.reservedQuantity += quantity;
    this.props.updatedAt = new Date();
  }

  public release(quantity: number): void {
    if (quantity <= 0) throw new Error('Release quantity must be positive');
    const toRelease = Math.min(this.props.reservedQuantity, quantity);

    this.props.reservedQuantity -= toRelease;
    this.props.availableQuantity += toRelease;
    this.props.updatedAt = new Date();
  }

  public static create(productId: string, sku: string, initialStock: number): InventoryItem {
    return new InventoryItem(productId, {
      sku,
      availableQuantity: initialStock,
      reservedQuantity: 0,
      totalQuantity: initialStock,
      updatedAt: new Date()
    });
  }

  public static reconstitute(productId: string, props: InventoryProps): InventoryItem {
    return new InventoryItem(productId, props);
  }
}
