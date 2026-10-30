# Sprint 01: Application Foundation

**Sprint ID:** `SPRINT_01`  
**Theme:** Platform Foundation — Application Scaffolding, Database & Runtime Engine  
**Status:** `COMPLETED / VERIFIED`  
**Core Components:** Module conventions, configuration, database integration, migrations, logging, validation, exception handling

---

## 1. Objectives & Scope

1. Establish consistent module conventions across all backend modules adhering to 4-tier Clean Architecture (`domain`, `application`, `infrastructure`, `presentation`).
2. Integrate PostgreSQL 16 connection pooling (`pg.Pool`) and transactional execution.
3. Build database migration harness executing sequential SQL migrations.
4. Establish unified structured logging with correlation IDs.
5. Implement server-side input validation guards and standard HTTP error handling middleware.

---

## 2. Delivered Artifacts

- **Database Engine**:
  - `apps/api/src/infrastructure/database/connection-pool.ts`: Robust pooling with min/max connections and SSL support.
  - `apps/api/src/infrastructure/database/migrator.ts` & `run-migrations.ts`: Chronological runner with advisory locking.
  - `apps/api/src/infrastructure/database/transaction-manager.ts`: Atomic execution across multiple repositories.
- **Logging & Diagnostics**:
  - `apps/api/src/shared/infrastructure/logger.ts`: Structured JSON logging with timestamps and log levels.
  - Correlation ID injection middleware generating UUID tracing headers.
- **Validation & Error Handling**:
  - `apps/api/src/presentation/middlewares/error.middleware.ts`: Translates domain exceptions into RFC 7807 compliant JSON envelopes.
  - Zod validation pipes asserting request body and param schemas.
- **Transactional Outbox Foundation**:
  - Initial schema `001_initial_schema.sql` creating `common.outbox_events`.

---

## 3. Verification & Quality Gates

- Database migrations run cleanly and apply sequentially.
- Error handling verified via unit tests ensuring stack traces are masked in production.
- Outbox event table initialized and indexed by `status`.
