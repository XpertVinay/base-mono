# Sprint 13: Vendor Management, Trade Categories & Rate Cards

**Sprint ID:** `SPRINT_13`  
**Theme:** Vendor Operations Domain — Vendor Onboarding, Trade Specializations, Multi-Tenant Rate Cards & Service Work Orders  
**Status:** `READY FOR IMPLEMENTATION / ACTIVE OBJECTIVE`  
**Prerequisites:** Sprints 00 through 12  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 13 formalizes the platform's **Vendor Management Domain (`apps/api/src/modules/vendor`)**:
1. **Multi-Tenant Vendor Profiles**: Vendor onboarding, business registration/tax identifiers (GST/PAN/EIN), trade licenses, insurance certificates, and verification status (`PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`).
2. **Trade Categories & Specializations**: Classification into industry trades (Plumbing, Electrical, HVAC, Carpentry, Painting, Masonry, Pest Control, Cleaning, Structural Repairs).
3. **Multi-Tenant Rate Cards**: Standardized service rate schedules (base labor rates, standard unit prices, emergency off-hours multiplier) scoped per vendor and tenant organization.
4. **Integration with Maintenance Domain**: Providing public contracts for quotation requests, SLA commitments, and payment disbursement accounts.

---

## 2. Concrete Objectives & Implementation Scope

### 2.1 Multi-Tenant Schema & Database Migration
- Create migration `015_vendor_management_and_rate_cards.sql`:
  - `vendor.profiles`: Add `tenant_id VARCHAR(64)` with compound indexes on `(tenant_id, verification_status)` and `(tenant_id, trade_categories)`.
  - `vendor.rate_cards`: Add `tenant_id VARCHAR(64)`, compound indexes on `(tenant_id, vendor_id)` and `(tenant_id, trade_category)`.

### 2.2 Shared Domain Contracts (`packages/contracts`)
- Define DTOs in `@monolith/contracts/vendor`:
  - `VendorProfileDto`, `VendorRateCardDto`, `OnboardVendorRequestDto`, `CreateRateCardRequestDto`.
  - Domain integration events: `VendorVerifiedEvent`, `VendorRateCardUpdatedEvent`.

### 2.3 Vendor Domain Hardening
- Implement/harden `VendorProfile` and `VendorRateCard` aggregates with `tenantId` and state machine transitions.
- Enforce trade category and rate card positive pricing invariants.

### 2.4 Application & Persistence Layer
- Implement `IVendorRepository` and `PostgresVendorRepository` with tenant filtering and snapshot cloning.
- Implement use cases: `OnboardVendorUseCase`, `VerifyVendorUseCase`, `SetVendorRateCardUseCase`, `ListVendorsQuery`, `GetVendorRateCardQuery`.

### 2.5 Presentation Layer & Event Projections
- Implement `VendorController` and `vendor.routes.ts` with `x-tenant-id` extraction.

---

## 3. Acceptance Criteria & Verifiable Gate

1. **Multi-Tenant Isolation**: Tenant B cannot view or modify Tenant A's vendors or rate cards.
2. **Trade Category Invariants**: Valid trade classifications and positive labor/unit rates.
3. **Clean Architecture Guard**: `pnpm test:arch` passes with 0 violations.
4. **Automated Test Suite**: Dedicated unit test suite (`apps/api/src/tests/unit/vendor-management.test.ts`) with 100% pass rate.
