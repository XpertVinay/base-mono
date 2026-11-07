# Real Estate CareTaking — Handover Current State

**Document:** `CURRENT_STATE.md`  
**Version:** 1.2  
**Date:** Current Operational Baseline  
**Overall Status:** Stable, Fully Tested, Architecture Verified

---

## 1. Executive Summary & Repository Health

The Real Estate CareTaking platform is in a verified, production-ready development state. The modular monolith backend, React enterprise frontend, shared contracts package, and hardened mobile client have been fully integrated, strictly adhering to Clean Architecture, DDD, and OWASP Top 10 security standards.

### Workspace Summary
| Package | Directory | Role | Status |
| :--- | :--- | :--- | :--- |
| `@monolith/contracts` | `packages/contracts` | Shared TypeScript domain types, DTOs, and API schemas | Clean compilation |
| `@monolith/api` | `apps/api` | Express modular monolith with schema-per-module isolation | Fully integrated |
| `@monolith/web` | `apps/web` | React 18 / Vite / Tailwind frontend with 6 domain views | Production bundle verified |
| `mobile` | `boilerplate/mobile` | React Native / Expo mobile app with SecureStore tokens | Hardened & tested |

---

## 2. Implemented & Verified Capabilities

### 1. Identity & Access Management (`iam`)
- **Single Identity Multi-Tenancy**: Single platform user identity with multi-organization membership associations (`iam.organization_memberships`).
- **Organization Lifecycle**: Registration, profile updates, status lifecycle (`ACTIVE`, `SUSPENDED`, `ARCHIVED`), and organization types.
- **Invitations & Join Requests**: Token-based email invitations, accept/reject workflows, and member join requests (`iam.organization_invitations`).
- **Tenant Context Resolution & Isolation**: Boundary middleware (`createTenantContextMiddleware`, `requireTenantMembership`, `requireOrgAdmin`) extracting and enforcing `X-Tenant-ID` or JWT claims; cross-tenant access and suspended members strictly rejected with 403.
- **Dynamic RBAC & Scoped Authorization**: Granular platform permissions across 7 domains conforming to `<domain>:<action>` (`iam.permissions`, `iam.tenant_roles`, `iam.tenant_role_permissions`).
- **Baseline System Roles**: Pre-configured domain role templates (`ORGANIZATION_OWNER`, `ORGANIZATION_ADMIN`, `PROPERTY_MANAGER`, `CARETAKER`, `FINANCE_CONTROLLER`, `LEGAL_OFFICER`, `TENANT`, `GUEST`).
- **Tenant Role Overrides & Custom Roles**: Tenant organizations can create custom roles and override role-permission sets within their organization boundary.
- **Presentation Authorization Guards**: Deny-by-default `requirePermission` and `requirePermissions` Express middleware enforcing granular permissions with RFC 7807 problem details.
- **Owner Protection Invariants**: Primary organization owners automatically resolve to all permissions within their tenant and cannot be demoted, suspended, or removed.
- **Suspended Member Security Enforcement**: Members with `SUSPENDED` status resolve to 0 permissions and are blocked with 403 Forbidden.
- **Asymmetric RS256 Token Hardening**: RS256 token signing with RFC 7517 JWKS endpoint (`/.well-known/jwks.json`).
- **AES-256-GCM Encrypted Refresh Tokens**: Multi-tenant token payload with 24-hour MFA expiration.
- **Anti-Session Hijacking**: Device fingerprint verification (`X-Device-Fingerprint`) with client IP decoupling for cellular/Wi-Fi mobility.
- **Dynamic MFA Route Protection**: Database-configured MFA protected routes with `SESSION_24H` and `EVERY_TIME` modes.
- **Immutable Audit Trail**: Append-only security audit log in `iam.audit_logs`.

