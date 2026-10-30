# Implementation Sprint Roadmap

**Project:** Real Estate CareTaking Platform  
**Architecture:** DDD + Modular Monolith + Event-Driven  
**Stack:** Node.js, Express, TypeScript, PostgreSQL 16, React 18, Vite  
**Governance:** Governed by `AGENTS.md` and canonical instructions in `ai/`

---

## Roadmap Overview & Methodology

To ensure disciplined, predictable engineering delivery, the platform is structured into **20 independently verifiable sprints** grouped across four thematic pillars. Sprint boundaries are calibrated based on actual repository assessment.

```
+-------------------------------------------------------------------------------------------------------+
|                                         20-SPRINT MASTER ROADMAP                                      |
+-------------------------------------------------------------------------------------------------------+
|  [Platform Foundation]                   [Reusable Business Capabilities]                             |
|  - Sprint 00: Repository Discovery       - Sprint 05: Asset Management                                |
|  - Sprint 01: Application Foundation     - Sprint 06: Storage Adapters                                |
|  - Sprint 02: Identity & Authentication  - Sprint 07: Inventory Management                            |
|  - Sprint 03: Multi-Tenancy              - Sprint 08: Orders & Fulfillment                            |
|  - Sprint 04: Dynamic RBAC               - Sprint 09: Transactions & Payment Gateways                 |
|                                          - Sprint 10: Shared Services (Audit, Notification, Search)   |
+-------------------------------------------------------------------------------------------------------+
|  [Property Management Domain]            [Infrastructure & Production Readiness]                      |
|  - Sprint 11: Property Domain Foundation - Sprint 17: Terraform Infrastructure & Multi-Cloud          |
|  - Sprint 12: Ownership & Relationships  - Sprint 18: Integration & Security Verification             |
|  - Sprint 13: Vendor Management          - Sprint 19: Production Readiness & Observability            |
|  - Sprint 14: Maintenance Management                                                                  |
|  - Sprint 15: Service Workflows                                                                       |
|  - Sprint 16: Bulk Onboarding                                                                         |
+-------------------------------------------------------------------------------------------------------+
```

---

## Pillar 1: Platform Foundation

### Sprint 00 — Repository Discovery & Documentation
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Inspect existing code, runtime versions, stack, architecture, dependencies, and capability gaps. Establish canonical project documentation (`ai/`, `implementation/STATUS.md`, `traceability.md`).
- **Deliverables:** Complete `ai/` instruction files, `AGENTS.md` governance alignment, AST architectural boundary test harness (`pnpm test:arch`).
- **Verifiable Gate:** AST boundary tests passing; typecheck clean across workspace.

### Sprint 01 — Application Foundation
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Module conventions, 4-tier Clean Architecture (`domain`, `application`, `infrastructure`, `presentation`), database connection pooling (`pg.Pool`), migration harness, Winston/Pino logger, Zod validation, global error handling middleware.
- **Deliverables:** Database connection pool, `migrator.ts`, `001_initial_schema.sql` to `005_...`, error translator, outbox table.
- **Verifiable Gate:** Migrations run cleanly; error formatting complies with RFC 7807; outbox initialized.

### Sprint 02 — Identity & Authentication
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** User registration, password hashing (bcrypt/argon2), login, account lifecycle, asymmetric RS256 token issuance with standard OpenID Connect JWKS endpoint (`/.well-known/jwks.json`), AES-256-GCM encrypted refresh tokens, persistent device fingerprint anti-hijacking.
- **Deliverables:** `modules/iam`, `TokenService`, JWKS router, `auth.middleware.ts`, `iam.audit_logs`.
- **Verifiable Gate:** `token-hardening.test.ts` passing (11/11 tests); anti-session hijacking verified.

### Sprint 03 — Multi-Tenancy
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Organizations, onboarding, memberships, invitations, join requests, active organization context resolution, tenant isolation enforcement.
- **Deliverables:** Migration `006_iam_organizations_and_memberships.sql`, `iam.organizations`, `iam.organization_memberships`, `iam.organization_invitations`, tenant context middleware (`createTenantContextMiddleware`, `requireTenantMembership`, `requireOrgAdmin`), REST API routes, owner invariants.
- **Verifiable Gate:** `multi-tenant-organizations.test.ts` passing (18/18 tests, including all 5 mandatory tenant isolation security tests); AST architecture tests passing (3/3).

