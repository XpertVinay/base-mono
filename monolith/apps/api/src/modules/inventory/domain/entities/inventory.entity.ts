import { Entity } from '../../../../shared/domain/entity.js';

export interface InventoryProps {
  tenantId: string;
  sku: string;
  name?: string;
  category?: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  version: number;
  updatedAt: Date;
}

export class InsufficientStockError extends Error {
  constructor(productId: string, available: number, requested: number) {
    super(`Insufficient inventory for product '${productId}'. Available: ${available}, requested: ${requested}`);
    this.name = 'InsufficientStockError';
  }
}

export class ConcurrencyError extends Error {
  constructor(productId: string, currentVersion: number, expectedVersion: number) {
    super(`Optimistic concurrency conflict for product '${productId}'. Current version: ${currentVersion}, expected: ${expectedVersion}`);
    this.name = 'ConcurrencyError';
  }
}

export class InventoryItem extends Entity<InventoryProps> {
  private constructor(productId: string, props: InventoryProps) {
    super(productId, props);
  }

  get productId(): string { return this._id; }
  get tenantId(): string { return this.props.tenantId; }
  get sku(): string { return this.props.sku; }
  get name(): string | undefined { return this.props.name; }
  get category(): string | undefined { return this.props.category; }
  get availableQuantity(): number { return this.props.availableQuantity; }
  get reservedQuantity(): number { return this.props.reservedQuantity; }
  get totalQuantity(): number { return this.props.totalQuantity; }
  get version(): number { return this.props.version; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public reserve(quantity: number, expectedVersion?: number): void {
    if (quantity <= 0) {
      throw new Error('Reserve quantity must be positive');
    }

    if (expectedVersion !== undefined && this.props.version !== expectedVersion) {
      throw new ConcurrencyError(this.productId, this.props.version, expectedVersion);
    }

    if (this.props.availableQuantity < quantity) {
      throw new InsufficientStockError(this.productId, this.props.availableQuantity, quantity);
    }

    this.props.availableQuantity -= quantity;
    this.props.reservedQuantity += quantity;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public release(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Release quantity must be positive');
    }

    const toRelease = Math.min(this.props.reservedQuantity, quantity);
    this.props.reservedQuantity -= toRelease;
    this.props.availableQuantity += toRelease;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public commit(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Commit quantity must be positive');
    }

    if (quantity > this.props.reservedQuantity) {
      throw new Error(`Cannot commit ${quantity} units: exceeds reserved quantity of ${this.props.reservedQuantity}`);
    }

    this.props.reservedQuantity -= quantity;
    this.props.totalQuantity -= quantity;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public adjustStock(newTotalQuantity: number): void {
    if (newTotalQuantity < 0) {
      throw new Error('Total quantity cannot be negative');
    }

    if (newTotalQuantity < this.props.reservedQuantity) {
      throw new Error(
        `New total quantity (${newTotalQuantity}) cannot be less than active reserved quantity (${this.props.reservedQuantity})`
      );
    }

    this.props.totalQuantity = newTotalQuantity;
    this.props.availableQuantity = newTotalQuantity - this.props.reservedQuantity;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public static create(params: {
    productId: string;
    tenantId: string;
    sku: string;
    name?: string;
    category?: string;
    initialStock: number;
  }): InventoryItem {
    if (params.initialStock < 0) {
      throw new Error('Initial stock cannot be negative');
    }

    return new InventoryItem(params.productId, {
      tenantId: params.tenantId,
      sku: params.sku,
      name: params.name || 'General Supply Item',
      category: params.category || 'MAINTENANCE_PARTS',
      availableQuantity: params.initialStock,
      reservedQuantity: 0,
      totalQuantity: params.initialStock,
      version: 1,
      updatedAt: new Date()
    });
  }

  public static reconstitute(productId: string, props: InventoryProps): InventoryItem {
    return new InventoryItem(productId, props);
  }
}
