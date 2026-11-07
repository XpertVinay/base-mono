# Changelog — Real Estate CareTaking Platform

All notable changes to this platform are documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.5.0] - 2026-11-07

### Added
- **Multi-Tenant Order Processing, Pricing Invariants & Inventory Reservation Linkage (Sprint 08)**:
  - Database migration `010_order_multitenancy_and_lifecycle.sql` adding `tenant_id` to `orders.orders` and `orders.order_items`, with compound performance indexes on `(tenant_id, created_at)` and `(tenant_id, user_id)`.
  - Contracts in `@monolith/contracts/order`: updated `OrderDto`, `CreateOrderRequestDto`, `OrderItemDto`, and domain integration events (`OrderCreatedEvent`, `OrderPaidEvent`, `OrderFulfilledEvent`, `OrderCancelledEvent`) with `tenantId`.
  - Enhanced domain entity `Order`:
    - Strict monetary pricing calculation invariants (rounding to 2 decimals, rejecting negative quantities/prices, non-empty order guarantee).
    - Formalized state machine transitions: `PENDING` -> `RESERVED` -> `PAID` -> `FULFILLED` / `CANCELLED` with explicit `InvalidStateTransitionError` on illegal mutations.
  - Implemented application use cases:
    - `CreateOrderUseCase`: atomic two-phase inventory reservation with compensation rollback on partial stock failures, transitioning order to `RESERVED`.
    - `CancelOrderUseCase`: coordinates automatic inventory stock release.
    - `FulfillOrderUseCase`: coordinates automatic permanent inventory stock commitment.
    - `GetOrderByIdQuery`, `ListMyOrdersQuery`, `ListTenantOrdersQuery`: fail-closed multi-tenant quarantine.
  - Presentation HTTP endpoints under `/api/orders`:
    - `POST /api/orders`: Create order and trigger atomic inventory reservations.
    - `GET /api/orders`: Paginated list of tenant orders.
    - `GET /api/orders/:id`: Detailed order lookup with tenant boundary enforcement.
    - `POST /api/orders/:id/cancel`: Cancel order and release reserved stock.
    - `POST /api/orders/:id/fulfill`: Fulfill order and commit stock permanently.
  - Cross-module integration & public API in `OrderModule`:
    - Subscribes to `transactions.completed` integration events to automatically transition orders to `PAID`.
    - Exposes `IOrderModulePublicApi` (`getOrder`, `markOrderPaid`, `fulfillOrder`, `cancelOrder`, `getRepository`).
  - Dedicated automated test suite `apps/api/src/tests/unit/order-processing.test.ts` with 20/20 passing tests.

---

## [1.4.0] - 2026-11-07

### Added
- **Multi-Tenant Inventory Ledger & Optimistic Concurrency Control (Sprint 07)**:
  - Database migration `009_inventory_multitenancy_and_concurrency.sql` adding `tenant_id`, `name`, `category`, and `version` columns to `inventory.inventory_items`, compound unique index on `(tenant_id, sku)`, and `inventory.inventory_reservations` audit table.
  - Enhanced domain entity `InventoryItem` with optimistic concurrency version tracking, mathematical stock equilibrium invariant (`availableQuantity = totalQuantity - reservedQuantity >= 0`), and two-phase lifecycle methods (`reserve`, `release`, `commit`, `adjustStock`).
  - Implemented application use cases: `CreateInventoryItemUseCase`, `GetInventoryItemQuery`, `ListInventoryQuery`, `ReserveStockUseCase`, `ReleaseStockUseCase`, and `CommitStockUseCase`.
  - Presentation HTTP endpoints:
    - `POST /api/inventory/items`: Create stock item with tenant scoping.
    - `GET /api/inventory/items`: Paginated listing of tenant inventory.
    - `GET /api/inventory/items/:productId`: Retrieve single stock item with tenant boundary checks.
    - `POST /api/inventory/reserve`: Atomically reserve items with optimistic locking version check.
    - `POST /api/inventory/release`: Release reserved items.
    - `POST /api/inventory/commit`: Commit reserved items to consumed state.
  - Dedicated automated test suite `apps/api/src/tests/unit/inventory-concurrency.test.ts` with 18/18 passing tests verifying invariants, multi-tenant SKU isolation, optimistic locking version conflicts, two-phase reservation lifecycle, and public API.

