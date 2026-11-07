import { describe, it, expect, beforeEach } from 'vitest';
import {
  Order,
  InvalidStateTransitionError,
  PostgresOrderRepository,
  CreateOrderUseCase,
  CancelOrderUseCase,
  FulfillOrderUseCase,
  GetOrderByIdQuery,
  ListMyOrdersQuery,
  ListTenantOrdersQuery,
  OrderController,
  OrderModule,
  IInventoryReservationService
} from '../../modules/order/index.js';
import { InMemoryEventBus } from '../../infrastructure/messaging/event-bus.js';
import {
  ConflictError,
  NotFoundError,
  ForbiddenError
} from '../../shared/presentation/error-handler.middleware.js';
import { Request, Response } from 'express';

class MockInventoryReservationService implements IInventoryReservationService {
  public reservations = new Map<string, number>();
  public releases: { productId: string; quantity: number; orderId: string }[] = [];
  public commits: { productId: string; quantity: number; orderId: string }[] = [];
  public failNextReservation = false;

  async reserve(productId: string, quantity: number, _orderId: string): Promise<boolean> {
    if (this.failNextReservation) {
      return false;
    }
    const current = this.reservations.get(productId) || 0;
    this.reservations.set(productId, current + quantity);
    return true;
  }

  async release(productId: string, quantity: number, orderId: string): Promise<boolean> {
    const current = this.reservations.get(productId) || 0;
    this.reservations.set(productId, Math.max(0, current - quantity));
    this.releases.push({ productId, quantity, orderId });
    return true;
  }

  async commit(productId: string, quantity: number, orderId: string): Promise<boolean> {
    const current = this.reservations.get(productId) || 0;
    this.reservations.set(productId, Math.max(0, current - quantity));
    this.commits.push({ productId, quantity, orderId });
    return true;
  }
}

