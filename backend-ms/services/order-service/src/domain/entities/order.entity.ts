import { AggregateRoot } from '../../shared/domain/aggregate-root.js';
import { DomainEvent } from '../../shared/domain/domain-event.js';

export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'CANCELLED';

export interface OrderItem {
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
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export class OrderCreatedDomainEvent implements DomainEvent {
  dateTimeOccurred = new Date();
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly items: OrderItem[]
  ) {}
  getAggregateId(): string { return this.orderId; }
}

export class Order extends AggregateRoot<OrderProps> {
  private constructor(props: OrderProps, id?: string) {
    super(props, id);
  }

  public static create(
    userId: string,
    items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>,
    currency: string = 'USD',
    id?: string
  ): Order {
    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    const orderId = id || crypto.randomUUID();
    const mappedItems: OrderItem[] = items.map(item => ({
      id: crypto.randomUUID(),
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.quantity * item.unitPrice
    }));

    const totalAmount = mappedItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

    const order = new Order(
      {
        userId,
        status: 'PENDING',
        items: mappedItems,
        totalAmount,
        currency,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      orderId
    );

    order.addDomainEvent(
      new OrderCreatedDomainEvent(order.id, userId, totalAmount, currency, mappedItems)
    );

    return order;
  }

  public static reconstitute(props: OrderProps, id: string): Order {
    return new Order(props, id);
  }

  get userId(): string { return this.props.userId; }
  get status(): OrderStatus { return this.props.status; }
  get items(): OrderItem[] { return this.props.items; }
  get totalAmount(): number { return this.props.totalAmount; }
  get currency(): string { return this.props.currency; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public markPaid(): void {
    this.props.status = 'PAID';
    this.props.updatedAt = new Date();
  }

  public cancel(_reason?: string): void {
    if (this.props.status === 'SHIPPED') {
      throw new Error('Cannot cancel an already shipped order');
    }
    this.props.status = 'CANCELLED';
    this.props.updatedAt = new Date();
  }
}