---

## [1.3.0] - 2026-11-07

### Added
- **Cloud Storage Adapters (AWS S3 & GCS) & Dynamic Storage Provider Factory (Sprint 06)**:
  - Implemented `S3StorageProvider` with native Node.js crypto AWS Signature Version 4 (SigV4) presigned `PUT` upload and `GET` download URL generation, zero external AWS SDK dependency bloat, and custom S3/MinIO endpoint support.
  - Implemented `GcsStorageProvider` with Google Cloud Storage V4 signed URL generator (`GOOG4-RSA-SHA256`), PEM RSA private key signing, and fallback test signing.
  - Delivered `StorageProviderFactory` supporting dynamic runtime resolution (`STORAGE_PROVIDER=LOCAL|S3|GCS`), configuration validation (`InvalidStorageConfigurationError`), and tenant-specific bucket/CDN overrides via `createForTenant`.
  - Implemented `storage-path.util.ts` domain utilities: `sanitizeStorageKey` (anti-directory traversal preventing `../` exploits and normalizing paths), `validateTenantPathIsolation` (enforces `tenants/<tenantId>/...` directory partitioning), and `buildTenantStoragePath`.
  - Configured container-mounted Docker persistent volume `monolith_storage` (`/data/storage/uploads`) in root and infrastructure `docker-compose.yml`.
  - Updated shared contracts in `@monolith/contracts/asset` with `StorageProviderType` and `StorageConfigDto`.
  - Updated `AssetModule.init()` to dynamically resolve storage engine via `StorageProviderFactory.createFromEnv()`.
  - Dedicated automated test suite `apps/api/src/tests/unit/storage-adapters.test.ts` with 24/24 passing tests verifying factory resolution, AWS S3 SigV4 signing, GCS V4 signing, CDN distribution, tenant path isolation, anti-traversal defense, and AssetModule integration.

---

## [1.2.0] - 2026-10-30

### Added
- **Asset Management Foundation & Storage Provider Abstraction (Sprint 05)**:
  - Database migration `008_asset_lifecycle_and_multitenancy.sql` introducing multi-tenancy (`tenant_id`), categorization (`category`), upload lifecycle state (`status`), and cryptographic checksum (`checksum`) to `asset.assets`.
  - Defined shared contracts in `@monolith/contracts/asset`: `AssetCategory`, `AssetStatus`, `AssetDto`, `PresignUploadRequestDto`, `PresignUploadResponseDto`, `ConfirmUploadRequestDto`, `CreateAssetRequestDto`.
  - Introduced hexagonal storage provider port `IStorageProvider` in `modules/asset/domain/services/storage-provider.interface.ts`.
  - Delivered production-grade `LocalStorageProvider` supporting direct disk I/O, directory traversal prevention, fallback in-memory cache, and URL signing simulation.
  - Implemented `AssetValidationService` enforcing strict MIME type whitelists (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `text/csv`), category file size thresholds (15MB image, 25MB PDF, 10MB CSV), extension matching, and rejection of dangerous/executable extensions.
  - Application layer use cases: `RequestPresignedUploadUseCase`, `ConfirmAssetUploadUseCase`, `GetAssetDownloadUrlQuery`, `ListTenantAssetsQuery`, `DeleteAssetUseCase`, `CreateAssetUseCase`, and `ListAssetsQuery`.
  - Presentation HTTP endpoints:
    - `POST /api/assets/presign-upload`: Presigns upload URL and reserves record in `PENDING_UPLOAD`.
    - `POST /api/assets/:id/confirm`: Verifies physical storage presence and transitions state to `ACTIVE`.
    - `GET /api/assets/:id`: Secure time-bounded download URL generation with tenant boundary checks.
    - `GET /api/assets`: Paginated listing of active tenant assets with category filtering.
    - `DELETE /api/assets/:id`: Archives asset and purges file from storage provider.
    - `PUT /api/assets/local-upload/*`: Direct streaming/raw upload simulation endpoint.
  - Dedicated automated test suite `apps/api/src/tests/unit/asset-management.test.ts` with 20/20 passing tests verifying all 7 acceptance criteria: MIME validation, file size limits, two-phase upload lifecycle, tenant quarantine (403 Forbidden), state integrity, storage provider decoupling, and controller integration.