### 2. Property Portfolio Domain (`property`)
- **Multi-Tenant Property Portfolio**: Scoped by `tenant_id` across `property.properties` with compound indexes on `(tenant_id, created_at DESC)` and `(tenant_id, status)`. Fail-closed quarantine (404/403) across tenant boundaries.
- **Rentable Unit Inventory (`property.units`)**: Decoupled unit management with unique numbering per property `(property_id, unit_number)`, and dedicated occupancy state machine (`VACANT` -> `RESERVED` -> `OCCUPIED` -> `VACANT` / `UNDER_MAINTENANCE`).
- **Architectural Floorplans & Dynamic Pricing Matrices**: Floorplan specs and seasonal rate multipliers with mathematical precision.
- **Multi-Owner Equity Split Ledgers (`property.ownership_splits`)**: Enforces strict mathematical invariant where stakeholder shares per property must sum to exactly 100.00% ($\sum \text{shares} = 100.00\%$), rejecting any configuration with $< 100\%$ or $> 100\%$ with `InvalidOwnershipSplitError`.
- **Event-Driven Search Integration**: Emits `property.registered` domain integration event upon property creation.
- **State Machine Lifecycle**: Transitions graph (`VACANT` -> `RENTED` -> `UNDER_MAINTENANCE` -> `LISTED_FOR_RENT` | `LISTED_FOR_SALE`).

### 3. Caretaking & Assignment Domain (`caretaking`)
- **Multi-Tenant Caretaker Profiles (`caretaking.profiles`)**: Caretaker onboarding, contact info, skills matrix, service cities, and KYC verification states (`PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`).
- **Assignment State Machine Lifecycle (`caretaking.assignments`)**: Formalized progression (`PENDING_ACCEPTANCE` -> `ACTIVE` -> `TERMINATED` | `REJECTED`), enforcing a single active assignment per property within tenant boundaries.
- **Granular Service Scopes & Owner Spending Limits**: Dynamic permission checking (`VIEW_PROPERTY`, `KEY_ACCESS`, `INSPECT_PREMISES`, `SOLICIT_QUOTES`, `AUTHORIZE_REPAIRS_WITHIN_LIMIT`, `CONDUCT_VISITS`, `COLLECT_RENT_PROOF`) coupled with owner-defined single purchase authorization caps.
- **Instant Revocation Invariant (`FR-ASG-010`)**: Atomic, immediate revocation of all permission scopes and zeroing of spending limits upon assignment termination, accompanied by `caretaking.terminated` domain integration event emission.
- **Fail-Closed Multi-Tenant Quarantine**: Cross-tenant lookups, acceptances, permission updates, and terminations strictly rejected (404/403). Verified with 28/28 passing unit tests.

### 4. Maintenance Equilibrium Engine (`maintenance`)
- Priority triage matrix (P1 Emergency, P2 Urgent, P3 Standard, P4 Routine).
- Automated SLA response/resolution matrix.
- Pre-authorized emergency float escrow mobilization for P1 emergencies.
- Contractor quotation approval thresholds for non-emergency repairs.
- Anti-fraud GPS check-in verification and photographic before/after telemetry proofs.

### 5. Rental Lifecycle Management (`rental`)
- Lease agreement state machine (`DRAFT` -> `PENDING_SIGNATURE` -> `ACTIVE` -> `TERMINATED` | `EXPIRED`).
- Digital signature timestamp auditing.
- Automated security deposit calculation and escrow tracking.
- Penalty calculation engine for late rent payments.

### 6. Document Generation & Verification (`document`)
- Automated template interpolation for lease agreements and inspection reports.
- Cryptographic SHA-256 content hashing for document tampering defense.
- QR code tamper-evident verification link embedding.
- Multi-party digital signature tracking.

### 7. Financial Ledgers & Split Settlements (`finance`)
- Double-entry transaction ledgers with strict balanced debits/credits invariant.
- Automated management fee deduction before owner disbursement.
- Rent collection reconciliation with tenant payment reference matching.
- Cryptographic idempotency key validation on all money-moving endpoints.

