# Sprint 07: Multi-Tenant Inventory Ledger, Optimistic Concurrency & Stock Reservations

**Sprint ID:** `SPRINT_07`  
**Theme:** Reusable Capabilities — Multi-Tenant Stock Management, Atomic Reservations, Optimistic Locking & Audit Logs  
**Status:** `COMPLETED & VERIFIED`  
**Prerequisites:** Sprint 00 (Architecture Baseline), Sprint 01 (Database Engine), Sprint 02 (Identity & Cryptography), Sprint 03 (Multi-Tenant Organizations), Sprint 04 (Dynamic RBAC & Scoped Auth), Sprint 05 (Asset Management Foundation), Sprint 06 (Cloud Storage Adapters)  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 07 matures the reusable **Inventory Management** capability (`apps/api/src/modules/inventory`). In the Real Estate CareTaking domain, inventory tracks spare parts, maintenance supplies (plumbing fixtures, electrical breakers, paint buckets, water pumps), staging furniture, and lockbox keys across tenant organizations and managed property facilities.

This sprint enhances the inventory engine with:
1. Strict multi-tenant data partitioning (`tenant_id`) ensuring Organization A cannot reserve, adjust, or view Organization B's stock items.
2. Optimistic concurrency control (`version` column) to eliminate race conditions under concurrent reservation attempts.
3. Two-phase reservation lifecycle (`RESERVE` -> `COMMIT` or `RELEASE`) with order correlation.
4. Comprehensive unit and domain test suite verifying zero-stock guards, atomic rollbacks, and tenant isolation.

---

## 2. Concrete Objectives & Scope

### 2.1 Multi-Tenant Schema & Domain Entity
- Database migration `009_inventory_multitenancy_and_concurrency.sql`:
  - Added `tenant_id`, `name`, `category`, and `version` columns to `inventory.inventory_items`.
  - Compound unique constraint on `(tenant_id, sku)`.
  - Created `inventory.inventory_reservations` audit table.
- Extended domain entity `InventoryItem`:
  - Maintained mathematical equilibrium invariant: `availableQuantity = totalQuantity - reservedQuantity >= 0`.
  - Supported `reserve(quantity, expectedVersion)`, `release(quantity)`, `commit(quantity)`, and `adjustStock(newTotalQuantity)`.
  - Increments `version` atomically on each mutation.

### 2.2 Atomic Reservation & Release Use Cases
- `CreateInventoryItemUseCase`: Creates stock item with tenant scoping and duplicate SKU checks.
- `ListInventoryQuery`: Paginated/scoped listing of tenant stock items.
- `GetInventoryItemQuery`: Returns single stock item with tenant boundary validation.
- `ReserveStockUseCase`: Allocates stock with optimistic concurrency version guard, returning `ConflictError` on stale write attempts.
- `ReleaseStockUseCase`: Releases held reservation back to available pool.
- `CommitStockUseCase`: Permanently debits reserved stock upon physical dispatch.

### 2.3 Presentation Boundary & Tenant Context Enforcement
- REST endpoints under `/api/inventory`:
  - `POST /api/inventory/items`: Create stock item with SKU, initial quantity, and tenant binding.
  - `GET /api/inventory/items`: Paginated listing of tenant inventory.
  - `GET /api/inventory/items/:productId`: Retrieve single item by ID for calling tenant.
  - `POST /api/inventory/reserve`: Atomically reserve items with tenant boundary and version check.
  - `POST /api/inventory/release`: Release reserved items.
  - `POST /api/inventory/commit`: Commit reserved items to consumed state.

---

## 3. Acceptance Criteria & Verifiable Gate

1. **Multi-Tenant Quarantine**: Tenant B cannot query, reserve, or adjust items owned by Tenant A (NotFoundError quarantined lookup). `PASSED`
2. **Stock Invariant Enforcement**: Reserving quantity exceeding `availableQuantity` is rejected with `InsufficientStockError` / `ConflictError`. `PASSED`
3. **Atomic Concurrency Invariant**: Concurrent reservations on the same SKU handle race conditions gracefully via optimistic concurrency version checks. `PASSED`
4. **Reservation State Lifecycle**: `RESERVE` decrements available and increments reserved; `RELEASE` returns quantity to available; `COMMIT` permanently debits both reserved and total. `PASSED`
5. **Clean Architecture Guard**: `pnpm test:arch` passes with 0 violations. `PASSED`
6. **Automated Test Suite**: Dedicated unit test suite `apps/api/src/tests/unit/inventory-concurrency.test.ts` with 100% pass rate (18/18 tests passing). `PASSED`

---

## 4. Verification & Execution Evidence

- **Automated Unit Tests**: `apps/api/src/tests/unit/inventory-concurrency.test.ts`
  - Total Tests: 18 passed / 18 total (100% pass rate).
  - Test suites verified:
    - 1. Domain Invariants & Mathematical Equilibrium (8/8 tests passed)
    - 2. Multi-Tenant Data Quarantine & Boundary Isolation (4/4 tests passed)
    - 3. Optimistic Concurrency Control (Version Guards) (3/3 tests passed)
    - 4. Presentation Boundary & Controller Integration (2/2 tests passed)
    - 5. InventoryModule Public API Integration (1/1 test passed)
- **Architecture Static Analysis**: `pnpm test:arch`
  - 3/3 passed (Strict module isolation, clean domain layer, public entry points).
- **TypeScript Typecheck**: `pnpm typecheck`
  - 0 errors across `@monolith/contracts`, `@monolith/api`, and `@monolith/web`.
- **Production Bundling**: `pnpm build`
  - Clean builds for `@monolith/contracts`, `@monolith/api`, and `@monolith/web`.
