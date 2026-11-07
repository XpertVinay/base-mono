import { describe, it, expect, beforeEach } from 'vitest';
import {
  InventoryItem,
  InsufficientStockError,
  ConcurrencyError,
  PostgresInventoryRepository,
  CreateInventoryItemUseCase,
  ReserveStockUseCase,
  ReleaseStockUseCase,
  CommitStockUseCase,
  ListInventoryQuery,
  GetInventoryItemQuery,
  InventoryController,
  InventoryModule
} from '../../modules/inventory/index.js';
import {
  ConflictError,
  NotFoundError
} from '../../shared/presentation/error-handler.middleware.js';
import { Request, Response } from 'express';

describe('Sprint 07: Multi-Tenant Inventory Ledger & Optimistic Concurrency Control', () => {
  let repository: PostgresInventoryRepository;
  let createUseCase: CreateInventoryItemUseCase;
  let reserveUseCase: ReserveStockUseCase;
  let releaseUseCase: ReleaseStockUseCase;
  let commitUseCase: CommitStockUseCase;
  let listQuery: ListInventoryQuery;
  let getQuery: GetInventoryItemQuery;
  let controller: InventoryController;

  const TENANT_A = 'org-tenant-alpha-100';
  const TENANT_B = 'org-tenant-beta-200';

  beforeEach(() => {
    repository = new PostgresInventoryRepository();
    createUseCase = new CreateInventoryItemUseCase(repository);
    reserveUseCase = new ReserveStockUseCase(repository);
    releaseUseCase = new ReleaseStockUseCase(repository);
    commitUseCase = new CommitStockUseCase(repository);
    listQuery = new ListInventoryQuery(repository);
    getQuery = new GetInventoryItemQuery(repository);

    controller = new InventoryController(
      listQuery,
      getQuery,
      createUseCase,
      reserveUseCase,
      releaseUseCase,
      commitUseCase
    );
  });

  describe('1. Domain Invariants & Mathematical Equilibrium', () => {
    it('creates inventory item with valid invariant: available == total and reserved == 0', () => {
      const item = InventoryItem.create({
        productId: 'item-001',
        tenantId: TENANT_A,
        sku: 'VALVE-PRESSURE-2IN',
        name: '2-inch High Pressure Water Valve',
        category: 'PLUMBING',
        initialStock: 25
      });

      expect(item.availableQuantity).toBe(25);
      expect(item.reservedQuantity).toBe(0);
      expect(item.totalQuantity).toBe(25);
      expect(item.version).toBe(1);
      expect(item.availableQuantity + item.reservedQuantity).toBe(item.totalQuantity);
    });

    it('rejects initial negative stock quantities', () => {
      expect(() => {
        InventoryItem.create({
          productId: 'item-neg',
          tenantId: TENANT_A,
          sku: 'BAD-STOCK',
          initialStock: -10
        });
      }).toThrow('Initial stock cannot be negative');
    });

    it('reserve() decrements available and increments reserved while keeping total constant', () => {
      const item = InventoryItem.create({
        productId: 'item-002',
        tenantId: TENANT_A,
        sku: 'BREAKER-20AMP',
        name: '20A Circuit Breaker',
        initialStock: 10
      });

      item.reserve(4);

      expect(item.availableQuantity).toBe(6);
      expect(item.reservedQuantity).toBe(4);
      expect(item.totalQuantity).toBe(10);
      expect(item.version).toBe(2);
      expect(item.availableQuantity + item.reservedQuantity).toBe(item.totalQuantity);
    });

    it('reserve() throws InsufficientStockError when requested quantity exceeds available quantity', () => {
      const item = InventoryItem.create({
        productId: 'item-003',
        tenantId: TENANT_A,
        sku: 'HVAC-FILTER-HEPA',
        initialStock: 5
      });

      expect(() => item.reserve(6)).toThrow(InsufficientStockError);
      expect(item.availableQuantity).toBe(5);
      expect(item.reservedQuantity).toBe(0);
      expect(item.version).toBe(1);
    });

    it('release() returns reserved stock to available quantity', () => {
      const item = InventoryItem.create({
        productId: 'item-004',
        tenantId: TENANT_A,
        sku: 'PAINT-WHITE-5GAL',
        initialStock: 10
      });

      item.reserve(5);
      expect(item.availableQuantity).toBe(5);
      expect(item.reservedQuantity).toBe(5);

      item.release(3);
      expect(item.availableQuantity).toBe(8);
      expect(item.reservedQuantity).toBe(2);
      expect(item.totalQuantity).toBe(10);
      expect(item.version).toBe(3);
    });

    it('commit() permanently debits reserved stock upon physical dispatch', () => {
      const item = InventoryItem.create({
        productId: 'item-005',
        tenantId: TENANT_A,
        sku: 'DOOR-LOCK-ELECTRONIC',
        initialStock: 8
      });

      item.reserve(3);
      expect(item.availableQuantity).toBe(5);
      expect(item.reservedQuantity).toBe(3);
      expect(item.totalQuantity).toBe(8);

      item.commit(3);
      expect(item.availableQuantity).toBe(5);
      expect(item.reservedQuantity).toBe(0);
      expect(item.totalQuantity).toBe(5);
      expect(item.version).toBe(3);
    });

    it('commit() rejects committing more quantity than actively reserved', () => {
      const item = InventoryItem.create({
        productId: 'item-006',
        tenantId: TENANT_A,
        sku: 'SENSOR-SMOKE-OPTICAL',
        initialStock: 10
      });

      item.reserve(2);
      expect(() => item.commit(3)).toThrow('Cannot commit 3 units: exceeds reserved quantity of 2');
    });

    it('adjustStock() recalculates available stock and rejects total below reserved quantity', () => {
      const item = InventoryItem.create({
        productId: 'item-007',
        tenantId: TENANT_A,
        sku: 'STAGING-LAMP-FLOOR',
        initialStock: 10
      });

      item.reserve(4);
      item.adjustStock(15);

      expect(item.totalQuantity).toBe(15);
      expect(item.reservedQuantity).toBe(4);
      expect(item.availableQuantity).toBe(11);

      expect(() => item.adjustStock(3)).toThrow(
        'New total quantity (3) cannot be less than active reserved quantity (4)'
      );
    });
  });

  describe('2. Multi-Tenant Data Quarantine & Boundary Isolation', () => {
    it('allows identical SKU across different tenant organizations', async () => {
      const resA = await createUseCase.execute({
        tenantId: TENANT_A,
        sku: 'PLUMBING-WRENCH-ADJ',
        name: 'Tenant A Wrench',
        initialQuantity: 10
      });

      const resB = await createUseCase.execute({
        tenantId: TENANT_B,
        sku: 'PLUMBING-WRENCH-ADJ',
        name: 'Tenant B Wrench',
        initialQuantity: 20
      });

      expect(resA.isSuccess).toBe(true);
      expect(resB.isSuccess).toBe(true);
      expect(resA.getValue().tenantId).toBe(TENANT_A);
      expect(resB.getValue().tenantId).toBe(TENANT_B);
    });

    it('rejects duplicate SKU within the same tenant organization (409 Conflict)', async () => {
      await createUseCase.execute({
        tenantId: TENANT_A,
        sku: 'FIRE-EXTINGUISHER-10LB',
        initialQuantity: 5
      });

      const duplicate = await createUseCase.execute({
        tenantId: TENANT_A,
        sku: 'FIRE-EXTINGUISHER-10LB',
        initialQuantity: 10
      });

      expect(duplicate.isFailure).toBe(true);
      expect(duplicate.getError()).toBeInstanceOf(ConflictError);
      expect(duplicate.getError().message).toContain('already exists within this tenant organization');
    });

    it('Tenant B cannot view Tenant A inventory items via ListInventoryQuery', async () => {
      await createUseCase.execute({
        tenantId: TENANT_A,
        sku: 'ALPHA-EXCLUSIVE-PART',
        initialQuantity: 12
      });

      await createUseCase.execute({
        tenantId: TENANT_B,
        sku: 'BETA-EXCLUSIVE-PART',
        initialQuantity: 8
      });

      const listA = await listQuery.execute({ tenantId: TENANT_A });
      const listB = await listQuery.execute({ tenantId: TENANT_B });

      expect(listA.getValue().some(i => i.sku === 'ALPHA-EXCLUSIVE-PART')).toBe(true);
      expect(listA.getValue().some(i => i.sku === 'BETA-EXCLUSIVE-PART')).toBe(false);

      expect(listB.getValue().some(i => i.sku === 'BETA-EXCLUSIVE-PART')).toBe(true);
      expect(listB.getValue().some(i => i.sku === 'ALPHA-EXCLUSIVE-PART')).toBe(false);
    });

    it('Tenant B cannot reserve Tenant A stock (NotFoundError quarantined lookup)', async () => {
      const itemA = await createUseCase.execute({
        tenantId: TENANT_A,
        sku: 'ALPHA-VALUABLE-PART',
        initialQuantity: 10
      });

      const reserveAttempt = await reserveUseCase.execute({
        productId: itemA.getValue().productId,
        tenantId: TENANT_B,
        quantity: 2,
        orderId: 'order-hack-attempt'
      });

      expect(reserveAttempt.isFailure).toBe(true);
      expect(reserveAttempt.getError()).toBeInstanceOf(NotFoundError);

      // Verify Tenant A stock remained untouched
      const freshA = await getQuery.execute({
        productId: itemA.getValue().productId,
        tenantId: TENANT_A
      });
      expect(freshA.getValue().availableQuantity).toBe(10);
      expect(freshA.getValue().reservedQuantity).toBe(0);
    });
  });

  describe('3. Optimistic Concurrency Control (Version Guards)', () => {
    it('increments version on successful reservation with matching expectedVersion', async () => {
      const item = await createUseCase.execute({
        tenantId: TENANT_A,
        sku: 'CONCURRENCY-TEST-SKU',
        initialQuantity: 50
      });

      const productId = item.getValue().productId;
      expect(item.getValue().version).toBe(1);

      const res = await reserveUseCase.execute({
        productId,
        tenantId: TENANT_A,
        quantity: 5,
        orderId: 'order-101',
        expectedVersion: 1
      });

      expect(res.isSuccess).toBe(true);
      expect(res.getValue().version).toBe(2);
      expect(res.getValue().availableQuantity).toBe(45);
      expect(res.getValue().reservedQuantity).toBe(5);
    });

    it('rejects reservation with ConflictError when expectedVersion is stale', async () => {
      // Direct domain entity check for ConcurrencyError
      const testItem = InventoryItem.create({
        productId: 'concurr-err-test',
        tenantId: TENANT_A,
        sku: 'ERR-SKU',
        initialStock: 10
      });
      expect(() => testItem.reserve(2, 999)).toThrow(ConcurrencyError);

      const item = await createUseCase.execute({
        tenantId: TENANT_A,
        sku: 'STALE-VERSION-SKU',
        initialQuantity: 30
      });

      const productId = item.getValue().productId;

      // First reservation updates version to 2
      await reserveUseCase.execute({
        productId,
        tenantId: TENANT_A,
        quantity: 5,
        orderId: 'order-user-A',
        expectedVersion: 1
      });

      // Second simultaneous reservation that read version 1 tries to write
      const staleAttempt = await reserveUseCase.execute({
        productId,
        tenantId: TENANT_A,
        quantity: 5,
        orderId: 'order-user-B',
        expectedVersion: 1 // Stale! Current is 2
      });

      expect(staleAttempt.isFailure).toBe(true);
      expect(staleAttempt.getError()).toBeInstanceOf(ConflictError);
      expect(staleAttempt.getError().message).toContain('Optimistic concurrency conflict');
    });

    it('handles release and commit transitions with version tracking', async () => {
      const item = await createUseCase.execute({
        tenantId: TENANT_A,
        sku: 'LIFECYCLE-VERSION-SKU',
        initialQuantity: 20
      });

      const productId = item.getValue().productId;
      expect(item.getValue().version).toBe(1);

      const reserved = await reserveUseCase.execute({
        productId,
        tenantId: TENANT_A,
        quantity: 10,
        orderId: 'order-lifecycle'
      });
      expect(reserved.getValue().version).toBe(2);

      const released = await releaseUseCase.execute({
        productId,
        tenantId: TENANT_A,
        quantity: 4,
        orderId: 'order-lifecycle'
      });
      expect(released.getValue().version).toBe(3);
      expect(released.getValue().reservedQuantity).toBe(6);

      const committed = await commitUseCase.execute({
        productId,
        tenantId: TENANT_A,
        quantity: 6,
        orderId: 'order-lifecycle'
      });
      expect(committed.getValue().version).toBe(4);
      expect(committed.getValue().reservedQuantity).toBe(0);
      expect(committed.getValue().totalQuantity).toBe(14);
      expect(committed.getValue().availableQuantity).toBe(14);
    });
  });

  describe('4. Presentation Boundary & Controller Integration', () => {
    function mockReq(body: any = {}, headers: any = {}, params: any = {}): Request {
      return {
        body,
        headers,
        params,
        user: { id: 'test-user-id', tenantId: headers['x-tenant-id'] || TENANT_A }
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

    it('creates, lists, reserves, releases, and commits stock via Controller endpoints', async () => {
      // 1. Create Stock Item
      const createReq = mockReq(
        { sku: 'CONTROLLER-SOCKET-WRENCH', initialQuantity: 15, name: 'Socket Wrench Set' },
        { 'x-tenant-id': TENANT_A }
      );
      const { res: createRes, getStatus: getCreateStatus, getJson: getCreateJson } = mockRes();
      await controller.create(createReq, createRes, (err) => { throw err; });

      expect(getCreateStatus()).toBe(201);
      const created = getCreateJson().data;
      expect(created.sku).toBe('CONTROLLER-SOCKET-WRENCH');
      const productId = created.productId;

      // 2. Query Item by ID
      const getReq = mockReq({}, { 'x-tenant-id': TENANT_A }, { productId });
      const { res: getRes, getStatus: getGetStatus, getJson: getGetJson } = mockRes();
      await controller.getById(getReq, getRes, (err) => { throw err; });

      expect(getGetStatus()).toBe(200);
      expect(getGetJson().data.availableQuantity).toBe(15);

      // 3. Reserve Stock
      const reserveReq = mockReq(
        { productId, quantity: 5, orderId: 'WO-8888', expectedVersion: 1 },
        { 'x-tenant-id': TENANT_A }
      );
      const { res: reserveRes, getStatus: getReserveStatus, getJson: getReserveJson } = mockRes();
      await controller.reserve(reserveReq, reserveRes, (err) => { throw err; });

      expect(getReserveStatus()).toBe(200);
      expect(getReserveJson().data.availableQuantity).toBe(10);
      expect(getReserveJson().data.reservedQuantity).toBe(5);

      // 4. Release partial stock
      const releaseReq = mockReq(
        { productId, quantity: 2, orderId: 'WO-8888' },
        { 'x-tenant-id': TENANT_A }
      );
      const { res: releaseRes, getStatus: getReleaseStatus, getJson: getReleaseJson } = mockRes();
      await controller.release(releaseReq, releaseRes, (err) => { throw err; });

      expect(getReleaseStatus()).toBe(200);
      expect(getReleaseJson().data.availableQuantity).toBe(12);
      expect(getReleaseJson().data.reservedQuantity).toBe(3);

      // 5. Commit remaining stock
      const commitReq = mockReq(
        { productId, quantity: 3, orderId: 'WO-8888' },
        { 'x-tenant-id': TENANT_A }
      );
      const { res: commitRes, getStatus: getCommitStatus, getJson: getCommitJson } = mockRes();
      await controller.commit(commitReq, commitRes, (err) => { throw err; });

      expect(getCommitStatus()).toBe(200);
      expect(getCommitJson().data.availableQuantity).toBe(12);
      expect(getCommitJson().data.reservedQuantity).toBe(0);
      expect(getCommitJson().data.totalQuantity).toBe(12);
    });

    it('rejects invalid inputs with Zod validation 400 Bad Request', async () => {
      const invalidReq = mockReq({ sku: '', initialQuantity: -5 }, { 'x-tenant-id': TENANT_A });
      const { res } = mockRes();
      let errorThrown: any = null;

      await controller.create(invalidReq, res, (err) => {
        errorThrown = err;
      });

      expect(errorThrown).toBeTruthy();
    });
  });

  describe('5. InventoryModule Public API Integration', () => {
    it('operates seamlessly via InventoryModule.init publicApi', async () => {
      const { publicApi, repository: modRepo } = InventoryModule.init();

      // Seed an item in the module repository
      const item = InventoryItem.create({
        productId: 'PUBLIC-API-PART-01',
        tenantId: TENANT_A,
        sku: 'PUBLIC-API-PART',
        initialStock: 40
      });
      await modRepo.save(item);

      const stockBefore = await publicApi.getStock('PUBLIC-API-PART-01', TENANT_A);
      expect(stockBefore).not.toBeNull();
      expect(stockBefore!.availableQuantity).toBe(40);

      const reserveOk = await publicApi.reserve('PUBLIC-API-PART-01', 10, 'ORDER-PUB-1', TENANT_A, 1);
      expect(reserveOk).toBe(true);

      const stockAfter = await publicApi.getStock('PUBLIC-API-PART-01', TENANT_A);
      expect(stockAfter!.availableQuantity).toBe(30);
      expect(stockAfter!.reservedQuantity).toBe(10);
      expect(stockAfter!.version).toBe(2);

      const releaseOk = await publicApi.release('PUBLIC-API-PART-01', 5, 'ORDER-PUB-1', TENANT_A);
      expect(releaseOk).toBe(true);

      const commitOk = await publicApi.commit('PUBLIC-API-PART-01', 5, 'ORDER-PUB-1', TENANT_A);
      expect(commitOk).toBe(true);

      const finalStock = await publicApi.getStock('PUBLIC-API-PART-01', TENANT_A);
      expect(finalStock!.availableQuantity).toBe(35);
      expect(finalStock!.reservedQuantity).toBe(0);
      expect(finalStock!.totalQuantity).toBe(35);
    });
  });
});
