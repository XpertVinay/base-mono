# Real Estate CareTaking — Architecture & Design Decisions

**Document:** `DECISIONS.md`  
**Version:** 1.0  
**Status:** Approved & Implemented  
**Scope:** Architectural Decision Records (ADRs) and Operational System Decisions

---

## 1. Architectural Decision Records (ADRs)

### ADR-0001: Modular Monolith Boundaries & Schema Isolation
- **Status:** Approved
- **Context:** Building microservices early introduces excessive infrastructure overhead, deployment latency, and distributed transaction complexity. However, a traditional monolith quickly degenerates into tight coupling.
- **Decision:** Build a Modular Monolith. Each business domain is encapsulated in an isolated module with a dedicated PostgreSQL schema. No module may import another module's internal files or directly query another module's database tables.
- **Consequences:** Low operational cost, simple local development, strict boundaries enforced by AST static tests (`pnpm test:arch`), and an effortless path to extract services if needed.

### ADR-0002: Inter-Module Event-Driven Communication via Transactional Outbox
- **Status:** Approved
- **Context:** State changes in one module (e.g., ticket resolution) often require cross-module reactions (e.g., expense generation, tenant notification) without tight synchronous coupling.
- **Decision:** Implement the Transactional Outbox Pattern (`common.outbox_events`). State modifications and domain event records are written in the same local ACID transaction. An asynchronous worker delivers events with at-least-once guarantees.
- **Consequences:** Guaranteed event publication, zero distributed two-phase commits, high resilience against transient network/process failures.

### ADR-0003: Security Controls & OWASP Alignment
- **Status:** Approved
- **Context:** Real estate management involves financial transactions, legal title deeds, and personal tenant records, demanding strict enterprise security.
- **Decision:** Implement OWASP Top 10 defenses: Deny-by-default RBAC, parameterized SQL queries, Helmet security headers, rate limiting, and immutable security audit logs in `iam.audit_logs`.
- **Consequences:** Protection against injection, unauthorized access, and tampering. Validated via `pnpm test:security`.

---

## 2. Operational & Platform Design Decisions

### Decision 001: Real Estate CareTaking Clean Architecture (4-Tier)
- **Context:** The codebase requires domain models capable of complex invariant enforcement (e.g., caretaker permission revocation, emergency float limits).
- **Decision:** All real estate modules (`property`, `caretaking`, `maintenance`, `rental`, `document`, `finance`) strictly adhere to the 4-tier Clean Architecture:
  - `domain/`: Entities, value objects, domain invariants, repository interfaces.
  - `application/`: Commands, queries, use cases.
  - `infrastructure/`: PostgreSQL repositories, external services.
  - `presentation/`: Express controllers and route handlers.

### Decision 002: Maintenance Equilibrium Engine Priority & Float Escrow
- **Context:** Tension exists between tenant urgency (flooding, gas leaks) and property owner desire to control spending.
- **Decision:** Implement dynamic triage (P1-P4):
  - **P1 Emergency**: 15 min response SLA, 4 hr resolution SLA; auto-covered by pre-authorized emergency float escrow up to owner configured limit without waiting for manual quotation approval.
  - **P2 Urgent**: 1 hr response SLA, 24 hr resolution SLA; auto-escalated on SLA breach.
  - **P3 Standard**: 4 hr response SLA; standard quotation review.
  - **P4 Routine**: 24 hr response SLA; scheduled review.

### Decision 003: Asymmetric RS256 JWT Token Signing & Public JWKS
- **Context:** In a multi-tenant platform with microfrontends, mobile apps, and prospective worker services, sharing symmetric secrets (`HS256`) is a major security vulnerability.
- **Decision:** Upgrade IAM token signing to asymmetric RSA (`RS256`). The API securely holds the private RSA key to sign tokens, while publishing the corresponding public keys at the standard OpenID Connect JWKS endpoint (`/.well-known/jwks.json`).
- **Consequences:** Distributed microservices, web gateways, and edge workers can independently verify token validity without possessing the signing secret.

### Decision 004: Anti-Session Hijacking via Device Fingerprint & IP Decoupling
- **Context:** Binding session tokens strictly to client IP addresses causes frequent session dropping on mobile devices switching between Wi-Fi and 5G cellular towers, while NAT/VPN shared IPs cause collision risks.
- **Decision:** Compute session fingerprints using persistent client device hints (`X-Device-Fingerprint`) and User-Agent HMAC. Client IP is excluded from the token cryptographic hash, but recorded in `iam.audit_logs` for forensic anomaly detection.

### Decision 005: Multi-Tenant Hierarchical Config & Relational Overrides
- **Context:** White-label clients require custom themes, notification webhooks, and fee structures without modifying core application code.
- **Decision:** Implement a 4-tier configuration engine: Global Defaults -> Database Base Settings -> Tenant Relational JSONB Overrides (`app_config.tenant_configurations`) -> In-Memory TTL Cache.

