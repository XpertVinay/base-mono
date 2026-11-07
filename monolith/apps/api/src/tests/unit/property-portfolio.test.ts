import { describe, it, expect, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { InMemoryEventBus } from '../../infrastructure/messaging/event-bus.js';
import { NotFoundError } from '../../shared/presentation/error-handler.middleware.js';

import {
  Property,
  InvalidOwnershipSplitError,
  InvalidPropertyTransitionError,
  PropertyUnit,
  PostgresPropertyRepository,
  CreatePropertyUseCase,
  UpdatePropertyStatusUseCase,
  ListPropertiesQuery,
  GetPropertyDetailsQuery,
  CreatePropertyUnitUseCase,
  ListPropertyUnitsQuery,
  UpdateUnitStatusUseCase,
  SetOwnershipSplitsUseCase,
  GetOwnershipSplitsQuery,
  PropertyController,
  PropertyModule
} from '../../modules/property/index.js';

function createMockResponse() {
  const res: Partial<Response> & { _statusCode: number; _jsonData: any } = {
    _statusCode: 200,
    _jsonData: null,
    status(code: number) {
      this._statusCode = code;
      return this as Response;
    },
    json(data: any) {
      this._jsonData = data;
      return this as Response;
    }
  };
  return res as Response & { _statusCode: number; _jsonData: any };
}

describe('Sprint 11: Property Portfolio Domain Foundation — Units & Ownership Splits', () => {
  const TENANT_A = 'tenant-empire-01';
  const TENANT_B = 'tenant-metropolis-02';
  const OWNER_A = 'owner-john-101';
  const OWNER_B = 'owner-sarah-102';

  let repository: PostgresPropertyRepository;
  let eventBus: InMemoryEventBus;
  let createPropertyUseCase: CreatePropertyUseCase;
  let updatePropertyStatusUseCase: UpdatePropertyStatusUseCase;
  let listPropertiesQuery: ListPropertiesQuery;
  let getPropertyDetailsQuery: GetPropertyDetailsQuery;
  let createUnitUseCase: CreatePropertyUnitUseCase;
  let listUnitsQuery: ListPropertyUnitsQuery;
  let updateUnitStatusUseCase: UpdateUnitStatusUseCase;
  let setOwnershipSplitsUseCase: SetOwnershipSplitsUseCase;
  let getOwnershipSplitsQuery: GetOwnershipSplitsQuery;

  beforeEach(() => {
    repository = new PostgresPropertyRepository();
    eventBus = new InMemoryEventBus();

    createPropertyUseCase = new CreatePropertyUseCase(repository, eventBus);
    updatePropertyStatusUseCase = new UpdatePropertyStatusUseCase(repository, eventBus);
    listPropertiesQuery = new ListPropertiesQuery(repository);
    getPropertyDetailsQuery = new GetPropertyDetailsQuery(repository);

    createUnitUseCase = new CreatePropertyUnitUseCase(repository, eventBus);
    listUnitsQuery = new ListPropertyUnitsQuery(repository);
    updateUnitStatusUseCase = new UpdateUnitStatusUseCase(repository, eventBus);
    setOwnershipSplitsUseCase = new SetOwnershipSplitsUseCase(repository, eventBus);
    getOwnershipSplitsQuery = new GetOwnershipSplitsQuery(repository);
  });

  // ---------------------------------------------------------------------------
  // 1. MULTI-TENANT PROPERTY REGISTRATION & INVARIANTS
  // ---------------------------------------------------------------------------
  describe('1. Property Entity Invariants & Multi-Tenant Partitioning', () => {
    it('1.1 should register property with valid address, emergency float, and tenant attribution', async () => {
      const result = await createPropertyUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        title: 'Skyline Luxury Towers',
        description: 'Prime mixed-use residential tower in Downtown',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        address: {
          street: '100 Financial Way',
          city: 'Metropolis',
          state: 'NY',
          postalCode: '10001',
          country: 'USA'
        },
        areaSqFt: 55000,
        amenities: ['Concierge', 'Rooftop Pool', 'Valet'],
        emergencyContact: {
          name: 'Building Supervisor Alex',
          phone: '+1-555-0199',
          relationship: 'Facility Manager'
        },
        emergencyFloatLimit: 15000
      });

      expect(result.isSuccess).toBe(true);
      const dto = result.getValue();
      expect(dto.id).toBeDefined();
      expect(dto.tenantId).toBe(TENANT_A);
      expect(dto.ownerId).toBe(OWNER_A);
      expect(dto.status).toBe('VACANT');
      expect(dto.emergencyFloatLimit).toBe(15000);
      expect(dto.areaSqFt).toBe(55000);
    });

    it('1.2 should reject invalid property title, negative area, or missing address', () => {
      expect(() => {
        Property.create(
          OWNER_A,
          'A', // Too short
          'Description',
          'RESIDENTIAL',
          'APARTMENT',
          { street: 'Main St', city: 'City', state: 'ST', postalCode: '12345', country: 'USA' },
          1000,
          { name: 'Contact', phone: '+1234567890', relationship: 'Manager' }
        );
      }).toThrow('Property title must be at least 3 characters long');

      expect(() => {
        Property.create(
          OWNER_A,
          'Valid Title',
          'Description',
          'RESIDENTIAL',
          'APARTMENT',
          { street: 'Main St', city: 'City', state: 'ST', postalCode: '12345', country: 'USA' },
          -500, // Negative area
          { name: 'Contact', phone: '+1234567890', relationship: 'Manager' }
        );
      }).toThrow('Property area must be greater than zero');
    });

    it('1.3 should enforce state machine transitions and reject invalid state regressions', async () => {
      const created = await createPropertyUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        title: 'Transition Test Villa',
        description: 'Testing lifecycle',
        category: 'RESIDENTIAL',
        propertyType: 'VILLA',
        address: { street: 'Pine St', city: 'Suburb', state: 'CA', postalCode: '90210', country: 'USA' },
        areaSqFt: 3500,
        emergencyContact: { name: 'Support', phone: '+1555123456', relationship: 'Super' }
      });
      const propertyId = created.getValue().id;

      // Legitimate transition: VACANT -> RENTED
      const rented = await updatePropertyStatusUseCase.execute({
        propertyId,
        actorId: OWNER_A,
        status: 'RENTED',
        tenantId: TENANT_A
      });
      expect(rented.isSuccess).toBe(true);
      expect(rented.getValue().status).toBe('RENTED');

      // Illegal transition: RENTED -> LISTED_FOR_SALE (must become VACANT first)
      const invalidTransition = await updatePropertyStatusUseCase.execute({
        propertyId,
        actorId: OWNER_A,
        status: 'LISTED_FOR_SALE',
        tenantId: TENANT_A
      });
      expect(invalidTransition.isFailure).toBe(true);
      expect(invalidTransition.getError()).toBeInstanceOf(InvalidPropertyTransitionError);
    });

    it('1.4 should enforce fail-closed multi-tenant quarantine for properties', async () => {
      const propA = await createPropertyUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        title: 'Tenant A Secret Castle',
        description: 'Exclusively Tenant A',
        category: 'RESIDENTIAL',
        propertyType: 'VILLA',
        address: { street: 'Alpha Way', city: 'AlphaCity', state: 'AA', postalCode: '11111', country: 'USA' },
        areaSqFt: 10000,
        emergencyContact: { name: 'Alpha Agent', phone: '+1555111111', relationship: 'Agent' }
      });
      const propAId = propA.getValue().id;

      // Tenant B tries to fetch Tenant A's property -> NotFoundError
      const crossFetch = await getPropertyDetailsQuery.execute({
        propertyId: propAId,
        tenantId: TENANT_B
      });
      expect(crossFetch.isFailure).toBe(true);
      expect(crossFetch.getError()).toBeInstanceOf(NotFoundError);

      // Tenant A lists properties -> sees propA
      const listA = await listPropertiesQuery.execute({ tenantId: TENANT_A });
      expect(listA.isSuccess).toBe(true);
      expect(listA.getValue().some(p => p.id === propAId)).toBe(true);

      // Tenant B lists properties -> does not see propA
      const listB = await listPropertiesQuery.execute({ tenantId: TENANT_B });
      expect(listB.isSuccess).toBe(true);
      expect(listB.getValue().some(p => p.id === propAId)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. UNIT INVENTORIES & UNIT STATE TRANSITIONS
  // ---------------------------------------------------------------------------
  describe('2. Rentable Unit Inventory Management & Occupancy Lifecycle', () => {
    let propertyId: string;

    beforeEach(async () => {
      const prop = await createPropertyUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        title: 'Grand Horizon Complex',
        description: 'Multi-unit building',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        address: { street: 'Horizon Blvd', city: 'Coast', state: 'FL', postalCode: '33101', country: 'USA' },
        areaSqFt: 40000,
        emergencyContact: { name: 'Super', phone: '+1555333333', relationship: 'Super' }
      });
      propertyId = prop.getValue().id;
    });

    it('2.1 should create units linked to property with default VACANT status', async () => {
      const unit1 = await createUnitUseCase.execute({
        propertyId,
        unitNumber: 'Suite 101',
        floor: 1,
        rentAmount: 2500.00,
        depositAmount: 5000.00,
        areaSqFt: 850,
        tenantId: TENANT_A
      });

      const unit2 = await createUnitUseCase.execute({
        propertyId,
        unitNumber: 'Suite 102',
        floor: 1,
        rentAmount: 3200.00,
        depositAmount: 6400.00,
        areaSqFt: 1100,
        tenantId: TENANT_A
      });

      expect(unit1.isSuccess).toBe(true);
      expect(unit2.isSuccess).toBe(true);
      expect(unit1.getValue().status).toBe('VACANT');
      expect(unit1.getValue().unitNumber).toBe('Suite 101');
      expect(unit1.getValue().rentAmount).toBe(2500.00);

      const listRes = await listUnitsQuery.execute({ propertyId, tenantId: TENANT_A });
      expect(listRes.isSuccess).toBe(true);
      expect(listRes.getValue().length).toBe(2);
    });

    it('2.2 should transition unit status through VACANT -> RESERVED -> OCCUPIED -> VACANT', async () => {
      const unit = await createUnitUseCase.execute({
        propertyId,
        unitNumber: 'Penthouse A',
        floor: 20,
        rentAmount: 8000.00,
        areaSqFt: 2400,
        tenantId: TENANT_A
      });
      const unitId = unit.getValue().id;

      // 1. Reserve unit
      const resReserved = await updateUnitStatusUseCase.execute({
        unitId,
        status: 'RESERVED',
        tenantId: TENANT_A
      });
      expect(resReserved.isSuccess).toBe(true);
      expect(resReserved.getValue().status).toBe('RESERVED');

      // 2. Mark occupied upon lease execution
      const resOccupied = await updateUnitStatusUseCase.execute({
        unitId,
        status: 'OCCUPIED',
        tenantId: TENANT_A
      });
      expect(resOccupied.isSuccess).toBe(true);
      expect(resOccupied.getValue().status).toBe('OCCUPIED');

      // 3. Mark vacant upon move-out
      const resVacant = await updateUnitStatusUseCase.execute({
        unitId,
        status: 'VACANT',
        tenantId: TENANT_A
      });
      expect(resVacant.isSuccess).toBe(true);
      expect(resVacant.getValue().status).toBe('VACANT');
    });

    it('2.3 should reject illegal unit state regressions', async () => {
      const unit = await createUnitUseCase.execute({
        propertyId,
        unitNumber: 'Studio 3B',
        floor: 3,
        rentAmount: 1800.00,
        areaSqFt: 550,
        tenantId: TENANT_A
      });
      expect(unit.isSuccess).toBe(true);

      // Cannot transition directly from VACANT to illegal or undeclared state
      expect(() => {
        const domainUnit = PropertyUnit.create(propertyId, 'Studio 3B', 1800, 550);
        (domainUnit as any).updateStatus('NON_EXISTENT_STATE');
      }).toThrow();
    });

    it('2.4 should strictly isolate units across tenant boundaries', async () => {
      const unit = await createUnitUseCase.execute({
        propertyId,
        unitNumber: 'Unit 5A',
        floor: 5,
        rentAmount: 2100.00,
        areaSqFt: 750,
        tenantId: TENANT_A
      });
      const unitId = unit.getValue().id;

      // Tenant B tries to query Tenant A's units -> NotFoundError
      const crossList = await listUnitsQuery.execute({ propertyId, tenantId: TENANT_B });
      expect(crossList.isFailure).toBe(true);
      expect(crossList.getError()).toBeInstanceOf(NotFoundError);

      // Tenant B tries to update Tenant A's unit -> NotFoundError
      const crossUpdate = await updateUnitStatusUseCase.execute({
        unitId,
        status: 'OCCUPIED',
        tenantId: TENANT_B
      });
      expect(crossUpdate.isFailure).toBe(true);
      expect(crossUpdate.getError()).toBeInstanceOf(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. MULTI-OWNER EQUITY SPLITS & MATHEMATICAL INVARIANTS
  // ---------------------------------------------------------------------------
  describe('3. Multi-Owner Equity Splits & Exact 100% Invariant', () => {
    let propertyId: string;

    beforeEach(async () => {
      const prop = await createPropertyUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        title: 'Commercial Plaza One',
        description: 'Multi-stakeholder building',
        category: 'COMMERCIAL',
        propertyType: 'OFFICE_SPACE',
        address: { street: 'Plaza Drive', city: 'Denver', state: 'CO', postalCode: '80202', country: 'USA' },
        areaSqFt: 30000,
        emergencyContact: { name: 'Manager', phone: '+1555777777', relationship: 'Manager' }
      });
      propertyId = prop.getValue().id;
    });

    it('3.1 should successfully set multi-owner splits that sum to exactly 100.00%', async () => {
      const splitsInput = [
        { ownerId: OWNER_A, sharePercentage: 60.00, disbursementAccount: 'acc_john_primary' },
        { ownerId: OWNER_B, sharePercentage: 40.00, disbursementAccount: 'acc_sarah_primary' }
      ];

      const res = await setOwnershipSplitsUseCase.execute({
        propertyId,
        splits: splitsInput,
        tenantId: TENANT_A
      });

      expect(res.isSuccess).toBe(true);
      const splits = res.getValue();
      expect(splits.length).toBe(2);
      expect(splits[0]!.sharePercentage + splits[1]!.sharePercentage).toBe(100.00);

      // Query saved splits
      const getRes = await getOwnershipSplitsQuery.execute({ propertyId, tenantId: TENANT_A });
      expect(getRes.isSuccess).toBe(true);
      expect(getRes.getValue().length).toBe(2);
      expect(getRes.getValue()[0]?.sharePercentage).toBe(60.00);
      expect(getRes.getValue()[1]?.sharePercentage).toBe(40.00);
    });

    it('3.2 should reject ownership splits that sum to less than 100% with InvalidOwnershipSplitError', async () => {
      const invalidUnder = [
        { ownerId: OWNER_A, sharePercentage: 50.00 },
        { ownerId: OWNER_B, sharePercentage: 35.00 } // Total 85%
      ];

      const res = await setOwnershipSplitsUseCase.execute({
        propertyId,
        splits: invalidUnder,
        tenantId: TENANT_A
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(InvalidOwnershipSplitError);
      expect(res.getError().message).toContain('Total ownership split across all stakeholders must equal exactly 100%');
    });

    it('3.3 should reject ownership splits that sum to greater than 100% with InvalidOwnershipSplitError', async () => {
      const invalidOver = [
        { ownerId: OWNER_A, sharePercentage: 70.00 },
        { ownerId: OWNER_B, sharePercentage: 45.00 } // Total 115%
      ];

      const res = await setOwnershipSplitsUseCase.execute({
        propertyId,
        splits: invalidOver,
        tenantId: TENANT_A
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(InvalidOwnershipSplitError);
      expect(res.getError().message).toContain('Total ownership split across all stakeholders must equal exactly 100%');
    });

    it('3.4 should reject ownership splits with zero or negative shares', async () => {
      const invalidNegative = [
        { ownerId: OWNER_A, sharePercentage: 110.00 },
        { ownerId: OWNER_B, sharePercentage: -10.00 }
      ];

      const res = await setOwnershipSplitsUseCase.execute({
        propertyId,
        splits: invalidNegative,
        tenantId: TENANT_A
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(InvalidOwnershipSplitError);
    });

    it('3.5 should strictly isolate ownership splits across tenant boundaries', async () => {
      await setOwnershipSplitsUseCase.execute({
        propertyId,
        splits: [
          { ownerId: OWNER_A, sharePercentage: 100.00, disbursementAccount: 'confidential_acct' }
        ],
        tenantId: TENANT_A
      });

      // Tenant B tries to query Tenant A's ownership splits -> NotFoundError
      const crossGet = await getOwnershipSplitsQuery.execute({ propertyId, tenantId: TENANT_B });
      expect(crossGet.isFailure).toBe(true);
      expect(crossGet.getError()).toBeInstanceOf(NotFoundError);

      // Tenant B tries to overwrite Tenant A's ownership splits -> NotFoundError
      const crossSet = await setOwnershipSplitsUseCase.execute({
        propertyId,
        splits: [{ ownerId: 'hostile-owner', sharePercentage: 100.00 }],
        tenantId: TENANT_B
      });
      expect(crossSet.isFailure).toBe(true);
      expect(crossSet.getError()).toBeInstanceOf(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. PRESENTATION HTTP CONTROLLER BOUNDARY
  // ---------------------------------------------------------------------------
  describe('4. Presentation HTTP Boundary & Request Context', () => {
    let controller: PropertyController;

    beforeEach(() => {
      controller = new PropertyController(
        createPropertyUseCase,
        updatePropertyStatusUseCase,
        listPropertiesQuery,
        getPropertyDetailsQuery,
        createUnitUseCase,
        listUnitsQuery,
        updateUnitStatusUseCase,
        setOwnershipSplitsUseCase,
        getOwnershipSplitsQuery
      );
    });

    it('4.1 PropertyController should parse x-tenant-id and create property', async () => {
      const req = {
        headers: { 'x-tenant-id': TENANT_A },
        user: { id: OWNER_A, role: 'OWNER' },
        body: {
          title: 'Controller Park Residences',
          description: 'HTTP controller test property',
          category: 'RESIDENTIAL',
          propertyType: 'APARTMENT',
          address: { street: 'Park Ave', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' },
          areaSqFt: 12000,
          emergencyContact: { name: 'Manager', phone: '+1555444333', relationship: 'Manager' }
        }
      } as unknown as Request;
      const res = createMockResponse();

      await controller.create(req, res, () => {});

      expect(res._statusCode).toBe(201);
      expect(res._jsonData.success).toBe(true);
      expect(res._jsonData.data.tenantId).toBe(TENANT_A);
      expect(res._jsonData.data.title).toBe('Controller Park Residences');
    });

    it('4.2 PropertyController should manage units with tenant resolution', async () => {
      // First create property
      const propResult = await createPropertyUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        title: 'Controller Unit Tower',
        description: 'Building for unit tests',
        category: 'RESIDENTIAL',
        propertyType: 'APARTMENT',
        address: { street: 'Main', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' },
        areaSqFt: 15000,
        emergencyContact: { name: 'Contact', phone: '+1555444333', relationship: 'Manager' }
      });
      const propId = propResult.getValue().id;

      // Create Unit via Controller
      const reqUnit = {
        headers: { 'x-tenant-id': TENANT_A },
        params: { id: propId },
        body: {
          unitNumber: '101',
          floor: 1,
          rentAmount: 1950.00,
          depositAmount: 3900.00,
          areaSqFt: 720
        }
      } as unknown as Request;
      const resUnit = createMockResponse();

      await controller.createUnit(reqUnit, resUnit, () => {});
      expect(resUnit._statusCode).toBe(201);
      expect(resUnit._jsonData.data.unitNumber).toBe('101');
      expect(resUnit._jsonData.data.tenantId).toBe(TENANT_A);

      // List Units via Controller
      const reqList = {
        headers: { 'x-tenant-id': TENANT_A },
        params: { id: propId }
      } as unknown as Request;
      const resList = createMockResponse();

      await controller.listUnits(reqList, resList, () => {});
      expect(resList._statusCode).toBe(200);
      expect(resList._jsonData.data.length).toBe(1);
    });

    it('4.3 PropertyController should set and get ownership splits with 100% validation', async () => {
      const propResult = await createPropertyUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        title: 'Split Controller Complex',
        description: 'Building for split tests',
        category: 'COMMERCIAL',
        propertyType: 'RETAIL_SHOP',
        address: { street: 'Market St', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' },
        areaSqFt: 8000,
        emergencyContact: { name: 'Contact', phone: '+1555444333', relationship: 'Manager' }
      });
      const propId = propResult.getValue().id;

      // Set Splits
      const reqSplits = {
        headers: { 'x-tenant-id': TENANT_A },
        params: { id: propId },
        body: {
          splits: [
            { ownerId: OWNER_A, sharePercentage: 75.00, disbursementAccount: 'acct_primary' },
            { ownerId: OWNER_B, sharePercentage: 25.00, disbursementAccount: 'acct_partner' }
          ]
        }
      } as unknown as Request;
      const resSplits = createMockResponse();

      await controller.setOwnershipSplits(reqSplits, resSplits, () => {});
      expect(resSplits._statusCode).toBe(200);
      expect(resSplits._jsonData.data.length).toBe(2);

      // Get Splits
      const reqGet = {
        headers: { 'x-tenant-id': TENANT_A },
        params: { id: propId }
      } as unknown as Request;
      const resGet = createMockResponse();

      await controller.getOwnershipSplits(reqGet, resGet, () => {});
      expect(resGet._statusCode).toBe(200);
      expect(resGet._jsonData.data.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. PUBLIC API & CROSS-MODULE EVENT PROJECTION
  // ---------------------------------------------------------------------------
  describe('5. Public API Facade & Cross-Module Domain Event Projection', () => {
    it('5.1 PropertyModule publicApi should return property, units, and ownership splits', async () => {
      const { publicApi, repository } = PropertyModule.init();

      const property = Property.create(
        OWNER_A,
        'Public API Villa',
        'Villa description',
        'RESIDENTIAL',
        'VILLA',
        { street: 'Ocean Dr', city: 'Miami', state: 'FL', postalCode: '33139', country: 'USA' },
        5000,
        { name: 'Manager', phone: '+1555000111', relationship: 'Manager' },
        ['Pool'],
        7500,
        TENANT_A
      );
      await repository.save(property);

      const fetched = await publicApi.getPropertyById(property.id, TENANT_A);
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe('Public API Villa');
      expect(fetched?.tenantId).toBe(TENANT_A);

      const isOwner = await publicApi.verifyOwner(property.id, OWNER_A, TENANT_A);
      expect(isOwner).toBe(true);

      const floatLimit = await publicApi.getEmergencyFloatLimit(property.id, TENANT_A);
      expect(floatLimit).toBe(7500);

      // Tenant B query via public API -> null
      const crossFetch = await publicApi.getPropertyById(property.id, TENANT_B);
      expect(crossFetch).toBeNull();
    });

    it('5.2 should publish property.registered event upon property creation', async () => {
      let publishedEvent: any = null;
      eventBus.subscribe('property.registered', async (evt) => {
        publishedEvent = evt;
      });

      const res = await createPropertyUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        title: 'Event Broadcasting Estate',
        description: 'Should trigger domain event',
        category: 'RESIDENTIAL',
        propertyType: 'INDEPENDENT_HOUSE',
        address: { street: 'Event Way', city: 'Dallas', state: 'TX', postalCode: '75001', country: 'USA' },
        areaSqFt: 6200,
        emergencyContact: { name: 'Manager', phone: '+1555999888', relationship: 'Manager' }
      });

      expect(res.isSuccess).toBe(true);
      expect(publishedEvent).not.toBeNull();
      expect(publishedEvent.eventName).toBe('property.registered');
      expect(publishedEvent.payload.title).toBe('Event Broadcasting Estate');
      expect(publishedEvent.payload.tenantId).toBe(TENANT_A);
    });
  });
});