### Sprint 04 — Dynamic RBAC
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** 8 domain roles (`OWNER`, `CARETAKER`, `TENANT`, `BUYER`, `VENDOR`, `AGENT`, `LEGAL`, `ADMIN`), deny-by-default Express authorization guards, dynamic MFA protected routes (`iam.mfa_protected_routes` with `SESSION_24H` and `EVERY_TIME` modes), granular caretaking permission scopes with instant revocation (`FR-ASG-010`).
- **Deliverables:** Contracts role enums, RBAC guard middleware, MFA route table and interceptor, caretaking scope verification.
- **Verifiable Gate:** `pnpm test:security` passing (5/5 tests); dynamic MFA route verification tests passing.

---

## Pillar 2: Reusable Business Capabilities

### Sprint 05 — Asset Management
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Asset metadata, versioning, upload/download, storage interfaces.
- **Deliverables:** `modules/asset`, `asset.assets` table, `Asset` entity, MIME validation, owner-scoped asset pagination queries.
- **Verifiable Gate:** MIME type validation tests; asset upload/retrieval endpoints responding correctly.

### Sprint 06 — Storage Adapters
- **Status:** `IN_PROGRESS (Local Docker Storage Verified; Cloud S3/GCS Adapters Scheduled)`
- **Scope:** Local Docker storage and first cloud storage integration.
- **Deliverables:** Container-mounted persistent volume storage adapter, path sanitization against directory traversal, `IStorageAdapter` port abstraction for AWS S3 and Google Cloud Storage.
- **Verifiable Gate:** Local file read/write operations verified in container environment; S3 adapter blueprint ready.

### Sprint 07 — Inventory Management
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Inventory entities, CRUD, stock movements, adjustments, history.
- **Deliverables:** `modules/inventory`, `inventory.inventory_items` schema, `InventoryItem` aggregate, stock reservation, stock release, and quantity invariant checks.
- **Verifiable Gate:** Unit tests asserting stock reservation boundaries and atomic restoration on cancellation.

### Sprint 08 — Orders & Fulfillment
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Orders, line items, assignments, lifecycle and fulfillment.
- **Deliverables:** `modules/order`, `orders.orders` & `orders.order_items` tables, `Order` aggregate with state transitions (`PENDING` -> `CONFIRMED` -> `PROCESSING` -> `COMPLETED`), line item pricing calculation.
- **Verifiable Gate:** State machine transition tests; line item sum verification.

### Sprint 09 — Transactions & Payment Gateways
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Transaction lifecycle, payment references, refunds, reversals, idempotency, multi-gateway dynamic router.
- **Deliverables:** `modules/transaction`, `transactions.transactions` table, payment adapters (Mock, Stripe, Razorpay, PayPal), dynamic gateway router, webhook signature reconciliation.
- **Verifiable Gate:** Dynamic gateway router tests; webhook signature validation tests.

### Sprint 10 — Shared Services (Audit, Notifications, Search, Scheduler)
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Multi-channel notifications (Email, SMS, Push, WhatsApp), background cron job scheduler, full-text search indexing, immutable security audit logs.
- **Deliverables:** `modules/notification`, `modules/scheduler`, `modules/search`, `iam.audit_logs`.
- **Verifiable Gate:** Notification adapter fallback tests; search query recall tests; scheduler lock tests.

---

## Pillar 3: Property Management Domain

### Sprint 11 — Property Domain Foundation
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Core Property Module (`modules/property`), `Property` aggregate root, Address Value Object, categories (`RESIDENTIAL`, `COMMERCIAL`, `INDUSTRIAL`), property types, emergency float limit, lifecycle states (`DRAFT` -> `ACTIVE`).
- **Deliverables:** 4-tier Clean Architecture property module, `property.properties` table, CRUD endpoints, strongly typed contracts in `@monolith/contracts/property`.
- **Verifiable Gate:** Property invariant unit tests; lifecycle transition tests.

