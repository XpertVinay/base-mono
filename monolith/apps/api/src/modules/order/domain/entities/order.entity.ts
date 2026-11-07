import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { OrderStatus } from '@monolith/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface OrderItemProps {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderProps {
  tenantId: string;
  userId: string;
  status: OrderStatus;
  items: OrderItemProps[];
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export class InvalidStateTransitionError extends Error {
  constructor(currentStatus: OrderStatus, attemptedAction: string) {
    super(`Cannot ${attemptedAction} order in '${currentStatus}' status`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class Order extends AggregateRoot<OrderProps> {
  private constructor(id: string, props: OrderProps) {
    super(id, props);
  }

  get tenantId(): string { return this.props.tenantId; }
  get userId(): string { return this.props.userId; }
  get status(): OrderStatus { return this.props.status; }
  get items(): OrderItemProps[] { return [...this.props.items]; }
  get totalAmount(): number { return this.props.totalAmount; }
  get currency(): string { return this.props.currency; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public confirm(): void {
    if (this.props.status !== 'PENDING') {
      throw new InvalidStateTransitionError(this.props.status, 'confirm');
    }
    this.props.status = 'CONFIRMED';
    this.props.updatedAt = new Date();
  }

  public markReserved(): void {
    if (this.props.status !== 'PENDING' && this.props.status !== 'CONFIRMED') {
      throw new InvalidStateTransitionError(this.props.status, 'mark reserved');
    }
    this.props.status = 'RESERVED';
    this.props.updatedAt = new Date();
  }

  public markPaid(): void {
    if (this.props.status === 'CANCELLED') {
      throw new InvalidStateTransitionError(this.props.status, 'mark paid');
    }
    if (this.props.status === 'FULFILLED' || this.props.status === 'SHIPPED') {
      throw new InvalidStateTransitionError(this.props.status, 'mark paid on already fulfilled order');
    }
    this.props.status = 'PAID';
    this.props.updatedAt = new Date();
  }

  public fulfill(): void {
    if (
      this.props.status !== 'PAID' &&
      this.props.status !== 'RESERVED' &&
      this.props.status !== 'CONFIRMED'
    ) {
      throw new InvalidStateTransitionError(this.props.status, 'fulfill');
    }
    this.props.status = 'FULFILLED';
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      id: uuidv4(),
      eventName: 'orders.order_fulfilled',
      aggregateId: this.id,
      occurredAt: new Date(),
      version: 1,
      payload: {
        orderId: this.id,
        tenantId: this.props.tenantId,
        userId: this.props.userId
      }
    });
  }

  public cancel(reason?: string): void {
    if (this.props.status === 'SHIPPED' || this.props.status === 'FULFILLED') {
      throw new InvalidStateTransitionError(this.props.status, 'cancel');
    }
    if (this.props.status === 'CANCELLED') {
      return; // Idempotent cancellation
    }

    this.props.status = 'CANCELLED';
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      id: uuidv4(),
      eventName: 'orders.order_cancelled',
      aggregateId: this.id,
      occurredAt: new Date(),
      version: 1,
      payload: {
        orderId: this.id,
        tenantId: this.props.tenantId,
        userId: this.props.userId,
        reason
      }
    });
  }

  public static create(
    userId: string,
    rawItems: { productId: string; productName: string; quantity: number; unitPrice: number }[],
    currency = 'USD',
    id?: string,
    tenantId = 'default-tenant'
  ): Order {
    if (!rawItems || rawItems.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    const orderId = id || uuidv4();
    const items: OrderItemProps[] = rawItems.map(item => {
      if (!item.productId || item.productId.trim().length === 0) {
        throw new Error('Item productId is required');
      }
      if (item.quantity <= 0) {
        throw new Error('Item quantity must be positive');
      }
      if (item.unitPrice < 0) {
        throw new Error('Unit price cannot be negative');
      }
      const totalPrice = Number((item.quantity * item.unitPrice).toFixed(2));
      return {
        id: uuidv4(),
        tenantId,
        productId: item.productId,
        productName: item.productName || 'Supply Item',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice
      };
    });

    const totalAmount = Number(items.reduce((sum, i) => sum + i.totalPrice, 0).toFixed(2));
    const now = new Date();

    const order = new Order(orderId, {
      tenantId,
      userId,
      status: 'PENDING',
      items,
      totalAmount,
      currency,
      createdAt: now,
      updatedAt: now
    });

    // Domain Integration Event
    order.addDomainEvent({
      id: uuidv4(),
      eventName: 'orders.order_created',
      aggregateId: orderId,
      occurredAt: now,
      version: 1,
      payload: {
        orderId,
        tenantId,
        userId,
        totalAmount,
        currency,
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        }))
      }
    });

    return order;
  }

  public static reconstitute(id: string, props: OrderProps): Order {
    return new Order(id, props);
  }
}