---

## [1.1.0] - 2026-10-30

### Added
- **Dynamic Role-Based Access Control (RBAC) & Tenant Authorization (Sprint 04)**:
  - Database migration `007_iam_dynamic_rbac.sql` introducing `iam.permissions`, `iam.tenant_roles`, and `iam.tenant_role_permissions`.
  - Defined 28 granular platform permissions conforming to `<domain>:<action>` across 7 domains (IAM, Property, Caretaking, Maintenance, Finance, Rental, Document).
  - Pre-configured baseline system roles (`ORGANIZATION_OWNER`, `ORGANIZATION_ADMIN`, `PROPERTY_MANAGER`, `CARETAKER`, `FINANCE_CONTROLLER`, `LEGAL_OFFICER`, `TENANT`, `GUEST`).
  - Organization custom roles allowing tenants to define unique roles and toggle granular permission assignments within their organization boundary.
  - Domain entity `TenantRole` and persistence repository `PostgresTenantRoleRepository` with resilient fallback caching.
  - Application use cases: `CreateTenantRoleUseCase`, `UpdateRolePermissionsUseCase`, `AssignRoleToMemberUseCase`, `DeleteTenantRoleUseCase`, and queries `EvaluatePermissionQuery`, `ListTenantRolesQuery`, `GetTenantRoleQuery`.
  - Presentation authorization guards: `requirePermission` and `requirePermissions` Express middlewares enforcing deny-by-default access with RFC 7807 problem details.
  - Enforced primary organization owner invariants (owners automatically satisfy all permissions within their tenant and cannot be demoted or stripped of permissions).
  - Suspended member security enforcement: members in `SUSPENDED` status resolve to 0 permissions and are blocked with 403 Forbidden.
  - Dedicated automated test suite `apps/api/src/tests/unit/dynamic-rbac.test.ts` with 18/18 passing tests covering permission resolution, custom roles, multi-tenant boundary isolation, owner invariants, guard middleware, suspended member blocking, and dynamic MFA challenges.

---

## [1.0.0] - 2026-10-30

### Added
- **Multi-Tenant Organization & Membership Architecture (Sprint 03)**:
  - Database migration `006_iam_organizations_and_memberships.sql` introducing `iam.organizations`, `iam.organization_memberships`, and `iam.organization_invitations`.
  - Organization domain entities, value objects, and persistence repositories with dual PostgreSQL and in-memory test fallback stores.
  - Multi-tenant application commands and queries: organization registration, profile editing, status lifecycle transitions (`ACTIVE`, `SUSPENDED`, `ARCHIVED`), member invitations by email, invitation accept/reject flows, join requests, and member management.
  - Tenant context resolution middleware (`createTenantContextMiddleware`, `requireTenantMembership`, `requireOrgAdmin`) ensuring requests are strictly bounded to active user memberships and cross-tenant access is blocked with 403 Forbidden.
  - REST API surface mounted under `/api/iam/organizations*`, `/api/iam/invitations*`, and `/api/iam/me/organizations`.
  - Comprehensive multi-tenant automated test suite (18/18 passing tests) covering lifecycle, multi-org membership without user duplication, invitation workflows, and all 5 mandatory tenant isolation security tests.