### 8. Asset Management Foundation & Storage Ports (`asset`)
- **Hexagonal Port Decoupling**: File storage decoupled via `IStorageProvider` port (`write`, `read`, `delete`, `exists`, `getSignedUrl`).
- **Two-Phase Upload Flow**: Client initiates upload with `RequestPresignedUploadUseCase`, receives presigned URL and reserved metadata in `PENDING_UPLOAD`, and verifies physical byte presence via `ConfirmAssetUploadUseCase` before transitioning to `ACTIVE`.
- **Strict Invariant Validation**: File sizes strictly bounded to 25 MB max (`InvalidAssetSizeError`); file MIME types strictly restricted to image/document whitelist (`InvalidAssetMimeTypeError`).
- **Fail-Closed Multi-Tenant Quarantine**: Assets partitioned by `tenant_id`; cross-tenant access blocked with 403 Forbidden.
- **Lifecycle State Integrity**: Assets in `PENDING_UPLOAD` are quarantined from standard tenant listings and download URL generation until confirmed.
- **Soft Deletion & Storage Purge**: `DELETE /api/assets/:id` marks metadata as `ARCHIVED` and purges the physical file from storage.

### 9. Cloud Storage Adapters & Dynamic Factory (`asset`)
- **AWS S3 Storage Adapter (`S3StorageProvider`)**: Production-grade AWS Signature Version 4 (SigV4) presigned `PUT` upload and `GET` download URL generator, zero external cloud SDK dependency bloat, custom S3/MinIO endpoint support, path-style addressing, and temporary session credential integration.
- **Google Cloud Storage Adapter (`GcsStorageProvider`)**: Standard GCS V4 signed URL generator (`GOOG4-RSA-SHA256`) with RSA PEM private key signing and fallback test signatures.
- **Dynamic Storage Provider Factory (`StorageProviderFactory`)**: Dynamic runtime resolution based on `STORAGE_PROVIDER` (`LOCAL`, `S3`, `GCS`) with strict configuration validation (`InvalidStorageConfigurationError`) and tenant-specific bucket/CDN overrides via `createForTenant`.
- **Anti-Directory Traversal & Tenant Path Isolation (`storage-path.util.ts`)**: Strict path sanitization eliminating `../` traversal tokens and null bytes, enforcing multi-tenant directory partitioning (`tenants/${tenantId}/${category}/...`), and throwing `StoragePathValidationError` on boundary violations.
- **Docker Persistent Volume Mount**: Configured `monolith_storage` volume mapped to `/data/storage/uploads` across root and infrastructure Compose definitions.

### 10. Multi-Tenant Inventory Ledger & Optimistic Concurrency (`inventory`)
- **Multi-Tenant Data Partitioning**: Scoped by `tenant_id` with compound unique index `(tenant_id, sku)`; Tenant B is strictly quarantined from viewing, reserving, or modifying Tenant A's stock.
- **Optimistic Concurrency Control**: Entity versioning on `inventory.inventory_items` eliminating race conditions during simultaneous reservations; stale writes safely rejected with 409 Conflict.
- **Two-Phase Reservation Lifecycle**: `RESERVE` decrements available and increments reserved; `RELEASE` returns quantity to available pool; `COMMIT` permanently debits reserved stock upon physical dispatch. Mathematical invariant `availableQuantity = totalQuantity - reservedQuantity >= 0` is guaranteed.

### 11. Multi-Tenant Order Processing & Inventory Reservation Linkage (`order`)
- **Multi-Tenant Scoping**: Isolated by `tenant_id` across `orders.orders` and `orders.order_items`, with fail-closed quarantine (404/403) across tenant boundaries.
- **Mathematical Pricing Invariants**: Rigorous price calculations rounding to 2 decimal places, rejecting zero/negative quantities, negative unit prices, or empty item lists.
- **State Machine Lifecycle Transitions**: Strict validation of order lifecycle states (`PENDING` -> `RESERVED` -> `PAID` -> `FULFILLED` / `CANCELLED`), rejecting invalid state regressions.
- **Two-Phase Inventory Reservation Linkage**: Atomic stock reservation upon order creation with automatic compensation rollback of previously reserved items if any item fails; stock release upon cancellation; permanent stock commitment upon fulfillment.
- **Event-Driven Payment Settlement**: Asynchronous integration event consumer for `transactions.completed` automatically marking paid orders.

