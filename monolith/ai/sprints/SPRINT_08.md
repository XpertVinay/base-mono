# Sprint 08: Multi-Tenant Order Processing, Pricing Invariants & Inventory Reservation Linkage

**Sprint ID:** `SPRINT_08`  
**Theme:** Reusable Capabilities — Multi-Tenant Orders, State Machine Lifecycle, Pricing Calculation & Inventory Reservation Linkage  
**Status:** `READY FOR IMPLEMENTATION / ACTIVE OBJECTIVE`  
**Prerequisites:** Sprint 00 (Architecture Baseline), Sprint 01 (Database Engine), Sprint 02 (Identity & Cryptography), Sprint 03 (Multi-Tenant Organizations), Sprint 04 (Dynamic RBAC & Scoped Auth), Sprint 05 (Asset Management Foundation), Sprint 06 (Cloud Storage Adapters), Sprint 07 (Multi-Tenant Inventory & Concurrency)  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 08 develops the reusable **Order Management** capability (`apps/api/src/modules/order`). In the Real Estate CareTaking domain, orders represent work order line items (parts procurement, contractor supply kits, lock replacement packages, and maintenance toolkits) linked to maintenance jobs and caretaker tasks.

This sprint enhances the order engine with:
1. Multi-tenant order persistence (`tenant_id`) ensuring orders and line items remain isolated within tenant organization boundaries.
2. State machine lifecycle transitions (`PENDING` -> `RESERVED` -> `PAID` -> `FULFILLED` / `CANCELLED`).
3. Strict pricing and monetary calculation invariants (non-negative line item amounts, correct subtotal/tax/discount aggregation).
4. Cross-module integration with the newly hardened `InventoryModule` to atomically hold and release stock reservations during the order lifecycle.
5. Automated test suite verifying order states, multi-tenant isolation, inventory reservation linkage, and presentation boundary guards.

---

## 2. Concrete Objectives & Scope

### 2.1 Multi-Tenant Schema & Domain Entities
- Add `tenant_id` to `order.orders` and `order.order_items`.
- Model state machine transitions with explicit validation:
  - Allowed transitions:
    - `PENDING` -> `RESERVED`
    - `RESERVED` -> `PAID`
    - `PAID` -> `FULFILLED`
    - `PENDING` or `RESERVED` -> `CANCELLED`
  - Rejection of invalid transitions (e.g. `FULFILLED` -> `PENDING`).

### 2.2 Monetary & Pricing Invariants
- Each line item has unit price, quantity, and total.
- Order total must equal sum of line items + tax - discount ($\ge 0$).

### 2.3 Inventory Reservation Integration
- When an order is created with inventory line items, the order coordinates with `IInventoryModulePublicApi.reserve` using the order ID.
- If order is cancelled, coordinates `IInventoryModulePublicApi.release`.
- When order is fulfilled, coordinates `IInventoryModulePublicApi.commit`.

### 2.4 Presentation Boundary & API Endpoints
- REST endpoints under `/api/orders`:
  - `POST /api/orders`: Create order with items and initiate inventory reservation under tenant context.
  - `GET /api/orders`: Paginated list of tenant orders.
  - `GET /api/orders/:id`: Get order details with tenant boundary verification.
  - `POST /api/orders/:id/cancel`: Cancel order and release reservations.
  - `POST /api/orders/:id/fulfill`: Fulfill order and commit inventory.

---

## 3. Acceptance Criteria & Verifiable Gate

1. **Multi-Tenant Quarantine**: Tenant B cannot retrieve, cancel, or fulfill orders belonging to Tenant A (404/403).
2. **Pricing Invariant**: Order totals correctly match line item sums with zero rounding errors or negative values.
3. **State Machine Invariant**: Invalid state transitions are rejected with 400 Bad Request / 409 Conflict.
4. **Inventory Reservation Linkage**: Order placement reserves stock; cancellation releases stock; fulfillment commits stock.
5. **Clean Architecture Guard**: `pnpm test:arch` passes with 0 violations.
6. **Automated Test Suite**: Dedicated unit test suite with 100% pass rate.