- **Dedicated Documentation Structure**: Established canonical `ai/` instruction files (`PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `MODULE_MAP.md`, `DEVELOPMENT_RULES.md`, `DATA_MODEL.md`, `API_CONVENTIONS.md`, `DECISIONS.md`, `SECURITY_MODEL.md`), sprint records (`sprints/SPRINT_00.md` to `SPRINT_19.md`), handover docs (`CURRENT_STATE.md`, `CHANGELOG.md`), and `implementation/STATUS.md`.
- **Modern React Enterprise Frontend**: Delivered six dedicated views in `@monolith/web`:
  - `PropertyView`: Property portfolio, status state transitions, emergency float overview, and onboarding modal.
  - `CaretakingView`: Caretaker network roster, property delegations, granular permission toggles, and spending threshold slider.
  - `MaintenanceEquilibriumView`: Dynamic triage queue (P1-P4), emergency float badge, quotation approval workflow, and GPS photo telemetry proofs.
  - `RentalView`: Active rental listings, yield metrics, tenant lead funnel table, and lease scheduling actions.
  - `DocumentVaultView`: Property legal document repository, classification filters, verification status badges, and legal audit approval buttons.
  - `FinanceView`: Property financial ledger, cash flow summary cards, owner approval gates, and settlement execution.
- **Dynamic Multi-Tenant Theme Engine**: White-label dynamic theme generator applying organization branding, palette, and typography from `app_config.tenant_configurations`.
- **Mobile Client Hardening**: Integrated `X-Device-Fingerprint`, `X-Tenant-ID`, and `X-Correlation-ID` automated header injection in `boilerplate/mobile/src/core/api/apiClient.ts` with Expo SecureStore token persistence.

---

## [0.9.0] - 2026-10-27

### Added
- **Asymmetric RS256 Token Hardening**: Implemented RSA key management in `TokenService`, RS256 JWT signing, tenant claim propagation, and RFC 7517 compliant OpenID Connect JWKS endpoint at `/api/iam/.well-known/jwks.json`.
- **Anti-Session Hijacking**: Integrated persistent device fingerprinting (`X-Device-Fingerprint`) with User-Agent HMAC validation in `auth.middleware.ts`, while intentionally decoupling client IP from token hash to support mobile cellular/Wi-Fi roaming.
- **Dynamic MFA Route Protection**: Added `iam.mfa_protected_routes` supporting database-driven path protection with `SESSION_24H` and `EVERY_TIME` verification modes.
- **Immutable Security Audit Log**: Created `iam.audit_logs` tracking user logins, MFA challenges, permission grants, and access violations.
- **Hierarchical Multi-Tenant Config**: Built relational `app_config.tenant_configurations` supporting per-tenant branding and policy overrides with in-memory TTL caching.

---

## [0.8.0] - 2026-10-23

### Added
- **Real Estate Domain Modules in Backend API**:
  - `property`: 4-tier Clean Architecture, Address VO, emergency float limits, and lifecycle state machine.
  - `caretaking`: Caretaker profiles, property assignments, granular permission scopes, spending threshold enforcement, and instant permission revocation (`FR-ASG-010`).
  - `maintenance`: Maintenance Equilibrium Engine, dynamic priority triage (P1-P4), SLA targets, pre-authorized emergency float escrow, quotation thresholds, and anti-fraud GPS/photographic telemetry proofs.
  - `rental`: Rental listing publishing, tenant lead qualification funnel, and on-site visit scheduling.
  - `document`: Encrypted property document custody vault, classification tagging, and dual-key legal verification workflows.
  - `finance`: Property financial ledgers, double-entry expense classification, owner approval gates, and settlement invariant enforcement.
- **Shared Domain Contracts**: Added strongly typed contracts and DTOs in `@monolith/contracts`.
- **Route Registration**: Mounted business module endpoints under `/api/*` in `apps/api/src/bootstrap/register-routes.ts`.

---

## [0.5.0] - 2026-10-15

### Added
- **Monorepo Inception & Baseline Architecture**:
  - pnpm workspace scaffolding with `@monolith/api`, `@monolith/web`, and `@monolith/contracts`.
  - PostgreSQL schema isolation runner and migration harness.
  - AST-based architecture enforcement tests (`apps/api/src/tests/architecture/module-boundaries.test.ts`).
  - OWASP Top 10 security test suite (`apps/api/src/tests/security/security-controls.test.ts`).
  - Health check probes (`/health/live`, `/health/ready`).

