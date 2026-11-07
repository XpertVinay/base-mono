# Sprint 06: Cloud Storage Adapters (AWS S3 & GCS) & Dynamic Storage Provider Factory

**Sprint ID:** `SPRINT_06`  
**Theme:** Reusable Capabilities — AWS S3 / GCS Storage Adapters, Presigned URL Generation, Docker Storage & Factory Provider  
**Status:** `COMPLETED & VERIFIED`  
**Prerequisites:** Sprint 00 (Architecture Baseline), Sprint 01 (Database Engine), Sprint 02 (Identity & Cryptography), Sprint 03 (Multi-Tenant Organizations), Sprint 04 (Dynamic RBAC & Scoped Auth), Sprint 05 (Asset Management Foundation)  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 06 builds directly upon the `IStorageProvider` port established in Sprint 05 by delivering production-grade cloud storage adapters for **AWS S3** and **Google Cloud Storage (GCS)**, alongside an environment-driven **Storage Provider Factory**.

This sprint enables multi-tenant real estate assets (property images, inspection videos, contractor quotations, legal title deeds) to be stored in scalable object stores with client-direct presigned URL uploads and time-bounded secure download links, while retaining full local disk fallback for developer machines and offline test runners.

---

## 2. Concrete Objectives & Scope

### 2.1 AWS S3 Storage Adapter (`S3StorageProvider`)
- Implemented `IStorageProvider` backed by AWS S3 Signature Version 4 (SigV4) presigned signing.
- Generates signed `PUT` URLs with time-to-live (e.g. 900 seconds) and required headers (`Content-Type`, `X-Amz-SignedHeaders`).
- Generates signed `GET` URLs for authorized asset retrieval (e.g. 3600 seconds) with optional CDN endpoint mapping (`ASSET_CDN_BASE_URL`).
- Supports custom S3 endpoints (MinIO/LocalStack), path-style addressing (`forcePathStyle`), and temporary session credentials (`X-Amz-Security-Token`).

### 2.2 Google Cloud Storage Adapter (`GcsStorageProvider`)
- Implemented `IStorageProvider` backed by Google Cloud Storage V4 signed URL specifications (`GOOG4-RSA-SHA256`).
- Provides uniform error translation and in-memory mock fallback for offline development/testing.
- Supports optional CDN distribution endpoint routing.

### 2.3 Storage Provider Factory & Dynamic Configuration
- Implemented `StorageProviderFactory.create()`:
  - Dynamically selects provider based on `STORAGE_PROVIDER` (`LOCAL`, `S3`, `GCS`) or explicit factory options.
  - Supports runtime tenant-specific bucket overrides via `StorageProviderFactory.createForTenant(tenantId, overrides)`.
  - Validates configuration invariants, throwing `InvalidStorageConfigurationError` when required credentials or bucket names are missing.

### 2.4 Container-Mounted Persistent Volume (Docker)
- Configured Docker persistent volume (`monolith_storage`) mapped to `/data/storage/uploads` in both root and infrastructure `docker-compose.yml`.
- Standardized environment variables in `.env.example`.

### 2.5 Anti-Directory Traversal & Tenant Path Isolation
- Delivered `storage-path.util.ts`:
  - `sanitizeStorageKey`: Strips null bytes, backslashes, duplicate slashes, and `../` traversal tokens without breaking valid folder hierarchies.
  - `validateTenantPathIsolation`: Enforces strict tenant boundary checks (`tenants/<tenantId>/...`), rejecting cross-tenant path manipulations with `StoragePathValidationError`.
  - `buildTenantStoragePath`: Safely constructs standard multi-tenant asset keys (`tenants/<tenantId>/<category>/<uuid>-<filename>`).

---

## 3. Technical Specifications & Architecture

### 3.1 Infrastructure Components (`apps/api/src/modules/asset/infrastructure/storage/`)
- `s3-storage.provider.ts`: AWS S3 SigV4 adapter with zero external dependency bloat using native Node.js crypto.
- `gcs-storage.provider.ts`: Google Cloud Storage V4 adapter supporting both PEM RSA private keys and fallback signing.
- `storage-provider.factory.ts`: Dynamic factory supporting runtime provider selection and tenant bucket overrides.
- `local-storage.provider.ts`: Hardened local filesystem provider using centralized `sanitizeStorageKey`.

### 3.2 Domain Components (`apps/api/src/modules/asset/domain/services/`)
- `storage-path.util.ts`: Clean Architecture domain utility with 0 framework/presentation dependencies.
- `storage-provider.interface.ts`: Hexagonal port decoupled from infrastructure implementations.

---

## 4. Acceptance Criteria & Verifiable Gate

1. **Storage Provider Factory Invariant**: `StorageProviderFactory` cleanly produces `LocalStorageProvider`, `S3StorageProvider`, or `GcsStorageProvider` matching configured settings. `PASSED`
2. **Presigned Upload Signing**: Generated presigned URLs conform to AWS SigV4 and GCS V4 signing protocol specifications. `PASSED`
3. **Download URL Generation**: Presigned download URLs correctly embed signature parameters and TTL expiration, routing via CDN when configured. `PASSED`
4. **Tenant Path Isolation**: Object storage keys enforce multi-tenant directory partitioning (`tenants/${tenantId}/${category}/...`). `PASSED`
5. **Anti-Traversal Defense**: File storage paths containing `../` or invalid path characters are sanitized or rejected. `PASSED`
6. **Automated Unit & Integration Test Suite**: Dedicated test suite `apps/api/src/tests/unit/storage-adapters.test.ts` with 100% pass rate (24/24 tests passing). `PASSED`
7. **Clean Architecture AST Guard**: `pnpm test:arch` passes with 0 violations (3/3 passing). `PASSED`

---

## 5. Verification & Execution Evidence

- **Automated Unit Tests**: `apps/api/src/tests/unit/storage-adapters.test.ts`
  - Total Tests: 24 passed / 24 total (100% pass rate).
  - Test suites verified:
    - 1. Storage Provider Factory & Dynamic Configuration (7/7 tests passed)
    - 2. AWS S3 Storage Adapter (S3StorageProvider & SigV4) (6/6 tests passed)
    - 3. Google Cloud Storage Adapter (GcsStorageProvider & V4 Signing) (4/4 tests passed)
    - 4. Anti-Directory Traversal & Tenant Path Isolation Invariants (5/5 tests passed)
    - 5. AssetModule Integration with Pluggable Storage Providers (2/2 tests passed)
- **Asset Management Regression Suite**: `apps/api/src/tests/unit/asset-management.test.ts`
  - Total Tests: 20 passed / 20 total (100% pass rate).
- **Architecture Static Analysis**: `pnpm test:arch`
  - 3/3 passed (Strict module isolation, clean domain layer, public entry points).
- **TypeScript Typecheck**: `pnpm typecheck`
  - 0 errors across `@monolith/contracts`, `@monolith/api`, and `@monolith/web`.
- **Production Bundling**: `pnpm build`
  - Verified clean builds for `@monolith/contracts`, `@monolith/api`, and `@monolith/web`.