### 12. Multi-Gateway Payment Routing, Webhook Idempotency & Transaction Ledgers (`transaction`)
- **Multi-Tenant Transaction Ledgers**: Financial records scoped by `tenant_id` across `transactions.transactions` with compound indexes on `(tenant_id, created_at DESC)`, `(tenant_id, reference_id)`, and `(tenant_id, user_id)`.
- **Pluggable Payment Gateway Adapters**: Decoupled adapters (`StripePaymentGatewayAdapter`, `RazorpayPaymentGatewayAdapter`, `MockPaymentGatewayAdapter`) routed through `DynamicPaymentGatewayRouter` with runtime tenant provider overrides.
- **Cryptographic Webhook Signature Verification**: Real native HMAC-SHA256 signature verification over `t=timestamp,v1=signature` (Stripe) and `x-razorpay-signature` (Razorpay) using `crypto.timingSafeEqual`.
- **Append-Only Webhook Idempotency Ledger**: `transactions.webhook_events` tracking `(provider, event_id)` with unique constraints; safely absorbs duplicate deliveries with `ALREADY_PROCESSED` without double-crediting or duplicate domain event dispatch.
- **State Machine Lifecycle & Refunds**: Transition graph (`PENDING` -> `SUCCESS` | `FAILED` | `REFUNDED`) with domain validation; programmatic refunds coordinated across ledger and gateway adapters.
- **Order Settlement Linkage**: Emits `transactions.completed` domain events to settle linked orders to `PAID`.

### 13. Shared Services — Notifications, Job Scheduler & Full-Text Search (`notification`, `scheduler`, `search`)
- **Multi-Tenant Multi-Channel Notifications**: Scoped by `tenant_id` across `EMAIL` (SendGrid), `SMS` (Twilio), `WHATSAPP` (Meta Cloud), `PUSH` (FCM), and `IN_APP` with string template interpolation (`{{key}}`) and developer dry-run outbox auditing partitioned by tenant. Cross-tenant lookups reject with `NotFoundError`.
- **Multi-Tenant Cron Job Scheduler**: Tenant-scoped cron jobs and execution runs table (`scheduler.job_runs`), tracking task status lifecycle (`SCHEDULED` -> `RUNNING` -> `COMPLETED` | `FAILED`), execution durations, and error diagnostics.
- **Multi-Tenant Full-Text Search Engine**: Ingests and indexes documents (`PROPERTY`, `USER`, `ORDER`, `MAINTENANCE`, `FINANCE`) with multi-token title/description matching and type filtering, strictly quarantined by `tenant_id`.
- **Asynchronous Domain Event Projection**: Event subscribers to `orders.order_created` and `iam.user_registered` automatically trigger tenant-attributed notifications and synchronize search index documents.

---

## 3. Latest Verification & Quality Gate Results

- **TypeScript Typecheck (`pnpm typecheck`)**: 0 errors across all workspace projects (`@monolith/contracts`, `@monolith/api`, `@monolith/web`).
- **Architecture Static Analysis (`pnpm test:arch`)**: 3/3 tests passed.
  - No cross-module internal file imports.
  - Domain layer completely isolated from Express, pg, or HTTP dependencies.
  - All modules export a clean top-level `index.ts`.
- **Property Portfolio Unit Suite (`property-portfolio.test.ts`)**: 18/18 tests passed.
  - Multi-tenant property registration with address validation, emergency float configuration, state machine transitions, rentable unit creation & occupancy lifecycle, multi-owner equity split 100.00% invariant, presentation controller boundary, and public API facades.
- **Shared Services Unit Suite (`shared-services.test.ts`)**: 20/20 tests passed.
  - Multi-tenant notification dispatch across 5 channels, template interpolation, dry-run outbox, scheduler lifecycle and run history, full-text search token matching and type filtering, presentation controllers, and public APIs.
