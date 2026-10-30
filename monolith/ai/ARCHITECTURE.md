# Real Estate CareTaking — Technical Architecture

**Document:** `ARCHITECTURE.md`  
**Version:** 1.0  
**Status:** Mandatory Architecture Standard  
**Pattern:** Domain-Driven Design (DDD) + Modular Monolith + Event-Driven Outbox  
**Primary Language:** TypeScript / Node.js (Express)  
**Database:** PostgreSQL 16 (Schema-per-Module Isolation)  
**Frontend Stack:** React 18, TypeScript, Vite, Tailwind CSS  
**Shared Contracts:** `@monolith/contracts`

---

## 1. Architectural Philosophy & Principles

The Real Estate CareTaking platform is engineered as a **Modular Monolith** designed for high cohesion within business domains, low cross-boundary coupling, and clear extraction paths toward microservices should scale require it.

### Core Architectural Mandates
1. **Strict Module Isolation**: No module is permitted to import another module's internal files (e.g., entity, repository, or use case). Communication between modules occurs strictly via:
   - Synchronous public entry points exported in the module's root `index.ts`.
   - Asynchronous domain events published via the transactional Outbox pattern (`common.outbox_events`).
2. **Clean Architecture (4-Tier Separation)**:
   - **Domain Layer (`domain/`)**: Pure business logic, aggregates, domain entities, value objects, domain invariants, and repository interfaces. Must NEVER import Express, database drivers, or presentation libraries.
   - **Application Layer (`application/`)**: Use cases, CQRS commands, queries, application services, and event handlers. Orchestrates domain interactions.
   - **Infrastructure Layer (`infrastructure/`)**: Concrete persistence adapters (PostgreSQL, connection pools), external service integrations, and caches.
   - **Presentation Layer (`presentation/`)**: Express controllers, routes, HTTP serialization, and input validation guards.
3. **Automated Architectural Enforcement**: Module isolation and clean architecture layers are strictly validated on every CI run via AST static analysis (`pnpm test:arch`).

---

## 2. Layered Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                            HTTP Presentation Layer                                |
|  - Express Routers & Controllers                                                  |
|  - Request Validation (Zod DTOs)                                                  |
|  - Standard Response Envelopes & Error Translators                                |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                            Application Services Layer                             |
|  - Use Cases & Command Handlers (CQRS)                                            |
|  - Query Handlers                                                                 |
|  - Domain Event Subscribers & Outbox Dispatchers                                  |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                               Domain Core Layer                                   |
|  - Aggregate Roots & Entities                                                     |
|  - Value Objects (e.g., Address, Money, EmergencyFloat)                           |
|  - Domain Invariants & State Transition Rules                                      |
|  - Repository Interfaces (Ports)                                                  |
+------------------------------------------^----------------------------------------+
                                           | (Implements interfaces via DI)
+------------------------------------------+----------------------------------------+
|                          Infrastructure Adapters Layer                            |
|  - PostgreSQL Repositories (Schema-Isolated)                                      |
|  - In-Memory Fallbacks & Multi-Tier Caches                                        |
|  - Database Transaction Managers & Outbox Publisher                               |
+-----------------------------------------------------------------------------------+
```

---

## 3. Inter-Module Communication Patterns

### 3.1 Synchronous In-Process Calls
When Module A requires data or immediate synchronous orchestration from Module B:
- Module B exports a clean interface or application service via its top-level `src/modules/<module>/index.ts`.
- Module A consumes the exported service or contract DTO from `@monolith/contracts`.
- Direct database joins across schemas or deep imports into `src/modules/<module>/domain/*` are prohibited by linting and AST test rules.

### 3.2 Asynchronous Domain Events (Outbox Pattern)
When an operation in one module causes side effects in other domains (e.g., `PropertyOnboarded` -> `SearchIndexUpdated`, `MaintenanceCompleted` -> `FinanceExpenseGenerated`):
1. The domain entity raises a domain event.
2. The repository persists the entity change and writes the event into `common.outbox_events` within the same database transaction.
3. The background dispatcher reads pending events, guarantees at-least-once delivery, and dispatches them across subscriber modules.

```
[ Domain Operation ] ---> [ DB Transaction: Save Entity + Write Outbox Event ]
                                          |
                                          v
                              [ common.outbox_events ]
                                          |
                                          v
                              [ Async Outbox Dispatcher ]
                                    /           \
                                   v             v
                       [ Module B Listener ]  [ Module C Listener ]
```

---

## 4. Shared Contracts Package (`@monolith/contracts`)

All inter-module communication payloads, API contract types, request/response DTOs, and domain enumeration types reside in the workspace package `@monolith/contracts`:
- Completely decoupled from runtime framework code (zero Express or database dependencies).
- Imported identically by backend API modules, React frontend views, and mobile clients.
- Prevents contract drift and guarantees end-to-end type safety.

---

## 5. Architectural Quality Gates & CI Checks

| Verification Command | Purpose | Tolerance |
| :--- | :--- | :--- |
| `pnpm typecheck` | Full workspace TypeScript compiler validation (`--noEmit`) | 0 errors |
| `pnpm test:arch` | AST static analysis testing module boundaries and layer purity | 0 violations |
| `pnpm test:security`| OWASP security headers, RBAC deny-by-default, and input validation | 100% pass |
| `pnpm test` | Domain unit tests and behavioral use-case tests | 100% pass |
| `pnpm build` | Production Vite and TypeScript bundle generation | Clean exit |

