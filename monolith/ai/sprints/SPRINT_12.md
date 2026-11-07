# Sprint 12: Caretaker Assignments, Service Scopes & Instant Revocation

**Sprint ID:** `SPRINT_12`  
**Theme:** Caretaking Operations Domain — Caretaker Profiles, Multi-Tenant Property Assignments, Granular Permission Scopes & Instant Revocation  
**Status:** `READY FOR IMPLEMENTATION / ACTIVE OBJECTIVE`  
**Prerequisites:** Sprints 00 through 11  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 12 formalizes the platform's **Caretaking Operations Domain (`apps/api/src/modules/caretaking`)**:
1. **Multi-Tenant Caretaker Profiles**: Caretaker identity linking, KYC verification (`PENDING`, `VERIFIED`, `REJECTED`), police background checks, skills matrix, and service area jurisdictions.
2. **Property Assignment Lifecycle**: Formalized state machine (`PENDING_ACCEPTANCE` -> `ACTIVE` -> `TERMINATED` | `REJECTED`) scoping caretakers to specific properties and units within tenant boundaries.
3. **Granular Service Scopes & Spending Limits**: Dynamic permission grants (`can_inspect`, `can_approve_minor_repair`, `can_access_lockbox`, `can_collect_rent`) coupled with owner-defined spending caps.
4. **Instant Revocation (`FR-ASG-010`)**: Atomic, immediate revocation of all active access and permissions upon assignment termination, emitting revocation integration events.

---

## 2. Concrete Objectives & Implementation Scope

### 2.1 Multi-Tenant Schema & Database Migration
- Create migration `014_caretaking_multitenancy_and_scopes.sql`:
  - `caretaking.profiles`: Add `tenant_id VARCHAR(64)` with compound indexes on `(tenant_id, kyc_status)`.
  - `caretaking.assignments`: Add `tenant_id VARCHAR(64)`, compound indexes on `(tenant_id, status)` and `(tenant_id, property_id)`.
  - Add `permission_scopes JSONB` and `spending_limit NUMERIC(12, 2)` to assignments.

### 2.2 Shared Domain Contracts (`packages/contracts`)
- Define DTOs in `@monolith/contracts/caretaking`:
  - `CaretakerProfileDto`, `CaretakerAssignmentDto`, `AssignCaretakerRequestDto`, `UpdateAssignmentPermissionsDto`.
  - Domain integration events: `CaretakerAssignedEvent`, `AssignmentTerminatedEvent`.

### 2.3 Caretaking Domain Hardening
- Update `CaretakerProfile` and `CaretakerAssignment` aggregates with `tenantId` and state machine transitions.
- Enforce instant permission revocation on termination (`terminate()` resets permissions to empty and status to `TERMINATED`).

### 2.4 Application & Persistence Layer
- Update `ICaretakingRepository` and `PostgresCaretakingRepository` with tenant filtering and snapshot cloning.
- Implement/update use cases: `AssignCaretakerUseCase`, `AcceptAssignmentUseCase`, `UpdateAssignmentPermissionsUseCase`, `TerminateAssignmentUseCase`, `ListCaretakersQuery`, `ListAssignmentsQuery`.

### 2.5 Presentation Layer & Event Projections
- Update `CaretakingController` and `caretaking.routes.ts` with `x-tenant-id` extraction.

---

## 3. Acceptance Criteria & Verifiable Gate

1. **Multi-Tenant Isolation**: Tenant B cannot view or terminate Tenant A's caretaker assignments.
2. **Instant Revocation Guard (`FR-ASG-010`)**: Terminating an assignment immediately revokes all permission scopes.
3. **Clean Architecture Guard**: `pnpm test:arch` passes with 0 violations.
4. **Automated Test Suite**: Dedicated unit test suite (`apps/api/src/tests/unit/caretaking-assignments.test.ts`) with 100% pass rate.