### Decision 006: Dynamic Database-Configured MFA Protected Routes
- **Context:** Critical operations (e.g., password change, bank account update, lease authorization) require elevated verification.
- **Decision:** Store protected routes in `iam.mfa_protected_routes` with two reverification modes:
  - `SESSION_24H`: Re-verifies once every 24 hours.
  - `EVERY_TIME`: Requires immediate step-up MFA challenge on every invocation.

### Decision 007: Single-Identity Multi-Tenancy & Dynamic RBAC
- **Context:** Enterprise users need to operate across multiple real estate organizations with different roles and permissions without repeated logins.
- **Decision:** Associate a single user record with multiple organizations via `iam.organization_memberships`. Enforce dynamic RBAC permissions conforming to `<domain>:<action>` evaluated against tenant custom roles and system roles, with primary organization owner protection.

### Decision 008: Hexagonal Storage Provider Abstraction & Two-Phase Upload Lifecycle
- **Context:** Real estate platforms manage media and sensitive documents across different cloud and on-premises environments without tight vendor lock-in. Direct file streaming through API nodes creates bottlenecks and security risks.
- **Decision:** Introduce the `IStorageProvider` hexagonal port. Implement a two-phase upload flow:
  1. `RequestPresignedUploadUseCase` validates strict MIME type whitelists, extensions, and file size limits, returning a signed upload URL and reserving an asset record in `PENDING_UPLOAD`.
  2. `ConfirmAssetUploadUseCase` verifies physical presence in storage before transitioning the asset to `ACTIVE`.
  Assets in `PENDING_UPLOAD` are strictly quarantined from standard tenant asset listings. Storage keys enforce tenant-partitioned paths (`tenants/${tenantId}/${category}/...`).

### Decision 009: Cloud Storage Adapters (AWS S3 & GCS) with Zero-Bloat Native Signing & Dynamic Factory
- **Context:** Production environments require scalable object stores (AWS S3 and Google Cloud Storage) with client-direct presigned uploads and CDN distribution, while local development and testing require zero-configuration offline execution. Bundling heavy AWS and GCP SDKs adds hundreds of megabytes of binary bloat.
- **Decision:** Implement native Node.js crypto-based AWS Signature Version 4 (SigV4) in `S3StorageProvider` and Google Cloud V4 signed URL generator in `GcsStorageProvider`. Deliver `StorageProviderFactory` supporting dynamic runtime environment resolution, tenant-specific bucket overrides, container-mounted Docker volumes (`/data/storage/uploads`), and strict anti-directory traversal sanitization (`sanitizeStorageKey`).
- **Consequences:** Zero external cloud SDK bloat, 100% offline unit and integration test execution, pluggable cloud migration, and multi-tenant path isolation.

### Decision 010: Multi-Tenant Inventory Ledger & Optimistic Concurrency Control
- **Context:** In maintenance operations and property caretaking, multiple caretakers, contractors, or staging coordinators may simultaneously attempt to reserve spare parts, lockbox keys, or emergency repair equipment. Race conditions lead to phantom allocations and overselling.
- **Decision:** Implement strict optimistic concurrency control via a `version` column in `inventory.inventory_items`. Any stock reservation, release, commit, or quantity adjustment verifies the expected version and increments it atomically. Mutations failing version checks return a 409 Conflict error. Scope stock uniquely per tenant `(tenant_id, sku)`. Implement a two-phase reservation lifecycle (`RESERVE` -> `COMMIT` | `RELEASE`) ensuring `availableQuantity = totalQuantity - reservedQuantity >= 0` invariant is mathematically preserved.
- **Consequences:** Eliminates distributed locking overhead while preventing overselling and lost updates under concurrent reservations.

### Decision 011: Multi-Tenant Order Processing, Pricing Invariants & Inventory Reservation Linkage
- **Context:** In property maintenance and caretaker operations, work orders and procurement supply packages must be strictly isolated to tenant organizations, ensure monetary invariants without floating-point inaccuracies, enforce state machine transitions, and atomically synchronize with the inventory reservation engine without distributed transaction overhead.
- **Decision:** Implement multi-tenant scoping (`tenant_id`) across `orders.orders` and `orders.order_items`. Enforce domain-level mathematical pricing invariants (2 decimal rounding, non-negative amounts, non-empty orders). Formalize state machine transitions (`PENDING` -> `RESERVED` -> `PAID` -> `FULFILLED` / `CANCELLED`) with strict rejection of illegal state changes. Wire `OrderModule` with `IInventoryReservationService` via a two-phase reservation protocol: atomically reserve inventory line items upon order placement with automatic compensation rollback of previously reserved items if any line item reservation fails. Wire cancellation to release stock reservations, fulfillment to commit stock permanently, and subscribe to `transactions.completed` domain events to automatically transition orders to `PAID`.
- **Consequences:** Eliminates phantom reservations, overselling, and financial inconsistencies. Provides fail-safe multi-tenant quarantine (404/403) and decouples order workflows from external payment transactions via domain integration events.

