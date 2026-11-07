# Sprint 11: Property Portfolio Domain Foundation — Units, Floorplans, Pricing Matrices & Ownership Splits

**Sprint ID:** `SPRINT_11`  
**Theme:** Core Property Domain — Multi-Tenant Property Registry, Unit Inventories, Dynamic Pricing Matrices & Multi-Owner Equity Splits  
**Status:** `COMPLETED & VERIFIED`  
**Prerequisites:** Sprints 00 through 10  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 11 initiated the platform's core **Property Portfolio Domain (`apps/api/src/modules/property`)**:
1. **Multi-Tenant Property Portfolio**: Enforced strict `tenant_id` isolation across property assets with Address Value Objects, building categories (COMMERCIAL, RESIDENTIAL, INDUSTRIAL, MIXED_USE), emergency float limits, and state machine transitions.
2. **Unit & Floorplan Inventory Management**: Sub-divided properties into rentable Units with real-time occupancy status (`VACANT`, `OCCUPIED`, `UNDER_MAINTENANCE`, `RESERVED`) linked to standardized architectural Floorplans.
3. **Dynamic Pricing Matrices**: Modeled rate schedules with seasonal multipliers, minimum lease terms, security deposit rules, and base rental pricing with mathematical precision.
4. **Multi-Owner Split Allocation Ledgers**: Managed fractional and multi-owner equity allocations with mathematical invariants (all ownership shares per property must sum exactly to 100.00% without floating-point drift).

---

## 2. Concrete Objectives & Implementation Summary

### 2.1 Multi-Tenant Schema & Database Migration
- Created migration `013_property_portfolio_multitenancy.sql`:
  - `property.properties`: Added `tenant_id VARCHAR(64)` with compound indexes `(tenant_id, created_at DESC)` and `(tenant_id, status)`.
  - `property.units`: Created table for individual rentable units (`id`, `property_id`, `tenant_id`, `unit_number`, `floor`, `status`, `rent_amount`, `deposit_amount`, `area_sq_ft`). Unique constraint on `(property_id, unit_number)`.
  - `property.floorplans`: Created table for floorplan configurations (`id`, `property_id`, `tenant_id`, `name`, `bedrooms`, `bathrooms`, `area_sq_ft`, `base_rent`).
  - `property.pricing_matrices`: Created table for dynamic pricing models (`id`, `property_id`, `tenant_id`, `season_name`, `multiplier`, `effective_from`, `effective_to`).
  - `property.ownership_splits`: Created table for equity stakeholder percentages (`id`, `property_id`, `tenant_id`, `owner_id`, `share_percentage`, `disbursement_account`).

### 2.2 Shared Domain Contracts (`packages/contracts`)
- Defined DTOs in `@monolith/contracts/property`:
  - `PropertyDto`, `CreatePropertyRequestDto`, `UpdatePropertyStatusRequestDto` (with `tenantId`).
  - `PropertyUnitDto`, `CreatePropertyUnitRequestDto`, `UpdateUnitStatusRequestDto`, `UnitStatus`.
  - `FloorplanDto`, `CreateFloorplanRequestDto`.
  - `PricingMatrixDto`, `CreatePricingMatrixRequestDto`.
  - `OwnershipSplitDto`, `SetOwnershipSplitsRequestDto`.
  - Domain integration events: `PropertyCreatedEvent`, `PropertyStatusChangedEvent`, `UnitStatusChangedEvent`, `OwnershipSplitsUpdatedEvent`.

### 2.3 Property Domain Hardening
- Enhanced `Property` aggregate:
  - Added `tenantId`, validated non-empty title/address, positive area.
  - Implemented ownership split invariant: `validateOwnershipSplits()` asserting $\sum \text{shares} = 100.00\%$ and throwing `InvalidOwnershipSplitError` on deviations.
  - State machine lifecycle (`VACANT` -> `RENTED` -> `UNDER_MAINTENANCE` -> `LISTED_FOR_RENT` | `LISTED_FOR_SALE`).
- Implemented `PropertyUnit` aggregate with unit state transitions (`VACANT` -> `RESERVED` -> `OCCUPIED` -> `VACANT` / `UNDER_MAINTENANCE`) and `InvalidUnitTransitionError`.
- Implemented `OwnershipSplit` aggregate.

### 2.4 Application & Persistence Layer
- Updated `IPropertyRepository` and `PostgresPropertyRepository` with multi-tenant filtering and snapshot cloning across in-memory fallback stores.
- Implemented use cases:
  - `CreatePropertyUseCase`, `GetPropertyDetailsQuery`, `ListPropertiesQuery`, `UpdatePropertyStatusUseCase`.
  - `CreatePropertyUnitUseCase`, `ListPropertyUnitsQuery`, `UpdateUnitStatusUseCase`.
  - `SetOwnershipSplitsUseCase`, `GetOwnershipSplitsQuery`.

### 2.5 Presentation Layer & Event Projections
- Updated `PropertyController` and `property.routes.ts`:
  - Extracted `tenantId` via `x-tenant-id` header or auth token.
  - Endpoints: `POST /api/properties`, `GET /api/properties`, `GET /api/properties/:id`, `PATCH /api/properties/:id/status`, `POST /api/properties/:id/units`, `GET /api/properties/:id/units`, `PATCH /api/properties/units/:unitId/status`, `POST /api/properties/:id/ownership-splits`, `GET /api/properties/:id/ownership-splits`.
- Published `property.registered` domain integration event upon property creation.

---

## 3. Acceptance Criteria & Verifiable Gate

| Metric / Requirement | Target | Achieved | Status |
| :--- | :--- | :--- | :--- |
| **Multi-Tenant Quarantine** | Fail-closed isolation across properties, units, and splits | Verified (Cross-tenant 404 / empty listings) | **PASS** |
| **Ownership Split Mathematical Invariant** | Total share must sum to exactly 100.00% | Verified (`InvalidOwnershipSplitError` on 85%, 115%, negative shares) | **PASS** |
| **Unit State Lifecycle** | VACANT -> RESERVED -> OCCUPIED -> VACANT | Verified with transition guards | **PASS** |
| **Clean Architecture AST** | 0 violations (`pnpm test:arch`) | 3/3 tests passed, 0 violations | **PASS** |
| **Automated Unit Tests** | Dedicated unit test suite | 18/18 passed (`property-portfolio.test.ts`) | **PASS** |
| **Cumulative Regression** | All core capabilities green | 120/120 passed across 6 test suites | **PASS** |
| **Production Build** | Clean build for contracts, api, web | 0 TypeScript errors, 100% build pass | **PASS** |

---

## 4. Verification Evidence

- **Unit Test Execution:**
  ```text
  ✓ src/tests/unit/property-portfolio.test.ts (18 tests) 45ms
  Test Files  1 passed (1)
  Tests       18 passed (18)
  ```
- **Cumulative Regression Execution:**
  ```text
  Test Files  6 passed (6)
  Tests       120 passed (120)
  Duration    1.03s
  ```
- **Architecture Enforcement:**
  ```text
  ✓ Modular Monolith Architecture Enforcement > Strict Module Isolation: No module may import another module's internal files 35ms
  ✓ Modular Monolith Architecture Enforcement > Clean Architecture: Domain layer must NEVER depend on Express, pg, or HTTP presentation 2ms
  ✓ Modular Monolith Architecture Enforcement > All business modules must expose a public index.ts entry point 0ms
  Test Files  1 passed (1)
  Tests       3 passed (3)
  ```
