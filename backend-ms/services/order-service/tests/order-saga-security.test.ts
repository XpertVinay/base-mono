import { test } from 'node:test';
import assert from 'node:assert';
import { Order } from '../src/domain/entities/order.entity.js';
import { IOrderRepository } from '../src/domain/repositories/order-repository.interface.js';
import { CreateOrderUseCase, GetOrderByIdQuery, CancelOrderUseCase } from '../src/application/commands/order.commands.js';

class MockOrderRepository implements IOrderRepository {
  public orders = new Map<string, Order>();

  async findById(id: string, tenantId?: string): Promise<Order | null> {
    const o = this.orders.get(id) || null;
    if (!o) return null;
    if (tenantId && o.tenantId !== tenantId && o.tenantId !== 'default') return null;
    return o;
  }

  async findByUserId(userId: string, tenantId?: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      o => o.userId === userId && (!tenantId || o.tenantId === tenantId)
    );
  }

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async update(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }
}

test('Order Service: Distributed Saga compensation on stock reservation failure', async () => {
  const repo = new MockOrderRepository();
  const releasedItems: Array<{ productId: string; quantity: number }> = [];

  const mockInventoryClient: any = {
    checkStock: async () => true,
    reserveStock: async (productId: string) => {
      // Simulate item-1 succeeds, item-2 fails
      if (productId === 'prod-out-of-stock') return false;
      return true;
    },
    releaseStock: async (productId: string, quantity: number) => {
      releasedItems.push({ productId, quantity });
    }
  };

  const createUseCase = new CreateOrderUseCase(repo, mockInventoryClient);

  const res = await createUseCase.execute({
    userId: 'user-1',
    tenantId: 'tenant-omega',
    items: [
      { productId: 'prod-in-stock', productName: 'Item A', quantity: 2, unitPrice: 100 },
      { productId: 'prod-out-of-stock', productName: 'Item B', quantity: 1, unitPrice: 200 }
    ]
  });

  // 1. Order creation must fail
  assert.strictEqual(res.isFailure, true);
  assert.match(res.getError(), /Stock reservation failed/);

  // 2. Previously reserved item A must be compensated (released)
  assert.strictEqual(releasedItems.length, 1);
  assert.strictEqual(releasedItems[0].productId, 'prod-in-stock');
  assert.strictEqual(releasedItems[0].quantity, 2);

  // 3. Saved order status must be CANCELLED in DB
  const orders = Array.from(repo.orders.values());
  assert.strictEqual(orders.length, 1);
  assert.strictEqual(orders[0].status, 'CANCELLED');
});

test('Order Service: Strict tenant isolation and IDOR access control', async () => {
  const repo = new MockOrderRepository();
  const order = Order.create(
    'user-alice',
    [{ productId: 'p1', productName: 'Gadget', quantity: 1, unitPrice: 50 }],
    'USD',
    'ord-123',
    'tenant-corp'
  );
  await repo.save(order);

  const query = new GetOrderByIdQuery(repo);

  // 1. Legitimate owner Alice in tenant-corp succeeds
  const aliceRes = await query.execute({
    orderId: 'ord-123',
    userId: 'user-alice',
    role: 'USER',
    tenantId: 'tenant-corp'
  });
  assert.strictEqual(aliceRes.isSuccess, true);

  // 2. Attacker Bob in same tenant tries to access Alice's order -> FORBIDDEN
  const bobRes = await query.execute({
    orderId: 'ord-123',
    userId: 'user-bob',
    role: 'USER',
    tenantId: 'tenant-corp'
  });
  assert.strictEqual(bobRes.isFailure, true);
  assert.strictEqual(bobRes.getError(), 'Forbidden: You do not own this order');

  // 3. Cross-tenant access attempt -> BLOCKED
  const crossRes = await query.execute({
    orderId: 'ord-123',
    userId: 'user-alice',
    role: 'USER',
    tenantId: 'tenant-other'
  });
  assert.strictEqual(crossRes.isFailure, true);
});
