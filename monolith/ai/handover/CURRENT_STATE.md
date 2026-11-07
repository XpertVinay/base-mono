# Real Estate CareTaking — Handover Current State

**Document:** `CURRENT_STATE.md`  
**Version:** 1.0  
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
- Property asset registration with Address Value Objects and category validation.
- Emergency float limit configuration for automated emergency triage.
- State machine lifecycle (`DRAFT` -> `UNDER_VERIFICATION` -> `VERIFIED` -> `ACTIVE` -> `INACTIVE`).

### 3. Caretaking & Assignment Domain (`caretaking`)
- Caretaker onboarding with KYC and police verification states.
- Property assignment aggregate with granular permission scopes.
- Spending threshold limit enforcement for minor repairs.
- Instant permission revocation upon assignment termination (`FR-ASG-010`).

### 4. Maintenance Equilibrium Engine (`maintenance`)
- Priority triage matrix (P1 Emergency, P2 Urgent, P3 Standard, P4 Routine).
- Automated SLA response/resolution matrix.
- Pre-authorized emergency float escrow mobilization for P1 emergencies.
- Contractor quotation approval thresholds for non-emergency repairs.
- Anti-fraud GPS check-in verification and photographic before/after telemetry proofs.

### 5. Rental & Tenancy Pipeline (`rental`)
- Rental listing publishing, security deposit management, and furnishing status.
- Tenant lead funnel tracking from inquiry to lease signing.
- Accompanied on-site visit scheduling.

### 6. Legal Document Custody Vault (`document`)
- Encrypted document storage for Title Deeds, Tax Receipts, Khata, and Encumbrance Certificates.
- Dual-key legal verification and rejection workflows with audit logging.

### 7. Financial Ledgers (`finance`)
- Property financial ledgers tracking income and maintenance expenditures.
- Owner approval gates for expenses exceeding caretaker delegation limits.
- Settlement invariant enforcement ensuring disbursements match approved expense records.

### 8. Asset Management Domain (`asset`)
- **Two-Phase Upload Lifecycle**: Client-direct upload workflow (`PENDING_UPLOAD` -> `ACTIVE` -> `ARCHIVED`) preventing unverified or incomplete files from entering the active catalog.
- **Strict Server-Side MIME & Extension Validation**: Whitelisted MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `text/csv`) with category size thresholds (15MB image, 25MB PDF, 10MB CSV); immediate 400 Bad Request rejection for executable/script MIME types (`.exe`, `.sh`, `.bat`, `.bin`, `.js`).
- **Hexagonal Storage Port Decoupling**: Application and domain layers interact exclusively through `IStorageProvider` port, supported by a production-grade `LocalStorageProvider` for local disk and offline environments.
- **Tenant Asset Isolation & Boundary Enforcement**: Assets strictly partitioned by `tenant_id` and storage path (`tenants/${tenantId}/${category}/...`); cross-tenant read, download, confirm, or delete attempts rejected with 403 Forbidden.
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

---

## 3. Latest Verification & Quality Gate Results

- **TypeScript Typecheck (`pnpm typecheck`)**: 0 errors across all workspace projects (`@monolith/contracts`, `@monolith/api`, `@monolith/web`).
- **Architecture Static Analysis (`pnpm test:arch`)**: 3/3 tests passed.
  - No cross-module internal file imports.
  - Domain layer completely isolated from Express, pg, or HTTP dependencies.
  - All modules export a clean top-level `index.ts`.
- **Inventory Concurrency & Isolation Suite (`inventory-concurrency.test.ts`)**: 18/18 tests passed.
  - Stock mathematical equilibrium invariant, multi-tenant SKU isolation, optimistic locking version conflicts, two-phase reservation lifecycle, and public API.
- **Cloud Storage Adapters Test Suite (`storage-adapters.test.ts`)**: 24/24 tests passed.
  - StorageProviderFactory dynamic resolution, validation, and tenant bucket overrides.
  - AWS S3 SigV4 presigned upload and download URLs, TTL expiration, and custom endpoints.
  - GCS V4 signed URLs and CDN distribution routing.
  - Anti-directory traversal path sanitization and tenant path isolation.
  - AssetModule pluggable storage engine integration.
- **Asset Management Test Suite (`asset-management.test.ts`)**: 20/20 tests passed.
  - MIME type validation gate, file size invariant limits, presigned upload & confirmation lifecycle.
  - 100% tenant quarantine verification (Org B blocked from Org A assets with 403 Forbidden).
  - Lifecycle state integrity, storage provider port decoupling, and presentation controller integration.
