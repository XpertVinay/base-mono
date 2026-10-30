# Sprint 05: Asset Management Foundation & Storage Provider Abstraction

**Sprint ID:** `SPRINT_05`  
**Theme:** Reusable Capabilities — File & Media Assets, MIME Validation, Storage Ports & Presigned Uploads  
**Status:** `READY FOR IMPLEMENTATION / ACTIVE OBJECTIVE`  
**Prerequisites:** Sprint 00 (Architecture Baseline), Sprint 01 (Database Engine), Sprint 02 (Identity & Cryptography), Sprint 03 (Multi-Tenant Organizations), Sprint 04 (Dynamic RBAC & Scoped Auth)  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 05 establishes the platform's unified **Asset Management** capability within `apps/api/src/modules/asset` and `@monolith/contracts`. As a real estate caretaking platform, the system handles property images, inspection photos, maintenance receipts, contractor invoices, and legal deeds.

Sprint 05 decouples media storage and validation from specific business domains by introducing:
1. Strict server-side MIME type validation and file size limits (anti-malware & DOS protection).
2. Tenant-scoped asset metadata tracking in PostgreSQL (`asset.assets`).
3. Hexagonal storage provider ports (`IStorageProvider`) enabling pluggable backend engines (local filesystem, presigned S3/GCS adapters in Sprint 06).
4. Direct client upload workflows via presigned URL generation and confirmation state transitions (`PENDING_UPLOAD` -> `ACTIVE` / `REJECTED`).

---

## 2. Concrete Objectives & Scope

### 2.1 Asset Entity & Metadata Lifecycle
- Extend `asset.assets` with multi-tenant context (`tenant_id`), upload status (`PENDING_UPLOAD`, `ACTIVE`, `QUARANTINED`, `ARCHIVED`), checksum (SHA-256), and category (`PROPERTY_IMAGE`, `INSPECTION_PHOTO`, `MAINTENANCE_RECEIPT`, `LEGAL_DOCUMENT`, `GENERAL`).
- Invariant: Assets must belong to an active organization (`tenant_id`) and track the uploading user (`owner_id`).

### 2.2 Strict File Validation & Security
- Whitelist allowable MIME types:
  - Images: `image/jpeg`, `image/png`, `image/webp` (Max 15MB)
  - Documents: `application/pdf` (Max 25MB)
  - Data: `text/csv` for property onboarding (Max 10MB)
- Reject executable, script, or unknown MIME types with 400 Bad Request.

### 2.3 Storage Provider Port & Local Disk Implementation
- Define `IStorageProvider` port in `modules/asset/domain/services/storage-provider.interface.ts`:
  - `generatePresignedUploadUrl(key: string, mimeType: string, expiresInSeconds: number): Promise<{ uploadUrl: string; storagePath: string }>`
  - `getDownloadUrl(storagePath: string, expiresInSeconds: number): Promise<string>`
  - `deleteFile(storagePath: string): Promise<void>`
  - `fileExists(storagePath: string): Promise<boolean>`
- Deliver a production-grade local storage provider (`LocalStorageProvider`) for development, automated testing, and on-premises deployments.

### 2.4 Presentation Boundary & API Endpoints
- `POST /api/assets/presign-upload`: Generates presigned upload URL and registers asset in `PENDING_UPLOAD` state.
- `POST /api/assets/:id/confirm`: Confirms file upload, verifies file existence, and transitions state to `ACTIVE`.
- `GET /api/assets/:id`: Retrieves asset metadata and secure download URL.
- `DELETE /api/assets/:id`: Soft-deletes or archives asset and schedules storage purge.
- Protect endpoints with `authenticate` and `requireTenantMembership`.

---

## 3. Technical Specifications & Architecture

### 3.1 Contracts (`packages/contracts/src/asset/`)
- Export `AssetCategory`, `AssetStatus`, `AssetDto`, `PresignUploadRequestDto`, `PresignUploadResponseDto`, `ConfirmUploadRequestDto`.

### 3.2 Database Migration (`008_asset_lifecycle_and_multitenancy.sql`)
- Alter or create `asset.assets`:
  - `id` VARCHAR(36) PRIMARY KEY
  - `tenant_id` VARCHAR(36) NOT NULL
  - `owner_id` VARCHAR(36) NOT NULL
  - `name` VARCHAR(255) NOT NULL
  - `category` VARCHAR(50) NOT NULL DEFAULT 'GENERAL'
  - `mime_type` VARCHAR(100) NOT NULL
  - `size_bytes` BIGINT NOT NULL
  - `storage_path` VARCHAR(500) NOT NULL
  - `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING_UPLOAD'
  - `checksum` VARCHAR(64)
  - `created_at` TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  - `updated_at` TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
- Indexes on `(tenant_id, status)` and `(owner_id)`.

### 3.3 Application Layer Use Cases
- `RequestPresignedUploadUseCase`: Validates MIME/size, generates storage key, reserves asset record.
- `ConfirmAssetUploadUseCase`: Verifies physical upload, activates asset.
- `GetAssetDownloadUrlQuery`: Generates time-bounded download URL.
- `ListTenantAssetsQuery`: Paginated listing of tenant assets with category filtering.

---

## 4. Acceptance Criteria & Verifiable Gate

1. **MIME Validation Gate**: Requesting presigned uploads for disallowed file extensions or MIME types (e.g., `application/x-executable`, `.exe`, `.sh`) is rejected with 400 Bad Request.
2. **File Size Invariant**: Files exceeding category size limits are rejected with 400 Bad Request.
3. **Tenant Quarantine**: Organization A cannot view, download, or delete assets owned by Organization B.
4. **Lifecycle State Integrity**: Assets in `PENDING_UPLOAD` are not returned in standard queries until confirmed `ACTIVE`.
5. **Storage Provider Decoupling**: Application and domain layers interact exclusively through `IStorageProvider` port.
6. **Automated Test Suite**: Dedicated unit test suite `apps/api/src/tests/unit/asset-management.test.ts` with 100% pass rate.
7. **Clean Architecture AST Guard**: `pnpm test:arch` passes with 0 violations.
