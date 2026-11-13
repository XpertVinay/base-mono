import { test } from 'node:test';
import assert from 'node:assert';
import { Asset } from '../src/domain/entities/asset.entity.js';
import { IAssetRepository } from '../src/domain/repositories/asset-repository.interface.js';
import { CreateAssetUseCase } from '../src/application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from '../src/application/queries/list-assets.query.js';

class MockAssetRepository implements IAssetRepository {
  public assets: Asset[] = [];

  async findById(id: string, tenantId?: string): Promise<Asset | null> {
    const asset = this.assets.find(a => a.id === id);
    if (!asset) return null;
    if (tenantId && asset.tenantId !== tenantId && asset.tenantId !== 'default') return null;
    return asset;
  }

  async findByOwnerId(ownerId: string, tenantId?: string): Promise<Asset[]> {
    return this.assets.filter(
      a => a.ownerId === ownerId && (!tenantId || a.tenantId === tenantId || a.tenantId === 'default')
    );
  }

  async save(asset: Asset): Promise<void> {
    this.assets.push(asset);
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const idx = this.assets.findIndex(a => a.id === id && (!tenantId || a.tenantId === tenantId));
    if (idx >= 0) {
      this.assets.splice(idx, 1);
      return true;
    }
    return false;
  }
}

test('Asset Service: Strict tenant isolation and owner scoping', async () => {
  const repo = new MockAssetRepository();
  const createUseCase = new CreateAssetUseCase(repo);
  const listQuery = new ListAssetsQuery(repo);

  // 1. Create asset for Alice in tenant-1
  const createRes1 = await createUseCase.execute({
    name: 'document1.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    storagePath: '/uploads/doc1.pdf',
    ownerId: 'user-alice',
    tenantId: 'tenant-1'
  });
  assert.strictEqual(createRes1.isSuccess, true);
  assert.strictEqual(createRes1.getValue().tenantId, 'tenant-1');

  // 2. Create asset for Alice in tenant-2
  const createRes2 = await createUseCase.execute({
    name: 'contract2.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    storagePath: '/uploads/doc2.pdf',
    ownerId: 'user-alice',
    tenantId: 'tenant-2'
  });
  assert.strictEqual(createRes2.isSuccess, true);
  assert.strictEqual(createRes2.getValue().tenantId, 'tenant-2');

  // 3. Query assets for Alice in tenant-1 -> Only returns asset from tenant-1
  const list1 = await listQuery.execute({ ownerId: 'user-alice', tenantId: 'tenant-1' });
  assert.strictEqual(list1.isSuccess, true);
  const items1 = list1.getValue();
  assert.strictEqual(items1.length, 1);
  assert.strictEqual(items1[0].name, 'document1.pdf');
  assert.strictEqual(items1[0].tenantId, 'tenant-1');

  // 4. Query assets for Alice in tenant-2 -> Only returns asset from tenant-2
  const list2 = await listQuery.execute({ ownerId: 'user-alice', tenantId: 'tenant-2' });
  assert.strictEqual(list2.isSuccess, true);
  const items2 = list2.getValue();
  assert.strictEqual(items2.length, 1);
  assert.strictEqual(items2[0].name, 'contract2.pdf');
  assert.strictEqual(items2[0].tenantId, 'tenant-2');

  // 5. Query for Bob in tenant-1 -> Empty list
  const listBob = await listQuery.execute({ ownerId: 'user-bob', tenantId: 'tenant-1' });
  assert.strictEqual(listBob.getValue().length, 0);
});