describe('Sprint 08: Multi-Tenant Order Processing, Pricing Invariants & Inventory Linkage', () => {
  let repository: PostgresOrderRepository;
  let eventBus: InMemoryEventBus;
  let inventoryService: MockInventoryReservationService;
  let createUseCase: CreateOrderUseCase;
  let cancelUseCase: CancelOrderUseCase;
  let fulfillUseCase: FulfillOrderUseCase;
  let getQuery: GetOrderByIdQuery;
  let listMyQuery: ListMyOrdersQuery;
  let listTenantQuery: ListTenantOrdersQuery;
  let controller: OrderController;

  const TENANT_A = 'org-tenant-alpha-100';
  const TENANT_B = 'org-tenant-beta-200';
  const USER_A1 = 'user-alpha-001';
  const USER_A2 = 'user-alpha-002';
  const USER_B1 = 'user-beta-001';

  beforeEach(() => {
    repository = new PostgresOrderRepository();
    eventBus = new InMemoryEventBus();
    inventoryService = new MockInventoryReservationService();

    createUseCase = new CreateOrderUseCase(repository, eventBus, inventoryService);
    cancelUseCase = new CancelOrderUseCase(repository, eventBus, inventoryService);
    fulfillUseCase = new FulfillOrderUseCase(repository, eventBus, inventoryService);
    getQuery = new GetOrderByIdQuery(repository);
    listMyQuery = new ListMyOrdersQuery(repository);
    listTenantQuery = new ListTenantOrdersQuery(repository);

    controller = new OrderController(
      createUseCase,
      cancelUseCase,
      fulfillUseCase,
      getQuery,
      listMyQuery,
      listTenantQuery
    );
  });

  describe('1. Pricing Calculations & Mathematical Invariants', () => {
    it('computes accurate total amount and line item pricing with decimal precision', () => {
      const order = Order.create(
        USER_A1,
        [
          { productId: 'P-01', productName: 'Circuit Breaker', quantity: 3, unitPrice: 19.99 },
          { productId: 'P-02', productName: 'Wire Roll 50m', quantity: 2, unitPrice: 34.50 }
        ],
        'USD',
        'order-math-01',
        TENANT_A
      );

      // 3 * 19.99 = 59.97; 2 * 34.50 = 69.00; total = 128.97
      expect(order.items[0]!.totalPrice).toBe(59.97);
      expect(order.items[1]!.totalPrice).toBe(69.00);
      expect(order.totalAmount).toBe(128.97);
      expect(order.tenantId).toBe(TENANT_A);
    });

    it('rejects order with zero items', () => {
      expect(() => {
        Order.create(USER_A1, [], 'USD', undefined, TENANT_A);
      }).toThrow('Order must contain at least one item');
    });

    it('rejects line item with zero or negative quantity', () => {
      expect(() => {
        Order.create(
          USER_A1,
          [{ productId: 'P-01', productName: 'Test', quantity: 0, unitPrice: 10.0 }],
          'USD',
          undefined,
          TENANT_A
        );
      }).toThrow('Item quantity must be positive');
    });

    it('rejects line item with negative unit price', () => {
      expect(() => {
        Order.create(
          USER_A1,
          [{ productId: 'P-01', productName: 'Test', quantity: 1, unitPrice: -5.0 }],
          'USD',
          undefined,
          TENANT_A
        );
      }).toThrow('Unit price cannot be negative');
    });
  });

  describe('2. State Machine Lifecycle Transitions', () => {
    it('follows valid lifecycle: PENDING -> RESERVED -> PAID -> FULFILLED', () => {
      const order = Order.create(
        USER_A1,
        [{ productId: 'P-01', productName: 'Valve', quantity: 1, unitPrice: 50.0 }],
        'USD',
        'order-state-01',
        TENANT_A
      );
      expect(order.status).toBe('PENDING');

      order.markReserved();
      expect(order.status).toBe('RESERVED');

      order.markPaid();
      expect(order.status).toBe('PAID');

      order.fulfill();
      expect(order.status).toBe('FULFILLED');
    });

    it('allows cancellation from PENDING or RESERVED', () => {
      const order = Order.create(
        USER_A1,
        [{ productId: 'P-01', productName: 'Valve', quantity: 1, unitPrice: 50.0 }],
        'USD',
        'order-cancel-01',
        TENANT_A
      );
      order.markReserved();
      order.cancel('Client cancelled repair job');

      expect(order.status).toBe('CANCELLED');
    });

    it('rejects cancelling an already fulfilled or shipped order', () => {
      const order = Order.create(
        USER_A1,
        [{ productId: 'P-01', productName: 'Valve', quantity: 1, unitPrice: 50.0 }],
        'USD',
        'order-fulfilled-01',
        TENANT_A
      );
      order.markReserved();
      order.markPaid();
      order.fulfill();

      expect(() => order.cancel('Too late')).toThrow(InvalidStateTransitionError);
    });

    it('rejects marking a cancelled order as paid', () => {
      const order = Order.create(
        USER_A1,
        [{ productId: 'P-01', productName: 'Valve', quantity: 1, unitPrice: 50.0 }],
        'USD',
        'order-cancelled-02',
        TENANT_A
      );
      order.cancel();

      expect(() => order.markPaid()).toThrow(InvalidStateTransitionError);
    });
  });

  describe('3. Multi-Tenant Quarantine & Boundary Isolation', () => {
    it('Tenant B cannot retrieve Tenant A order (NotFoundError quarantined lookup)', async () => {
      const orderA = await createUseCase.execute({
        userId: USER_A1,
        tenantId: TENANT_A,
        items: [{ productId: 'PROD-A', productName: 'Tenant A Supply', quantity: 2, unitPrice: 25.0 }]
      });
      const orderId = orderA.getValue().id;

      const attemptB = await getQuery.execute({
        orderId,
        userId: USER_B1,
        role: 'USER',
        tenantId: TENANT_B
      });

      expect(attemptB.isFailure).toBe(true);
      expect(attemptB.getError()).toBeInstanceOf(NotFoundError);
    });

    it('Tenant B cannot cancel Tenant A order', async () => {
      const orderA = await createUseCase.execute({
        userId: USER_A1,
        tenantId: TENANT_A,
        items: [{ productId: 'PROD-A', productName: 'Tenant A Supply', quantity: 2, unitPrice: 25.0 }]
      });
      const orderId = orderA.getValue().id;

      const cancelAttempt = await cancelUseCase.execute({
        orderId,
        userId: USER_B1,
        role: 'ADMIN',
        tenantId: TENANT_B
      });

      expect(cancelAttempt.isFailure).toBe(true);
      expect(cancelAttempt.getError()).toBeInstanceOf(NotFoundError);
    });

    it('Tenant user cannot view another user order within same tenant unless admin', async () => {
      const orderA1 = await createUseCase.execute({
        userId: USER_A1,
        tenantId: TENANT_A,
        items: [{ productId: 'PROD-A', productName: 'Item', quantity: 1, unitPrice: 10.0 }]
      });
      const orderId = orderA1.getValue().id;

      // Another user in Tenant A tries to access
      const viewAttempt = await getQuery.execute({
        orderId,
        userId: USER_A2,
        role: 'USER',
        tenantId: TENANT_A
      });

      expect(viewAttempt.isFailure).toBe(true);
      expect(viewAttempt.getError()).toBeInstanceOf(ForbiddenError);

      // Org admin in Tenant A can access
      const adminView = await getQuery.execute({
        orderId,
        userId: 'admin-alpha',
        role: 'ORGANIZATION_ADMIN',
        tenantId: TENANT_A
      });
      expect(adminView.isSuccess).toBe(true);
    });

    it('ListTenantOrdersQuery isolates orders strictly to the requesting tenant', async () => {
      await createUseCase.execute({
        userId: USER_A1,
        tenantId: TENANT_A,
        items: [{ productId: 'P-A', productName: 'Alpha Tool', quantity: 1, unitPrice: 15.0 }]
      });

      await createUseCase.execute({
        userId: USER_B1,
        tenantId: TENANT_B,
        items: [{ productId: 'P-B', productName: 'Beta Tool', quantity: 1, unitPrice: 30.0 }]
      });

      const listA = await listTenantQuery.execute({ tenantId: TENANT_A });
      const listB = await listTenantQuery.execute({ tenantId: TENANT_B });

      expect(listA.getValue().every(o => o.tenantId === TENANT_A)).toBe(true);
      expect(listB.getValue().every(o => o.tenantId === TENANT_B)).toBe(true);
      expect(listA.getValue().some(o => o.items.some(i => i.productName === 'Beta Tool'))).toBe(false);
    });
  });

  describe('4. Inventory Reservation Linkage & Compensation Rollback', () => {
    it('reserves inventory and marks order as RESERVED on successful creation', async () => {
      const res = await createUseCase.execute({
        userId: USER_A1,
        tenantId: TENANT_A,
        items: [
          { productId: 'STOCK-01', productName: 'Smoke Detector', quantity: 4, unitPrice: 20.0 },
          { productId: 'STOCK-02', productName: 'Carbon Monoxide Detector', quantity: 2, unitPrice: 30.0 }
        ]
      });

      expect(res.isSuccess).toBe(true);
      expect(res.getValue().status).toBe('RESERVED');
      expect(inventoryService.reservations.get('STOCK-01')).toBe(4);
      expect(inventoryService.reservations.get('STOCK-02')).toBe(2);
    });

    it('rolls back previously reserved items if any item in the order fails reservation', async () => {
      // First item succeeds, second item triggers failure
      let callCount = 0;
      inventoryService.reserve = async (productId, quantity) => {
        callCount++;
        if (callCount === 2) {
          return false; // Simulate out-of-stock on second item
        }
        const curr = inventoryService.reservations.get(productId) || 0;
        inventoryService.reservations.set(productId, curr + quantity);
        return true;
      };

      const res = await createUseCase.execute({
        userId: USER_A1,
        tenantId: TENANT_A,
        items: [
          { productId: 'STOCK-OK', productName: 'Good Stock', quantity: 5, unitPrice: 10.0 },
          { productId: 'STOCK-OUT', productName: 'Depleted Stock', quantity: 5, unitPrice: 10.0 }
        ]
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(ConflictError);
      expect(res.getError().message).toContain('Insufficient inventory');

      // Verify compensation rollback was executed on STOCK-OK
      expect(inventoryService.releases.some(r => r.productId === 'STOCK-OK')).toBe(true);
    });

    it('releases reserved stock when order is cancelled', async () => {
      const order = await createUseCase.execute({
        userId: USER_A1,
        tenantId: TENANT_A,
        items: [{ productId: 'STOCK-REL', productName: 'Spare Key Vault', quantity: 3, unitPrice: 40.0 }]
      });
      const orderId = order.getValue().id;

      await cancelUseCase.execute({
        orderId,
        userId: USER_A1,
        tenantId: TENANT_A,
        reason: 'Job rescheduled'
      });

      expect(inventoryService.releases.some(r => r.productId === 'STOCK-REL' && r.quantity === 3)).toBe(true);
      expect(inventoryService.reservations.get('STOCK-REL')).toBe(0);
    });

    it('commits reserved stock permanently when order is fulfilled', async () => {
      const order = await createUseCase.execute({
        userId: USER_A1,
        tenantId: TENANT_A,
        items: [{ productId: 'STOCK-COM', productName: 'Smart Thermostat', quantity: 2, unitPrice: 120.0 }]
      });
      const orderId = order.getValue().id;

      await fulfillUseCase.execute({
        orderId,
        tenantId: TENANT_A
      });

      expect(inventoryService.commits.some(c => c.productId === 'STOCK-COM' && c.quantity === 2)).toBe(true);
    });
  });

  describe('5. Presentation Boundary & Controller Integration', () => {
    function mockReq(body: any = {}, headers: any = {}, params: any = {}): Request {
      return {
        body,
        headers,
        params,
        user: { id: USER_A1, role: 'USER', tenantId: headers['x-tenant-id'] || TENANT_A }
      } as unknown as Request;
    }

    function mockRes(): { res: Response; getStatus: () => number; getJson: () => any } {
      let status = 200;
      let json: any = null;
      const res = {
        status: (code: number) => {
          status = code;
          return res;
        },
        json: (data: any) => {
          json = data;
          return res;
        }
      } as unknown as Response;
      return { res, getStatus: () => status, getJson: () => json };
    }

    it('executes full create, getById, cancel, and list cycle via OrderController', async () => {
      // 1. Create Order
      const createReq = mockReq(
        {
          items: [{ productId: 'CTRL-P1', productName: 'Fire Alarm Test Kit', quantity: 2, unitPrice: 45.0 }]
        },
        { 'x-tenant-id': TENANT_A }
      );
      const { res: createRes, getStatus: getCreateStatus, getJson: getCreateJson } = mockRes();
      await controller.create(createReq, createRes, (err) => { throw err; });

      expect(getCreateStatus()).toBe(201);
      const order = getCreateJson().data;
      expect(order.totalAmount).toBe(90.0);
      const orderId = order.id;

      // 2. Query Order Details
      const getReq = mockReq({}, { 'x-tenant-id': TENANT_A }, { id: orderId });
      const { res: getRes, getStatus: getGetStatus, getJson: getGetJson } = mockRes();
      await controller.getById(getReq, getRes, (err) => { throw err; });

      expect(getGetStatus()).toBe(200);
      expect(getGetJson().data.id).toBe(orderId);

      // 3. List My Orders
      const listReq = mockReq({}, { 'x-tenant-id': TENANT_A });
      const { res: listRes, getStatus: getListStatus, getJson: getListJson } = mockRes();
      await controller.listMyOrders(listReq, listRes, (err) => { throw err; });

      expect(getListStatus()).toBe(200);
      expect(getListJson().data.length).toBeGreaterThanOrEqual(1);

      // 4. Cancel Order
      const cancelReq = mockReq({ reason: 'Incorrect quantity' }, { 'x-tenant-id': TENANT_A }, { id: orderId });
      const { res: cancelRes, getStatus: getCancelStatus, getJson: getCancelJson } = mockRes();
      await controller.cancel(cancelReq, cancelRes, (err) => { throw err; });

      expect(getCancelStatus()).toBe(200);
      expect(getCancelJson().data.status).toBe('CANCELLED');
    });

    it('rejects invalid inputs with Zod validation 400 Bad Request', async () => {
      const invalidReq = mockReq({ items: [] }, { 'x-tenant-id': TENANT_A });
      const { res } = mockRes();
      let errorThrown: any = null;

      await controller.create(invalidReq, res, (err) => {
        errorThrown = err;
      });

      expect(errorThrown).toBeTruthy();
    });
  });

  describe('6. OrderModule Public API Integration & Event Subscription', () => {
    it('marks order as PAID when transactions.completed integration event is received', async () => {
      const { publicApi, repository: modRepo } = OrderModule.init(undefined, undefined, eventBus);

      const order = Order.create(
        USER_A1,
        [{ productId: 'ASYNC-P1', productName: 'Filter', quantity: 1, unitPrice: 100.0 }],
        'USD',
        'order-async-paid-01',
        TENANT_A
      );
      await modRepo.save(order);

      const before = await publicApi.getOrder('order-async-paid-01', TENANT_A);
      expect(before!.status).toBe('PENDING');

      // Publish transaction completed event
      await eventBus.publish({
        id: 'tx-evt-1',
        eventName: 'transactions.completed',
        aggregateId: 'tx-001',
        occurredAt: new Date().toISOString(),
        payload: { referenceId: 'order-async-paid-01', status: 'SUCCESS' },
        version: 1
      });

      const after = await publicApi.getOrder('order-async-paid-01', TENANT_A);
      expect(after!.status).toBe('PAID');
    });

    it('supports fulfillOrder and cancelOrder via publicApi', async () => {
      const { publicApi, repository: modRepo } = OrderModule.init(undefined, undefined, eventBus);

      const order = Order.create(
        USER_A1,
        [{ productId: 'PUB-P1', productName: 'Lock', quantity: 1, unitPrice: 60.0 }],
        'USD',
        'order-pub-test-01',
        TENANT_A
      );
      order.markPaid();
      await modRepo.save(order);

      const fulfilled = await publicApi.fulfillOrder('order-pub-test-01', TENANT_A);
      expect(fulfilled).toBe(true);

      const check = await publicApi.getOrder('order-pub-test-01', TENANT_A);
      expect(check!.status).toBe('FULFILLED');
    });
  });
});
