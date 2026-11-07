# Sprint 11: Property Portfolio Domain Foundation — Units, Floorplans, Pricing Matrices & Ownership Splits

**Sprint ID:** `SPRINT_11`  
**Theme:** Core Property Domain — Multi-Tenant Property Registry, Unit Inventories, Dynamic Pricing Matrices & Multi-Owner Equity Splits  
**Status:** `READY FOR IMPLEMENTATION / ACTIVE OBJECTIVE`  
**Prerequisites:** Sprints 00 through 10  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 11 initiates the platform's core **Property Portfolio Domain (`apps/api/src/modules/property`)**:
1. **Multi-Tenant Property Portfolio**: Enforce strict `tenant_id` isolation across property assets with Address Value Objects, building categories (COMMERCIAL, RESIDENTIAL, INDUSTRIAL, MIXED_USE), and emergency float allocations.
2. **Unit & Floorplan Inventory Management**: Sub-divide properties into rentable Units with real-time occupancy status (`VACANT`, `OCCUPIED`, `UNDER_MAINTENANCE`, `RESERVED`) linked to standardized architectural Floorplans.
3. **Dynamic Pricing Matrices**: Model rate schedules with seasonal multipliers, minimum lease terms, security deposit rules, and base rental pricing with mathematical precision.
4. **Multi-Owner Split Allocation Ledgers**: Manage fractional and multi-owner equity allocations with mathematical invariants (all ownership shares per property must sum exactly to 100.00% without floating-point drift).

---

## 2. Concrete Objectives & Implementation Scope

### 2.1 Multi-Tenant Schema & Database Migration
- Create migration `013_property_portfolio_multitenancy.sql`:
  - `property.properties`: Add `tenant_id VARCHAR(64)` with compound indexes `(tenant_id, created_at DESC)` and `(tenant_id, status)`.
  - `property.units`: Table for individual rentable units (`id`, `property_id`, `tenant_id`, `unit_number`, `floor`, `status`, `rent_amount`, `deposit_amount`, `sq_ft`).
  - `property.floorplans`: Table for floorplan configurations (`id`, `property_id`, `tenant_id`, `name`, `bedrooms`, `bathrooms`, `area_sq_ft`, `base_rent`).
  - `property.pricing_matrices`: Table for dynamic pricing models (`id`, `property_id`, `tenant_id`, `season_name`, `multiplier`, `effective_from`, `effective_to`).
  - `property.ownership_splits`: Table for equity stakeholder percentages (`id`, `property_id`, `tenant_id`, `owner_id`, `share_percentage`, `disbursement_account`).

### 2.2 Shared Domain Contracts (`packages/contracts`)
- Define DTOs in `@monolith/contracts/property`:
  - `PropertyDto`, `CreatePropertyRequestDto`, `UpdatePropertyStatusRequestDto` (with `tenantId`).
  - `PropertyUnitDto`, `CreatePropertyUnitRequestDto`, `UnitStatus` (`VACANT`, `OCCUPIED`, `UNDER_MAINTENANCE`, `RESERVED`).
  - `FloorplanDto`, `CreateFloorplanRequestDto`.
  - `PricingMatrixDto`, `CreatePricingMatrixRequestDto`.
  - `OwnershipSplitDto`, `CreateOwnershipSplitRequestDto`, `SetOwnershipSplitsRequestDto`.
  - Domain integration events: `PropertyCreatedEvent`, `PropertyVerifiedEvent`, `UnitStatusChangedEvent`.

### 2.3 Property Domain Hardening
- Update `Property` entity:
  - Add `tenantId`, validate non-empty title/address, positive area.
  - Implement ownership split invariant: `validateOwnershipSplits()` asserting $\sum \text{shares} = 100.00\%$.
  - State machine lifecycle (`DRAFT` -> `UNDER_VERIFICATION` -> `VERIFIED` -> `ACTIVE` -> `INACTIVE`).
- Implement `Unit` entity and `Floorplan` entity.

### 2.4 Application & Persistence Layer
- Update `IPropertyRepository` with tenant filtering:
  - `findById(id: string, tenantId?: string): Promise<Property | null>`
  - `findAll(filter?: PropertyFilter): Promise<Property[]>`
  - `save(property: Property): Promise<void>`
  - `addUnit(unit: PropertyUnit): Promise<void>`
  - `findUnitsByProperty(propertyId: string, tenantId?: string): Promise<PropertyUnit[]>`
  - `setOwnershipSplits(propertyId: string, splits: OwnershipSplit[], tenantId?: string): Promise<void>`
  - `getOwnershipSplits(propertyId: string, tenantId?: string): Promise<OwnershipSplit[]>`
- Implement use cases:
  - `CreatePropertyUseCase`, `GetPropertyDetailsQuery`, `ListPropertiesQuery`, `UpdatePropertyStatusUseCase`.
  - `CreatePropertyUnitUseCase`, `ListPropertyUnitsQuery`, `UpdateUnitStatusUseCase`.
  - `SetOwnershipSplitsUseCase`, `GetOwnershipSplitsQuery`.

### 2.5 Presentation Layer & Event Projections
- Update `PropertyController` and `property.routes.ts`:
  - Extract `tenantId` via `x-tenant-id` header or auth token.
  - REST endpoints under `/api/properties`.
- Asynchronous integration:
  - Publish `property.registered` and `property.verified` domain events.
  - Listen in `SearchModule` to index properties automatically.

---

## 3. Acceptance Criteria & Verifiable Gate

1. **Multi-Tenant Quarantine**: Tenant B cannot view, modify, or list Tenant A's properties, units, or ownership splits.
2. **Ownership Split Mathematical Invariant**: Equity split assignments rejecting if total sum $\ne 100.00\%$.
3. **Unit State Lifecycle**: Valid transitions (`VACANT` -> `OCCUPIED` -> `UNDER_MAINTENANCE` -> `VACANT`).
4. **Search Integration**: New properties are projected to the full-text search index under the respective `tenant_id`.
5. **Clean Architecture Guard**: `pnpm test:arch` passes with 0 violations.
6. **Automated Test Suite**: Dedicated unit test suite (`apps/api/src/tests/unit/property-portfolio.test.ts`) with 100% pass rate.
