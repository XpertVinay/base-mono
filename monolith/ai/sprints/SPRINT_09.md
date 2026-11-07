# Sprint 09: Multi-Gateway Payment Routing, Webhook Idempotency & Transaction Ledgers

**Sprint ID:** `SPRINT_09`  
**Theme:** Reusable Capabilities — Multi-Tenant Transactions, Dynamic Payment Routing, Webhook Signature Verification & Idempotency  
**Status:** `READY FOR IMPLEMENTATION / ACTIVE OBJECTIVE`  
**Prerequisites:** Sprint 00 (Architecture Baseline), Sprint 01 (Database Engine), Sprint 02 (Identity & Cryptography), Sprint 03 (Multi-Tenant Organizations), Sprint 04 (Dynamic RBAC & Scoped Auth), Sprint 05 (Asset Management Foundation), Sprint 06 (Cloud Storage Adapters), Sprint 07 (Multi-Tenant Inventory & Concurrency), Sprint 08 (Multi-Tenant Order Processing)  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 09 delivers the reusable **Transaction & Payment Processing** capability (`apps/api/src/modules/transaction`). In the Real Estate CareTaking platform, transactions process caretaker security deposits, owner emergency repair escrow contributions, maintenance invoice settlements, contractor payouts, and work order procurement kits.

This sprint enhances the payment and ledger engine with:
1. **Multi-Tenant Transaction Ledgers**: Add `tenant_id` scoping to `transactions.transactions` ensuring financial ledgers, audit trails, and payment records remain quarantined within organizational boundaries.
2. **Multi-Gateway Routing**: Decoupled payment gateway adapters (Stripe, Razorpay, PayPal, Mock) supporting dynamic tenant provider selection and hosted redirect sessions.
3. **Webhook Idempotency & Replay Defense**: Cryptographic webhook signature verification and an append-only idempotent webhook event ledger (`transactions.webhook_events`) to safely eliminate duplicate delivery and race conditions.
4. **State Machine Lifecycle & Domain Events**: Strict state machine transitions (`PENDING` -> `SUCCESS` | `FAILED` | `REFUNDED`), dispatching `transactions.completed` integration events to automatically settle linked orders and escrow deposits.
5. **Multi-Tenant Quarantine**: Fail-closed API endpoints ensuring tenants can only access, verify, or refund their own transactions.

---

## 2. Concrete Objectives & Scope

### 2.1 Multi-Tenant Schema & Domain Entities
- Migration `011_transaction_multitenancy_and_idempotency.sql`:
  - Add `tenant_id` column to `transactions.transactions`.
  - Create `transactions.webhook_events` table (`id`, `tenant_id`, `provider`, `event_id`, `payload`, `processed_at`, `status`).
  - Compound indexes on `(tenant_id, created_at)` and `(tenant_id, reference_id)`.
  - Unique constraint on `(provider, event_id)` for global replay protection.
- Update `Transaction` domain aggregate with `tenantId` and state machine guards.

### 2.2 Payment Gateway Port & Adapters
- Gateway port `IPaymentGateway` with tenant context:
  - `initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>`
  - `verifyWebhookSignature(payload: string, signature: string, secret: string): boolean`
  - `processWebhook(payload: any): Promise<WebhookResult>`
- Adapters:
  - `StripePaymentGatewayAdapter` with HMAC-SHA256 signature verification.
  - `RazorpayPaymentGatewayAdapter` with HMAC-SHA256 signature verification.
  - `MockPaymentGatewayAdapter` for deterministic offline testing.
- `DynamicPaymentGatewayRouter` with fallback and tenant provider resolution.

### 2.3 Webhook Idempotency & Replay Defense
- `ProcessWebhookUseCase`:
  - Verifies cryptographic signature before parsing payload.
  - Checks `transactions.webhook_events` for existing `(provider, event_id)`.
  - Atomically marks event as processed and updates transaction state.
  - Emits `transactions.completed` domain integration event on success.

### 2.4 Presentation Boundary & API Endpoints
- REST endpoints under `/api/transactions`:
  - `POST /api/transactions/initiate`: Initiate payment session with gateway routing under tenant context.
  - `GET /api/transactions/:id`: Retrieve transaction details with tenant boundary verification.
  - `GET /api/transactions`: Paginated list of tenant transactions.
  - `POST /api/transactions/webhooks/:provider`: Public webhook ingress endpoint with signature verification and replay defense.
  - `POST /api/transactions/:id/refund`: Refund transaction with tenant ownership check.

---

## 3. Acceptance Criteria & Verifiable Gate

1. **Multi-Tenant Quarantine**: Tenant B cannot inspect or refund transactions belonging to Tenant A (404/403).
2. **Cryptographic Webhook Verification**: Invalid webhook signatures are rejected with 401 Unauthorized / 400 Bad Request.
3. **Webhook Idempotency**: Duplicate webhook payloads with identical `event_id` are acknowledged with 200 OK but processed exactly once without double-crediting or duplicate domain events.
4. **Order Settlement Linkage**: Successful transaction completion dispatches `transactions.completed`, transitioning linked orders to `PAID`.
5. **Clean Architecture Guard**: `pnpm test:arch` passes with 0 violations.
6. **Automated Test Suite**: Dedicated unit test suite (`src/tests/unit/transaction-processing.test.ts`) with 100% pass rate.
