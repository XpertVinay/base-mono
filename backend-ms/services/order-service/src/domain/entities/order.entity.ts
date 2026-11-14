import { AggregateRoot } from '../../shared/domain/aggregate-root.js';
import { DomainEvent } from '../../shared/domain/domain-event.js';
import { ValidationError, ConflictError } from '../../shared/domain/errors.js';

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
  tenantId?: string;
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
    public readonly items: OrderItem[],
    public readonly tenantId: string = 'default'
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
    id?: string,
    tenantId: string = 'default'
  ): Order {
    if (!items || items.length === 0) {
      throw new ValidationError('Order must contain at least one item');
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
        tenantId,
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
      new OrderCreatedDomainEvent(order.id, userId, totalAmount, currency, mappedItems, tenantId)
    );

    return order;
  }

  public static reconstitute(props: OrderProps, id: string): Order {
    return new Order(props, id);
  }

  get tenantId(): string { return this.props.tenantId || 'default'; }
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
      throw new ConflictError('Cannot cancel an already shipped order');
    }
    this.props.status = 'CANCELLED';
    this.props.updatedAt = new Date();
  }

  public updateStatus(status: OrderStatus): void {
    this.props.status = status;
    this.props.updatedAt = new Date();
  }

  public updateDetails(props: {
    items?: OrderItem[];
    totalAmount?: number;
    currency?: string;
  }): void {
    if (props.items !== undefined) this.props.items = props.items;
    if (props.totalAmount !== undefined) this.props.totalAmount = props.totalAmount;
    if (props.currency !== undefined) this.props.currency = props.currency;
    this.props.updatedAt = new Date();
  }
}