- **Multi-Tenant Organization Test Suite (`multi-tenant-organizations.test.ts`)**: 18/18 tests passed.
  - Full organization lifecycle, multi-org user membership, invitations, and member status transitions.
  - All 5 mandatory security tests passed (unauthorized membership rejection, suspended member blocking, cross-tenant isolation, identifier tampering defense, and multi-org context switching).
- **Dynamic RBAC & Tenant Authorization Suite (`dynamic-rbac.test.ts`)**: 18/18 tests passed.
  - Granular domain permission resolution across all 7 platform domains.
  - Primary organization owner full permission invariant and demotion defense.
  - Custom tenant roles and role-permission overrides within organization boundary.
  - Deny-by-default `requirePermission` / `requirePermissions` presentation guards with 403 Forbidden.
  - Suspended member access blocking.
  - Dynamic MFA route challenge integration.
- **Security Validation (`pnpm test:security`)**: OWASP headers, deny-by-default RBAC, input sanitization passing.
- **Client Bundling (`pnpm build`)**: Clean build output generated for `@monolith/web` and `@monolith/api`.

---

## 4. Environment & Deployment Setup

Ensure the following environment variables are configured in `.env` (refer to `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/realestate_db
DB_POOL_MIN=2
DB_POOL_MAX=20

# IAM Cryptography
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
JWT_KEY_ID="monolith-rsa-key-1"
FINGERPRINT_SECRET=super-secret-device-fingerprint-salt
REFRESH_TOKEN_SECRET=32-byte-hex-string-for-aes-256-gcm

# Storage Engine (Sprint 05 & 06)
STORAGE_PROVIDER=LOCAL
LOCAL_STORAGE_DIR=/data/storage/uploads

# Server
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://app.realestatecare.com
```

---

## 5. Active Sprint & Immediate Next Steps

In strict adherence to the project's core engineering principles:
- **One Sprint, One Objective**: Focus is strictly quarantined to a single bounded domain per sprint.
- **Repository as Memory**: Ground-truth status is maintained in-repo without chat dependency.
- **Evidence-Based Progression**: Only code, migrations, and passing automated tests determine milestone completion.
- **Just-In-Time Specifications**: Upfront speculative sprint specs (06-19) have been pruned; specifications are detailed iteratively on a rolling window.

### Current Milestone State:
- **Sprint 00 (Architecture Baseline)**: `COMPLETED & VERIFIED` (AST boundary tests passing 3/3, 0 typecheck errors).
- **Sprint 01 (Application Foundation)**: `COMPLETED & VERIFIED` (Database pool, migration harness, logger, error middleware).
- **Sprint 02 (Identity & Cryptography)**: `COMPLETED & VERIFIED` (RS256 JWT, JWKS endpoint, AES-GCM refresh tokens, fingerprinting).
- **Sprint 03 (Multi-Tenant Organizations)**: `COMPLETED & VERIFIED` (Organizations, memberships, invitations, tenant context middleware, 18/18 tests passing).
- **Sprint 04 (Dynamic RBAC & Scoped Authorization)**: `COMPLETED & VERIFIED` (Dynamic roles, tenant-scoped permissions, `requirePermission` guard, 18/18 tests passing).
- **Sprint 05 (Asset Management Foundation)**: `COMPLETED & VERIFIED` (Two-phase presigned upload lifecycle, MIME validation, storage ports, 20/20 tests passing).
- **Sprint 06 (Cloud Storage Adapters: AWS S3 & GCS)**: `COMPLETED & VERIFIED` (AWS S3 SigV4, GCS V4, StorageProviderFactory, Docker volume, 24/24 tests passing).
- **Sprint 07 (Multi-Tenant Inventory & Concurrency)**: `COMPLETED & VERIFIED` (Multi-tenant inventory, optimistic locking versioning, two-phase reservations, 18/18 tests passing).
- **Sprint 08 (Orders & Fulfillment Core Domain)**: `ACTIVE / READY FOR IMPLEMENTATION` (Detailed specification defined in `ai/sprints/SPRINT_08.md`).

### Immediate Next Single Action:
1. **Execute Sprint 08**: Implement multi-tenant order lifecycle, pricing calculation, inventory integration, and automated test coverage.