### Decision 012: Multi-Gateway Payment Routing, Cryptographic Webhook Verification & Idempotency Ledgers
- **Context:** In multi-tenant property management, payments originate from global platforms (Stripe, PayPal, Razorpay) across different currencies. Webhooks sent by payment gateways are vulnerable to replay attacks, duplicate deliveries, and signature forgery, leading to double-crediting or corrupted order states.
- **Decision:** Implement multi-tenant scoping (`tenant_id`) across `transactions.transactions`. Deliver pluggable payment gateway adapters (`StripePaymentGatewayAdapter`, `RazorpayPaymentGatewayAdapter`, `MockPaymentGatewayAdapter`) routed through `DynamicPaymentGatewayRouter` supporting runtime tenant configuration overrides. Verify incoming webhook authenticity using native Node.js HMAC-SHA256 crypto with timing-safe comparison (`timingSafeEqual`). Guarantee idempotency via an append-only webhook ledger (`transactions.webhook_events`) with unique constraints on `(provider, event_id)`: duplicate events are safely acknowledged with `ALREADY_PROCESSED` without re-emitting integration events or double-crediting. Settle linked orders by publishing `transactions.completed` domain events.
- **Consequences:** Eliminates payment replay vulnerabilities, prevents duplicate order settlements, isolates financial records per tenant, and avoids heavy third-party SDK dependencies.



### Decision 013: Shared Services Multi-Tenancy (Notifications, Job Scheduler & Full-Text Search)
- **Context:** Enterprise property management requires reliable asynchronous capabilities: multi-channel notifications (tenant communications, lease reminders, payment receipts), recurring job scheduling (daily reconciliation, outbox flushing, SLA escalation), and fast full-text searching across property portfolios and maintenance records. These capabilities must be strictly isolated between tenant organizations to prevent data leakage and cross-tenant execution interference.
- **Decision:**
  1. **Notification Module (`apps/api/src/modules/notification`)**: Partition notification records by `tenant_id`. Route outbound notifications across channels (EMAIL, SMS, WHATSAPP, PUSH, IN_APP) via pluggable adapters (SendGrid, Twilio, Meta WhatsApp, FCM, Mock). Enforce string template interpolation (`{{key}}`) and record simulated dispatches in a tenant-aware Developer Outbox (`DryRunOutboxService`). Fail cross-tenant queries closed with `NotFoundError`.
  2. **Scheduler Module (`apps/api/src/modules/scheduler`)**: Scope scheduled jobs (`scheduler.jobs`) and execution logs (`scheduler.job_runs`) by `tenant_id`. Support state machine lifecycle (`SCHEDULED` -> `RUNNING` -> `COMPLETED` | `FAILED`) with execution duration and failure reason capture. Prevent cross-tenant job querying, triggering, or log inspection.
  3. **Search Module (`apps/api/src/modules/search`)**: Partition full-text search documents (`search.search_index`) by `tenant_id`. Enable multi-token keyword searching over titles and descriptions with document type filtering (`PROPERTY`, `USER`, `ORDER`, `MAINTENANCE`, `FINANCE`). Asynchronously synchronize domain events (`orders.order_created`, `iam.user_registered`) into tenant-scoped search index projections.
- **Consequences:** Provides unified, battle-tested reusable infrastructure across the platform with zero cross-tenant leakage, zero cloud vendor lock-in, and reliable event-driven projections.

### Decision 014: Property Portfolio Multi-Tenancy, Unit Inventories & Ownership Splits
- **Context:** In real estate asset management, properties are owned fractionally by multiple investors/stakeholders, sub-divided into distinct rentable units with independent occupancy states, and must be strictly partitioned by managing tenant organization to prevent multi-tenant data leakage.
- **Decision:**
  1. **Multi-Tenant Property Portfolio**: Scope `property.properties` by `tenant_id` with compound performance indexes on `(tenant_id, created_at DESC)` and `(tenant_id, status)`. Reject cross-tenant lookups with `NotFoundError` (fail-closed).
  2. **Rentable Unit Inventory (`property.units`)**: Decouple units from whole properties with dedicated occupancy state machine (`VACANT` -> `RESERVED` -> `OCCUPIED` -> `VACANT` / `UNDER_MAINTENANCE`), enforcing unique unit numbering per property `(property_id, unit_number)`.
  3. **Multi-Owner Split Allocation Ledgers (`property.ownership_splits`)**: Enforce a strict domain mathematical invariant: all stakeholder share percentages per property must sum to exactly 100.00% ($\sum \text{shares} = 100.00\%$), rejecting any configuration with $< 100\%$ or $> 100\%$ with `InvalidOwnershipSplitError`.
  4. **Event-Driven Integration**: Emit `property.registered` domain integration events to automatically synchronize new properties with the `SearchModule` full-text search projection index.
- **Consequences:** Eliminates equity allocation disputes, guarantees data isolation across property management organizations, and accurately tracks granular unit inventories.
