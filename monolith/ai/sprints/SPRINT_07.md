# Sprint 07: Multi-Tenant Inventory Ledger, Optimistic Concurrency & Stock Reservations

**Sprint ID:** `SPRINT_07`  
**Theme:** Reusable Capabilities — Multi-Tenant Stock Management, Atomic Reservations, Optimistic Locking & Audit Logs  
**Status:** `READY FOR IMPLEMENTATION / ACTIVE OBJECTIVE`  
**Prerequisites:** Sprint 00 (Architecture Baseline), Sprint 01 (Database Engine), Sprint 02 (Identity & Cryptography), Sprint 03 (Multi-Tenant Organizations), Sprint 04 (Dynamic RBAC & Scoped Auth), Sprint 05 (Asset Management Foundation), Sprint 06 (Cloud Storage Adapters)  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 07 matures the reusable **Inventory Management** capability (`apps/api/src/modules/inventory`). In the Real Estate CareTaking domain, inventory tracks spare parts, maintenance supplies (plumbing fixtures, electrical breakers, paint buckets, water pumps), staging furniture, and lockbox keys across tenant organizations and managed property facilities.

This sprint enhances the inventory engine with:
1. Strict multi-tenant data partitioning (`tenant_id`) ensuring Organization A cannot reserve, adjust, or view Organization B's stock items.
2. Optimistic concurrency control (version column) to eliminate race conditions under concurrent reservation attempts.
3. Two-phase reservation lifecycle (`RESERVED` -> `COMMITTED` or `RELEASED`) with order correlation.
4. Comprehensive unit and domain test suite verifying zero-stock guards, atomic rollbacks, and tenant isolation.

---

## 2. Concrete Objectives & Scope

### 2.1 Multi-Tenant Schema & Domain Entity
- Extend `inventory.stock_items` with `tenant_id` and `version` columns.
- Enforce invariant: `availableQuantity = totalQuantity - reservedQuantity` must always remain $\ge 0$.

### 2.2 Atomic Reservation & Release Use Cases
- `ReserveStockUseCase`: Atomically allocates stock for maintenance work orders or property staging with concurrency version checks.
- `ReleaseStockUseCase`: Releases held reservation back to available pool on cancellation or expiration.
- `CommitStockUseCase`: Permanently debits reserved stock when physical parts are dispatched/installed.

### 2.3 Presentation Boundary & Tenant Context Enforcement
- REST endpoints under `/api/inventory`:
  - `POST /api/inventory/items`: Create stock item with SKU, initial quantity, and tenant binding.
  - `GET /api/inventory/items`: Paginated listing of tenant inventory.
  - `POST /api/inventory/reserve`: Atomically reserve items with tenant boundary checks.
  - `POST /api/inventory/release`: Release reserved items.
  - `POST /api/inventory/commit`: Commit reserved items to consumed state.

---

## 3. Acceptance Criteria & Verifiable Gate

1. **Multi-Tenant Quarantine**: Tenant B cannot query, reserve, or adjust items owned by Tenant A (403 Forbidden / 404 Not Found).
2. **Stock Invariant Enforcement**: Reserving quantity exceeding `availableQuantity` is rejected with 400 Bad Request.
3. **Atomic Concurrency Invariant**: Concurrent reservations on the same SKU handle race conditions gracefully via optimistic concurrency version checks.
4. **Reservation State Lifecycle**: `RESERVE` decrements available and increments reserved; `RELEASE` returns quantity to available; `COMMIT` permanently decrements both reserved and total.
5. **Clean Architecture Guard**: `pnpm test:arch` passes with 0 violations.
6. **Automated Test Suite**: Dedicated unit test suite with 100% pass rate.