### Sprint 12 — Ownership & Relationships
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Multiple owners, organization-property associations, caretaker assignments, granular delegated scopes, spending limit caps, instant revocation on termination (`FR-ASG-010`).
- **Deliverables:** `modules/caretaking`, `caretaking.caretaker_profiles`, `caretaking.caretaker_assignments`, permission check middleware.
- **Verifiable Gate:** Unit tests asserting immediate permission invalidation upon assignment termination.

### Sprint 13 — Vendor Management
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Vendor profiles, dynamic trade service categories (Plumbing, Electrical, Carpentry, Masonry, HVAC), service offerings, coverage areas.
- **Deliverables:** Vendor contracts, directory lookup endpoints, quotation integration.
- **Verifiable Gate:** Vendor trade qualification checks before dispatch eligibility.

### Sprint 14 — Maintenance Management & Equilibrium Engine
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Maintenance Equilibrium Engine: Dynamic triage (P1-P4), automated SLA response/resolution matrix, pre-authorized emergency float escrow mobilization for P1 emergencies, contractor dispatch.
- **Deliverables:** `modules/maintenance`, `maintenance.maintenance_tickets`, priority triage use case, escrow calculation.
- **Verifiable Gate:** Immediate float escrow mobilization verified for P1; SLA breach escalation triggers verified.

### Sprint 15 — Service Workflows & Telemetry Proofs
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** Contractor quotation reviews, owner approval thresholds for non-emergency repairs (P2-P4), anti-fraud GPS geofence check-ins, before/after photographic telemetry (`ProofOfWork`), property financial ledger integration (`modules/finance`).
- **Deliverables:** `maintenance.ticket_quotations`, `maintenance.proof_of_work`, `modules/finance` expense ledgers.
- **Verifiable Gate:** Rejection of completion proofs outside property geofence; settlement disbursement matching approved quotation amounts.

### Sprint 16 — Bulk Onboarding
- **Status:** `PLANNED / SCHEDULED`
- **Scope:** Bulk property and unit onboarding for portfolio owners and enterprise clients via CSV templates, streaming validation, and detailed error reports.
- **Deliverables:** `BulkOnboardingService`, CSV validation pipes, batch import endpoint with partial-success reporting.
- **Verifiable Gate:** Streaming import tests with 1,000+ rows asserting error reporting and rollback guarantees.

---

## Pillar 4: Infrastructure & Production Readiness

### Sprint 17 — Terraform Infrastructure
- **Status:** `COMPLETED / VERIFIED IN INFRASTRUCTURE`
- **Scope:** Reusable Terraform modules, multi-environment isolation (`local`, `dev`, `staging`, `prod`), multi-cloud provider adapters (`aws`, `gcp`, `azure`, `digitalocean`, `vps`, `local`), state locking, server sizing contracts.
- **Deliverables:** `boilerplate/infra/terraform`, Ansible playbooks, Kubernetes kustomization manifests, `test_server_count_bounds.sh`.
- **Verifiable Gate:** Terraform syntax, validation, and sizing bound tests passing.

### Sprint 18 — Integration & Security
- **Status:** `COMPLETED / VERIFIED`
- **Scope:** End-to-end multi-module user journeys, tenant boundary isolation audits, OWASP Top 10 automated security test suite, AST architectural boundary isolation.
- **Deliverables:** `pnpm test:arch` (3 tests passed), `pnpm test:security` (5 tests passed), typecheck validation.
- **Verifiable Gate:** 100% pass on security and architecture test suites; zero TypeScript compile errors.

### Sprint 19 — Production Readiness & Observability
- **Status:** `IN_PROGRESS (Runbooks & Probes Verified; Live APM & Swagger Scheduled)`
- **Scope:** Operational runbooks, zero-downtime deployment, liveness/readiness health probes, OpenAPI/Swagger 3.0 documentation, Prometheus metrics, and OpenTelemetry tracing.
- **Deliverables:** `docs/runbooks/production-deployment.md`, `local-development.md`, gateway `/health`, `/health/live`, `/health/ready` endpoints, Docker compose and Kubernetes deployment manifests.
- **Verifiable Gate:** Health probes returning 200 OK on active DB pool; clean production bundle builds.