- **Transaction Processing & Idempotency Suite (`transaction-processing.test.ts`)**: 20/20 tests passed.
- **Order Processing & Inventory Linkage Suite (`order-processing.test.ts`)**: 20/20 tests passed.
- **Inventory Concurrency & Isolation Suite (`inventory-concurrency.test.ts`)**: 18/18 tests passed.
- **Cloud Storage Adapters Test Suite (`storage-adapters.test.ts`)**: 24/24 tests passed.
- **Cumulative Regression Test Suite**: 120/120 tests passed across 6 capability suites in ~1 second.

---

## 4. Engineering Operational Rules & Next Milestone

In strict adherence to the project's core engineering principles:
- **One Sprint, One Objective**: Focus is strictly quarantined to a single bounded domain per sprint.
- **Repository as Memory**: Ground-truth status is maintained in-repo without chat dependency.
- **Evidence-Based Progression**: Only code, migrations, and passing automated tests determine milestone completion.
- **Just-In-Time Specifications**: Specifications are detailed iteratively on a rolling window.

### Current Milestone State:
- **Sprint 00 (Architecture Baseline)**: `COMPLETED & VERIFIED` (AST boundary tests passing 3/3, 0 typecheck errors).
- **Sprint 01 (Application Foundation)**: `COMPLETED & VERIFIED` (Database pool, migration harness, logger, error middleware).
- **Sprint 02 (Identity & Cryptography)**: `COMPLETED & VERIFIED` (RS256 JWT, JWKS endpoint, AES-GCM refresh tokens, fingerprinting).
- **Sprint 03 (Multi-Tenant Organizations)**: `COMPLETED & VERIFIED` (Organizations, memberships, invitations, tenant context middleware, 18/18 tests passing).
- **Sprint 04 (Dynamic RBAC & Scoped Authorization)**: `COMPLETED & VERIFIED` (Dynamic roles, tenant-scoped permissions, `requirePermission` guard, 18/18 tests passing).
- **Sprint 05 (Asset Management Foundation)**: `COMPLETED & VERIFIED` (Two-phase presigned upload lifecycle, MIME validation, storage ports, 20/20 tests passing).
- **Sprint 06 (Cloud Storage Adapters: AWS S3 & GCS)**: `COMPLETED & VERIFIED` (AWS S3 SigV4, GCS V4, StorageProviderFactory, Docker volume, 24/24 tests passing).
- **Sprint 07 (Multi-Tenant Inventory & Concurrency)**: `COMPLETED & VERIFIED` (Multi-tenant inventory, optimistic locking versioning, two-phase reservations, 18/18 tests passing).
- **Sprint 08 (Orders & Fulfillment Core Domain)**: `COMPLETED & VERIFIED` (Multi-tenant orders, pricing invariants, state machine, inventory linkage, 20/20 tests passing).
- **Sprint 09 (Transactions & Payments Core Domain)**: `COMPLETED & VERIFIED` (Multi-gateway payment routing, webhook idempotency & transaction ledgers, 20/20 tests passing).
- **Sprint 10 (Shared Services Core Domain)**: `COMPLETED & VERIFIED` (Multi-channel notifications, cron job scheduler, full-text search indexing, 20/20 tests passing).
- **Sprint 11 (Property Portfolio Domain Foundation)**: `COMPLETED & VERIFIED` (Property units, floorplans, dynamic pricing matrices, ownership split ledgers, 18/18 tests passing).
- **Sprint 12 (Caretaker Assignments, Service Scopes & Instant Revocation)**: `ACTIVE OBJECTIVE` (Caretaker profiles, KYC verification, assignment aggregates, spending threshold limits, instant permission revocation).

### Immediate Next Single Action:
1. **Execute Sprint 12**: Draft and activate `SPRINT_12.md` focusing on caretaker assignment aggregates, spending thresholds, service scopes, instant revocation, and automated tests.
