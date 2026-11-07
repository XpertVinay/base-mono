# Sprint 10: Shared Services — Multi-Channel Notifications, Job Scheduler & Full-Text Search

**Sprint ID:** `SPRINT_10`  
**Theme:** Reusable Capabilities — Multi-Tenant Notifications (Email/SMS/Push/WhatsApp), Cron Scheduler & Search Indexing  
**Status:** `COMPLETED & VERIFIED`  
**Prerequisites:** Sprints 00 through 09  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 10 fully hardened and unified the platform's reusable **Shared Services**:
1. **Notification Module (`apps/api/src/modules/notification`)**: Multi-tenant dispatch across channels (`EMAIL`, `SMS`, `PUSH`, `WHATSAPP`, `IN_APP`) via pluggable adapters (SendGrid, Twilio, Meta WhatsApp, FCM, Mock) with dynamic database routing, template data interpolation, and developer dry-run outbox auditing partitioned by `tenantId`.
2. **Scheduler Module (`apps/api/src/modules/scheduler`)**: Tenant-scoped cron task management, state machine lifecycle (`SCHEDULED` -> `RUNNING` -> `COMPLETED` | `FAILED`), execution error logging, and historical execution logging (`scheduler.job_runs`).
3. **Search Module (`apps/api/src/modules/search`)**: Multi-tenant search document indexing, entity type filtering (`PROPERTY`, `ORDER`, `USER`, `MAINTENANCE`, `FINANCE`), keyword token matching, and asynchronous integration event subscribers (`orders.order_created`, `iam.user_registered`).

---

## 2. Concrete Objectives & Implementation Summary

### 2.1 Multi-Tenant Schema & Migrations
- Migration `012_shared_services_multitenancy.sql`:
  - Added `tenant_id VARCHAR(64)` to `notification.notifications`, `scheduler.jobs`, and `search.search_index`.
  - Created `scheduler.job_runs` table with columns: `id`, `job_id`, `tenant_id`, `status`, `started_at`, `completed_at`, `duration_ms`, `failure_reason`.
  - Added indexes on `(tenant_id, created_at DESC)`, `(tenant_id, status)`, `idx_job_runs_job`, `idx_job_runs_tenant`, `idx_search_tenant`, `idx_search_tenant_type`.

### 2.2 Notification Engine Hardening
- Updated `Notification` entity with `tenantId` in props, getters, and reconstitute logic.
- Updated `SendNotificationUseCase` with template interpolation (`{{key}}` syntax) for `subject` and `body`.
- Updated all adapters (`SendGridEmailAdapter`, `TwilioSmsAdapter`, `MetaWhatsAppAdapter`, `FcmPushAdapter`, `MockNotificationAdapter`) to record `tenantId` in `DryRunOutboxService`.
- Replaced null returns with fail-closed `NotFoundError` on cross-tenant notification lookups.
- Wired asynchronous integration event listeners for `orders.order_created` and `iam.user_registered` with tenant context.

### 2.3 Cron Scheduler Engine
- Updated `ScheduledJob` entity with `tenantId`, `startExecution()`, `recordExecutionSuccess(nextRunAt?)`, and `recordExecutionFailure(reason?)`.
- Implemented `ISchedulerRepository` with `findById`, `findByName`, `findAll`, `save`, `saveJobRun`, `findJobRuns`.
- Implemented `TriggerJobUseCase` executing registered tasks or no-op heartbeats, capturing execution durations and persisting run records to `scheduler.job_runs`.
- Implemented `ListJobRunsQuery` and `GetJobByIdQuery`.
- Updated `SchedulerController` with `x-tenant-id` header resolution and route bindings under `/api/scheduler/jobs`.

### 2.4 Multi-Tenant Search Indexing
- Updated `SearchDocument` entity with `tenantId`, getters, and static factory methods.
- Implemented `ISearchRepository` with `index`, `search`, `findById`, and `delete`.
- Implemented `PostgresSearchRepository` with token-based keyword search across `title` and `description`, entity type filtering, and strict tenant partitioning.
- Subscribed to `orders.order_created` and `iam.user_registered` to automatically project domain aggregates into the search index with their respective `tenantId`.

---

## 3. Acceptance Criteria & Verifiable Gate

| Metric / Requirement | Target | Achieved | Status |
| :--- | :--- | :--- | :--- |
| **Multi-Tenant Quarantine** | Fail-closed isolation across all 3 modules | Verified (Cross-tenant 404 / empty search results) | **PASS** |
| **Multi-Channel Dispatch** | EMAIL, SMS, WHATSAPP, PUSH, IN_APP | Verified via dedicated adapter simulators | **PASS** |
| **Template Interpolation** | Interpolate `{{key}}` placeholders | Verified (`Hello {{name}}` -> `Hello Alice`) | **PASS** |
| **Developer Dry-Run Outbox** | Retain simulated dispatches per tenant | Verified (`dryRunOutbox.getAll(tenantId)`) | **PASS** |
| **Job Execution Lifecycle** | SCHEDULED -> RUNNING -> COMPLETED / FAILED | Verified with run history records | **PASS** |
| **Full-Text Search Accuracy** | Keyword tokens + entity type filtering | Verified across PROPERTY, USER, MAINTENANCE | **PASS** |
| **Clean Architecture AST** | 0 violations (`pnpm test:arch`) | 3/3 tests passed, 0 violations | **PASS** |
| **Automated Unit Tests** | Dedicated unit test suite | 20/20 passed (`shared-services.test.ts`) | **PASS** |
| **Cumulative Regression** | All core capabilities green | 102/102 passed across 5 test suites | **PASS** |
| **Production Build** | Clean build for contracts, api, web | 0 TypeScript errors, 100% build pass | **PASS** |

---

## 4. Verification Evidence

- **Unit Test Execution:**
  ```text
  ✓ src/tests/unit/shared-services.test.ts (20 tests) 58ms
  Test Files  1 passed (1)
  Tests       20 passed (20)
  ```
- **Cumulative Regression Execution:**
  ```text
  Test Files  5 passed (5)
  Tests       102 passed (102)
  Duration    950ms
  ```
- **Architecture Enforcement:**
  ```text
  ✓ Modular Monolith Architecture Enforcement > Strict Module Isolation: No module may import another module's internal files 37ms
  ✓ Modular Monolith Architecture Enforcement > Clean Architecture: Domain layer must NEVER depend on Express, pg, or HTTP presentation 2ms
  ✓ Modular Monolith Architecture Enforcement > All business modules must expose a public index.ts entry point 0ms
  Test Files  1 passed (1)
  Tests       3 passed (3)
  ```
- **Typecheck & Monorepo Build:**
  - `pnpm -r run typecheck`: Passed cleanly across all 5 workspace projects.
  - `pnpm -r run build`: `@monolith/contracts` (tsc), `@monolith/api` (tsc), `@monolith/web` (vite build) completed with 0 errors.
