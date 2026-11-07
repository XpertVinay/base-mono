# Sprint 10: Shared Services — Multi-Channel Notifications, Job Scheduler & Full-Text Search

**Sprint ID:** `SPRINT_10`  
**Theme:** Reusable Capabilities — Multi-Tenant Notifications (Email/SMS/Push/WhatsApp), Cron Scheduler & Search Indexing  
**Status:** `READY FOR IMPLEMENTATION / ACTIVE OBJECTIVE`  
**Prerequisites:** Sprint 00 (Architecture Baseline), Sprint 01 (Database Engine), Sprint 02 (Identity & Cryptography), Sprint 03 (Multi-Tenant Organizations), Sprint 04 (Dynamic RBAC & Scoped Auth), Sprint 05 (Asset Management Foundation), Sprint 06 (Cloud Storage Adapters), Sprint 07 (Multi-Tenant Inventory & Concurrency), Sprint 08 (Multi-Tenant Order Processing), Sprint 09 (Transactions & Payments)  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 10 hardens the platform's reusable **Shared Services**:
1. **Notification Module (`apps/api/src/modules/notification`)**: Multi-tenant dispatch across channels (EMAIL, SMS, PUSH, WHATSAPP) via pluggable adapters (SendGrid, Twilio, Meta WhatsApp, FCM) with dynamic database routing and dry-run outbox auditing.
2. **Scheduler Module (`apps/api/src/modules/scheduler`)**: Tenant-scoped cron task management, recurring job intervals (e.g. lease expiration reminders, SLA escalation checks, automated invoice generation), execution locks, and job run history.
3. **Search Module (`apps/api/src/modules/search`)**: Multi-tenant search document indexing, full-text ranking, entity type filtering (PROPERTY, WORK_ORDER, USER, INVOICE), and asynchronous domain event subscriber synchronization.

---

## 2. Concrete Objectives & Scope

### 2.1 Multi-Tenant Schema & Migrations
- Migration `012_shared_services_multitenancy.sql`:
  - Add `tenant_id` to `notification.notifications`, `scheduler.jobs`, `scheduler.job_runs`, and `search.documents`.
  - Compound tenant indexes on `(tenant_id, created_at DESC)` and `(tenant_id, status)`.

### 2.2 Notification Engine Hardening
- Channel-agnostic dispatch with tenant-specific provider configuration overrides.
- Outbox pattern ensuring messages are auditable, retryable, and isolated to tenant boundaries.
- Dedicated presentation endpoints under `/api/notifications`.

### 2.3 Cron Scheduler Engine
- Cron schedule parsing and job state machine (`SCHEDULED` -> `RUNNING` -> `COMPLETED` | `FAILED`).
- Tenant isolation: tenants can only manage and monitor their own recurring automation jobs.
- API endpoints under `/api/scheduler/jobs`.

### 2.4 Multi-Tenant Search Indexing
- Search document ingestion with entity type tags and full-text keyword indexing.
- Search queries strictly partitioned by requesting `tenant_id`.
- Event listener indexing orders, properties, and maintenance requests.

---

## 3. Acceptance Criteria & Verifiable Gate

1. **Multi-Tenant Quarantine**: Tenant B cannot view Tenant A's notifications, scheduled jobs, or search documents.
2. **Notification Dispatch**: Dispatches across EMAIL, SMS, PUSH, WHATSAPP with template interpolation and outbox auditing.
3. **Scheduler Execution**: Jobs execute according to schedule intervals with execution logs recorded.
4. **Search Accuracy**: Full-text search retrieves indexed documents matching keyword tokens within tenant boundaries.
5. **Clean Architecture Guard**: `pnpm test:arch` passes with 0 violations.
6. **Automated Test Suite**: Dedicated unit test suite (`src/tests/unit/shared-services.test.ts`) with 100% pass rate.
