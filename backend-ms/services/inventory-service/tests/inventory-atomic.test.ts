import { test } from 'node:test';
import assert from 'node:assert';
import { InventoryItem } from '../src/domain/entities/inventory.entity.js';
import { IInventoryRepository } from '../src/domain/repositories/inventory-repository.interface.js';
import { ReserveInventoryUseCase, ReleaseInventoryUseCase, AddStockUseCase } from '../src/application/use-cases/inventory.use-cases.js';

class MockInventoryRepository implements IInventoryRepository {
  public items = new Map<string, InventoryItem>();

  private key(productId: string, tenantId?: string): string {
    return `${tenantId || 'default'}:${productId}`;
  }

  async findByProductId(productId: string, tenantId?: string): Promise<InventoryItem | null> {
    return this.items.get(this.key(productId, tenantId)) || null;
  }

  async findBySku(sku: string, tenantId?: string): Promise<InventoryItem | null> {
    for (const item of this.items.values()) {
      if (item.sku === sku && item.tenantId === (tenantId || 'default')) return item;
    }
    return null;
  }

  async save(item: InventoryItem): Promise<void> {
    this.items.set(this.key(item.productId, item.tenantId), item);
  }

  async update(item: InventoryItem): Promise<void> {
    this.items.set(this.key(item.productId, item.tenantId), item);
  }

  async reserveAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null> {
    const k = this.key(productId, tenantId);
    const item = this.items.get(k);
    if (!item) return null;
    if (item.availableQuantity < quantity) return null;

    item.reserve(quantity);
    return item;
  }

  async releaseAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null> {
    const k = this.key(productId, tenantId);
    const item = this.items.get(k);
    if (!item) return null;

    item.release(quantity);
    return item;
  }
}

test('Inventory Service: Atomic reservation, release compensation, and tenant isolation', async () => {
  const repo = new MockInventoryRepository();
  const reserveUseCase = new ReserveInventoryUseCase(repo);
  const releaseUseCase = new ReleaseInventoryUseCase(repo);
  const addStockUseCase = new AddStockUseCase(repo);

  // 1. Seed stock for Tenant A and Tenant B
  await addStockUseCase.execute({
    productId: 'prod-laptop',
    sku: 'SKU-LAPTOP-01',
    quantity: 10,
    tenantId: 'tenant-a'
  });

  await addStockUseCase.execute({
    productId: 'prod-laptop',
    sku: 'SKU-LAPTOP-01',
    quantity: 3,
    tenantId: 'tenant-b'
  });

  // Verify stock in Tenant A is 10, Tenant B is 3
  const itemA = await repo.findByProductId('prod-laptop', 'tenant-a');
  const itemB = await repo.findByProductId('prod-laptop', 'tenant-b');
  assert.strictEqual(itemA?.availableQuantity, 10);
  assert.strictEqual(itemB?.availableQuantity, 3);

  // 2. Reserve 4 items in Tenant A -> Succeeded, available becomes 6, reserved 4
  const resA = await reserveUseCase.execute({
    productId: 'prod-laptop',
    quantity: 4,
    tenantId: 'tenant-a'
  });
  assert.strictEqual(resA.isSuccess, true);
  assert.strictEqual(resA.getValue().availableQuantity, 6);
  assert.strictEqual(resA.getValue().reservedQuantity, 4);

  // Verify Tenant B's stock is untouched!
  const itemBAfterA = await repo.findByProductId('prod-laptop', 'tenant-b');
  assert.strictEqual(itemBAfterA?.availableQuantity, 3);

  // 3. Attempt to reserve 5 items in Tenant B (which only has 3) -> Insufficient stock error!
  const resB = await reserveUseCase.execute({
    productId: 'prod-laptop',
    quantity: 5,
    tenantId: 'tenant-b'
  });
  assert.strictEqual(resB.isFailure, true);
  assert.match(resB.getError(), /Insufficient stock/);

  // 4. Saga Compensation: Release 2 items back to Tenant A
  const releaseRes = await releaseUseCase.execute({
    productId: 'prod-laptop',
    quantity: 2,
    tenantId: 'tenant-a'
  });
  assert.strictEqual(releaseRes.isSuccess, true);
  assert.strictEqual(releaseRes.getValue().availableQuantity, 8);
  assert.strictEqual(releaseRes.getValue().reservedQuantity, 2);
});
