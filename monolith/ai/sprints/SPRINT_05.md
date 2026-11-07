# Sprint 05: Asset Management Foundation & Storage Provider Abstraction

**Sprint ID:** `SPRINT_05`  
**Theme:** Reusable Capabilities — File & Media Assets, MIME Validation, Storage Ports & Presigned Uploads  
**Status:** `COMPLETED & VERIFIED`  
**Prerequisites:** Sprint 00 (Architecture Baseline), Sprint 01 (Database Engine), Sprint 02 (Identity & Cryptography), Sprint 03 (Multi-Tenant Organizations), Sprint 04 (Dynamic RBAC & Scoped Auth)  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 05 establishes the platform's unified **Asset Management** capability within `apps/api/src/modules/asset` and `@monolith/contracts`. As a real estate caretaking platform, the system handles property images, inspection photos, maintenance receipts, contractor invoices, and legal deeds.

Sprint 05 decouples media storage and validation from specific business domains by introducing:
1. Strict server-side MIME type validation and file size limits (anti-malware & DOS protection).
2. Tenant-scoped asset metadata tracking in PostgreSQL (`asset.assets`).
3. Hexagonal storage provider ports (`IStorageProvider`) enabling pluggable backend engines (local filesystem, presigned S3/GCS adapters).
4. Direct client upload workflows via presigned URL generation and confirmation state transitions (`PENDING_UPLOAD` -> `ACTIVE` / `ARCHIVED`).

---

## 2. Concrete Objectives & Scope

### 2.1 Asset Entity & Metadata Lifecycle
- Extended `asset.assets` with multi-tenant context (`tenant_id`), upload status (`PENDING_UPLOAD`, `ACTIVE`, `QUARANTINED`, `ARCHIVED`), checksum (SHA-256), and category (`PROPERTY_IMAGE`, `INSPECTION_PHOTO`, `MAINTENANCE_RECEIPT`, `LEGAL_DOCUMENT`, `GENERAL`).
- Invariant: Assets must belong to an active organization (`tenant_id`) and track the uploading user (`owner_id`).

### 2.2 Strict File Validation & Security
- Whitelist allowable MIME types:
  - Images: `image/jpeg`, `image/png`, `image/webp` (Max 15MB)
  - Documents: `application/pdf` (Max 25MB)
  - Data: `text/csv` for property onboarding (Max 10MB)
- Rejection of executable, script, or unknown MIME types and dangerous extensions (`.exe`, `.sh`, `.bat`, `.bin`, `.js`, etc.) with 400 Bad Request.

### 2.3 Storage Provider Port & Local Disk Implementation
- Defined `IStorageProvider` port in `modules/asset/domain/services/storage-provider.interface.ts`:
  - `generatePresignedUploadUrl(key: string, mimeType: string, expiresInSeconds: number): Promise<{ uploadUrl: string; storagePath: string }>`
  - `getDownloadUrl(storagePath: string, expiresInSeconds: number): Promise<string>`
  - `deleteFile(storagePath: string): Promise<void>`
  - `fileExists(storagePath: string): Promise<boolean>`
- Delivered production-grade `LocalStorageProvider` supporting direct disk I/O, fallback memory registry, and URL signing simulation.

### 2.4 Presentation Boundary & API Endpoints
- `POST /api/assets/presign-upload`: Generates presigned upload URL and registers asset in `PENDING_UPLOAD` state.
- `POST /api/assets/:id/confirm`: Confirms file upload, verifies file existence, and transitions state to `ACTIVE`.
- `GET /api/assets/:id`: Retrieves asset metadata and secure download URL.
- `GET /api/assets`: Paginated listing of active tenant assets with category filtering.
- `DELETE /api/assets/:id`: Archives asset and purges physical file.
- `PUT /api/assets/local-upload/*`: Stream/raw upload simulation endpoint for local environments.
- Maintained legacy backwards compatibility endpoints (`POST /api/assets`, `GET /api/assets/my`).

---

## 3. Technical Specifications & Architecture

### 3.1 Contracts (`packages/contracts/src/asset/`)
- Exported:
  - `AssetCategory`: `'PROPERTY_IMAGE' | 'INSPECTION_PHOTO' | 'MAINTENANCE_RECEIPT' | 'LEGAL_DOCUMENT' | 'GENERAL'`
  - `AssetStatus`: `'PENDING_UPLOAD' | 'ACTIVE' | 'QUARANTINED' | 'ARCHIVED'`
  - `AssetDto`, `PresignUploadRequestDto`, `PresignUploadResponseDto`, `ConfirmUploadRequestDto`, `CreateAssetRequestDto`.

### 3.2 Database Migration (`008_asset_lifecycle_and_multitenancy.sql`)
- Altered `asset.assets`:
  - `tenant_id` VARCHAR(36) NOT NULL DEFAULT 'default-tenant'
  - `category` VARCHAR(50) NOT NULL DEFAULT 'GENERAL'
  - `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING_UPLOAD'
  - `checksum` VARCHAR(64)
- Indexes on `(tenant_id, status)` and `(owner_id)`.

### 3.3 Application Layer Use Cases
- `RequestPresignedUploadUseCase`: Validates MIME/size/extension, generates storage key, reserves asset record.
- `ConfirmAssetUploadUseCase`: Verifies physical upload via storage port, activates asset.
- `GetAssetDownloadUrlQuery`: Generates time-bounded download URL with tenant boundary checks.
- `ListTenantAssetsQuery`: Paginated listing of tenant assets with default `ACTIVE` status filtering.
- `DeleteAssetUseCase`: Archives asset and purges file from storage provider.

---

## 4. Acceptance Criteria & Verifiable Gate

1. **MIME Validation Gate**: Requesting presigned uploads for disallowed file extensions or MIME types (e.g., `application/x-executable`, `.exe`, `.sh`) is rejected with 400 Bad Request. `PASSED`
2. **File Size Invariant**: Files exceeding category size limits (15MB image, 25MB PDF, 10MB CSV) are rejected with 400 Bad Request. `PASSED`
3. **Tenant Quarantine**: Organization A cannot view, download, confirm, or delete assets owned by Organization B (403 Forbidden). `PASSED`
4. **Lifecycle State Integrity**: Assets in `PENDING_UPLOAD` are not returned in standard queries until confirmed `ACTIVE`. `PASSED`
5. **Storage Provider Decoupling**: Application and domain layers interact exclusively through `IStorageProvider` port. `PASSED`
6. **Automated Test Suite**: Dedicated unit test suite `apps/api/src/tests/unit/asset-management.test.ts` with 100% pass rate. `PASSED`
7. **Clean Architecture AST Guard**: `pnpm test:arch` passes with 0 violations. `PASSED`

---

## 5. Verification & Execution Evidence

- **Automated Unit Tests**: `apps/api/src/tests/unit/asset-management.test.ts`
  - Total Tests: 20 passed / 20 total (100% pass rate).
  - Test suites verified: MIME validation, file size limits, presigned upload & confirmation lifecycle, tenant quarantine, lifecycle state integrity, soft delete & purge, storage provider port decoupling, presentation controller integration.
- **Architecture Static Analysis**: `pnpm test:arch`
  - 3/3 passed (Strict module isolation, clean domain layer, public entry points).
- **TypeScript Typecheck**: `pnpm typecheck`
  - 0 errors across `@monolith/contracts`, `@monolith/api`, and `@monolith/web`.
- **Production Bundling**: `pnpm build`
  - Verified clean builds for `@monolith/contracts`, `@monolith/api`, and `@monolith/web`.
