import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { OrderStatus } from '@monolith/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface OrderItemProps {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderProps {
  userId: string;
  status: OrderStatus;
  items: OrderItemProps[];
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Order extends AggregateRoot<OrderProps> {
  private constructor(id: string, props: OrderProps) {
    super(id, props);
  }

  get userId(): string { return this.props.userId; }
  get status(): OrderStatus { return this.props.status; }
  get items(): OrderItemProps[] { return [...this.props.items]; }
  get totalAmount(): number { return this.props.totalAmount; }
  get currency(): string { return this.props.currency; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public confirm(): void {
    if (this.props.status !== 'PENDING') {
      throw new Error(`Cannot confirm order in '${this.props.status}' status`);
    }
    this.props.status = 'CONFIRMED';
    this.props.updatedAt = new Date();
  }

  public markPaid(): void {
    if (this.props.status === 'CANCELLED') {
      throw new Error('Cannot mark cancelled order as paid');
    }
    this.props.status = 'PAID';
    this.props.updatedAt = new Date();
  }

  public cancel(reason?: string): void {
    if (this.props.status === 'SHIPPED') {
      throw new Error('Cannot cancel an order that has already shipped');
    }
    this.props.status = 'CANCELLED';
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      id: uuidv4(),
      eventName: 'orders.order_cancelled',
      aggregateId: this.id,
      occurredAt: new Date(),
      version: 1,
      payload: { orderId: this.id, reason }
    });
  }

  public static create(
    userId: string,
    rawItems: { productId: string; productName: string; quantity: number; unitPrice: number }[],
    currency = 'USD',
    id?: string
  ): Order {
    if (!rawItems || rawItems.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    const orderId = id || uuidv4();
    const items: OrderItemProps[] = rawItems.map(item => {
      if (item.quantity <= 0) throw new Error('Item quantity must be positive');
      if (item.unitPrice < 0) throw new Error('Unit price cannot be negative');
      return {
        id: uuidv4(),
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: Number((item.quantity * item.unitPrice).toFixed(2))
      };
    });

    const totalAmount = Number(items.reduce((sum, i) => sum + i.totalPrice, 0).toFixed(2));
    const now = new Date();

    const order = new Order(orderId, {
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
        userId,
        totalAmount,
        currency,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice }))
      }
    });

    return order;
  }

  public static reconstitute(id: string, props: OrderProps): Order {
    return new Order(id, props);
  }
}
