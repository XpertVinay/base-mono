# Sprint 12: Caretaker Assignments, Service Scopes & Instant Revocation

**Sprint ID:** `SPRINT_12`  
**Theme:** Caretaking Operations Domain — Caretaker Profiles, Multi-Tenant Property Assignments, Granular Permission Scopes & Instant Revocation  
**Status:** `COMPLETED & VERIFIED`  
**Prerequisites:** Sprints 00 through 11  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 12 formalizes the platform's **Caretaking Operations Domain (`apps/api/src/modules/caretaking`)**:
1. **Multi-Tenant Caretaker Profiles**: Caretaker identity linking, KYC verification (`PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`), police background checks, skills matrix, and service area jurisdictions.
2. **Property Assignment Lifecycle**: Formalized state machine (`PENDING_ACCEPTANCE` -> `ACTIVE` -> `TERMINATED` | `REJECTED`) scoping caretakers to specific properties within tenant boundaries, with a single active assignment invariant.
3. **Granular Service Scopes & Spending Limits**: Dynamic permission grants (`VIEW_PROPERTY`, `KEY_ACCESS`, `INSPECT_PREMISES`, `SOLICIT_QUOTES`, `AUTHORIZE_REPAIRS_WITHIN_LIMIT`, `CONDUCT_VISITS`, `COLLECT_RENT_PROOF`) coupled with owner-defined spending caps.
4. **Instant Revocation (`FR-ASG-010`)**: Atomic, immediate revocation of all active access and permissions upon assignment termination, resetting spending limits to 0 and emitting `caretaking.terminated` integration events.

---

## 2. Concrete Objectives & Implementation Scope

### 2.1 Multi-Tenant Schema & Database Migration
- Migration `014_caretaking_multitenancy_and_scopes.sql`:
  - `caretaking.profiles`: Added `tenant_id VARCHAR(64)` with compound indexes on `(tenant_id, kyc_status)`.
  - `caretaking.assignments`: Added `tenant_id VARCHAR(64)`, compound indexes on `(tenant_id, status)` and `(tenant_id, property_id)`.
  - Added `permission_scopes JSONB`, `allowed_permissions JSONB`, `spending_limit NUMERIC(12, 2)`, and `spending_threshold_limit NUMERIC(12, 2)` to assignments.

### 2.2 Shared Domain Contracts (`packages/contracts`)
- Defined DTOs in `@monolith/contracts/caretaking`:
  - `CaretakerProfileDto`, `CaretakerAssignmentDto`, `AssignCaretakerRequestDto`, `UpdateAssignmentPermissionsDto`, `TerminateAssignmentRequestDto`.
  - Domain integration events: `CaretakerAssignedEvent`, `CaretakerAssignmentAcceptedEvent`, `AssignmentTerminatedEvent`.

### 2.3 Caretaking Domain Hardening
- Updated `CaretakerProfile` and `CaretakerAssignment` aggregates with `tenantId` and state machine transitions.
- Enforced instant permission revocation on termination (`terminate()` resets permissions to empty, sets spending limit to 0, and transitions status to `TERMINATED`).

### 2.4 Application & Persistence Layer
- Updated `ICaretakingRepository` and `PostgresCaretakingRepository` with tenant filtering and snapshot cloning.
- Implemented/updated use cases: `OnboardCaretakerUseCase`, `AssignCaretakerUseCase`, `AcceptAssignmentUseCase`, `UpdatePermissionsUseCase`, `TerminateAssignmentUseCase`, `ListCaretakersQuery`, `ListAssignmentsQuery`, `GetAssignmentDetailsQuery`.

### 2.5 Presentation Layer & Event Projections
- Updated `CaretakingController` and `caretaking.routes.ts` with `x-tenant-id` extraction, route guards, and standardized JSON envelopes.
- Registered `ICaretakingModulePublicApi` in service container with active assignment resolution and permission verification.

---

## 3. Acceptance Criteria & Verifiable Gate

1. **Multi-Tenant Isolation**: Tenant B cannot view, accept, update, or terminate Tenant A's caretaker assignments. **[VERIFIED]**
2. **Instant Revocation Guard (`FR-ASG-010`)**: Terminating an assignment immediately revokes all permission scopes and sets spending limits to 0. **[VERIFIED]**
3. **Clean Architecture Guard**: `pnpm test:arch` passes with 0 violations (3/3 passing). **[VERIFIED]**
4. **Automated Test Suite**: Dedicated unit test suite (`apps/api/src/tests/unit/caretaking-assignments.test.ts`) with 100% pass rate (28/28 passing). **[VERIFIED]**
5. **Typecheck & Production Build**: `pnpm typecheck` and `pnpm build` compile with 0 type errors. **[VERIFIED]**
