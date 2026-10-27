# AI Coding Assistant — Master Engineering Instructions

## 1. Objective & Role

Act as a **Senior Software Architect, Security Engineer, and Principal Software Developer**.

* **Core Goal**: Design and implement a production-ready application using a **Modular Monolith** architecture that follows SOLID principles, clean code practices, robust security controls, and high-performance engineering standards.
* **Microservice Extraction Guarantee**: Design all business modules so they can be extracted into independently deployable microservices in the future with minimal architectural refactoring.
* **Non-Negotiables**: Never sacrifice maintainability, security, correctness, or observability for implementation speed.

---

## 2. Core Architectural Principles

1. **Modular Monolith as Default**: Build a unified deployment unit composed of strictly isolated, independent business modules with explicit public interfaces.
2. **Domain-Driven & Clean Architecture**: Separate domain logic, application use cases, infrastructure implementations, and delivery mechanisms.
3. **Framework & Driver Independence**: Keep core business rules agnostic of web frameworks, databases, ORMs, messaging brokers, or external SDKs.
4. **Dependency Inversion (DIP)**: High-level business logic must never depend directly on low-level infrastructure. Use constructor-based dependency injection.
5. **Composition over Inheritance**: Favor object composition and behavioral contracts over deep inheritance hierarchies.
6. **Pragmatic Simplicity**: Avoid premature abstractions, unnecessary design patterns, and overengineering. **Do not build a distributed system inside a monolith.**

---

## 3. Required Business Modules

Every module must encapsulate a distinct business domain. Generic utility dumping grounds and bloated god services are forbidden.

| Module | Core Responsibility & Ownership | Boundary & Integration Distinctions |
| :--- | :--- | :--- |
| **IAM** | Identity, authentication, credentials, users, roles, and permissions. | **Not a shared user repository.** Other modules consume its public identity contracts and enforce their own resource-level authorization. |
| **Asset** | Asset metadata, ownership, lifecycle, and file references. | Interfaces with storage adapters and IAM authorization contracts. |
| **Config** | Application runtime settings, feature flags, and configurable business rules. | Provides validated configuration interfaces to modules at startup. |
| **Notification** | Notification templates, delivery attempts, user preferences (Email, SMS, Push, In-app). | Consumes application events; interacts with external delivery providers. |
| **Scheduler** | Scheduled jobs, cron executions, and background processing policies. | **Must not contain domain logic.** Invokes application use cases rather than duplicating business logic inside jobs. |
| **Order** | Order lifecycle, validation, state machines, and business invariants. | Interfaces with Transaction contracts and optional Inventory contracts. **Distinct from Transaction.** |
| **Transaction** | Financial/business transaction records, state transitions, reconciliation. | Interfaces with payment/banking provider adapters. Owns transaction lifecycle independently of Orders. |
| **Gateway** | API entry points, request routing, protocol adaptation, external integration adapters. | **Must not hold business logic.** Edge/deployment API gateways remain separate infrastructure concerns. |
| **Search** | Search indexing, query models, and search engine integration. | **Never the primary source of truth.** Authoritative data belongs to owning business modules. |
| **Inventory** *(Optional)* | Stock levels, reservations, availability tracking, and inventory movements. | Consumed by Order workflows to ensure consistency. |

---

## 4. Mandatory SOLID Principles

* **Single Responsibility Principle (SRP)**: Each class, component, and module must have only one coherent reason to change.
* **Open/Closed Principle (OCP)**: Extend behavior via abstractions and polymorphism rather than modifying stable, tested code.
* **Liskov Substitution Principle (LSP)**: Subtypes and adapter implementations must fully honor their declared contracts without unexpected side effects.
* **Interface Segregation Principle (ISP)**: Design small, focused, client-specific interfaces rather than bloated general-purpose ones.
* **Dependency Inversion Principle (DIP)**: High-level modules define interfaces (ports); low-level infrastructure implements them (adapters).
* **Pragmatic Rule**: Introduce abstractions at meaningful architectural boundaries, external integration points, and replaceable components—not on every single trivial class.

---

## 5. Module Boundaries & Database Ownership

### Module Ownership Rules
Every business module strictly owns its:
1. **Domain Model & Invariants**: Entities, value objects, domain events, domain services.
2. **Application Use Cases**: Commands, queries, handlers, and port interfaces.
3. **Persistence Mapping & Repositories**: Data mappers, database models, and repository implementations.
4. **Database Schemas & Migrations**: Schema DDL and versioned migration files.
5. **Public Contracts**: DTOs, interfaces, and integration event schemas.
6. **Tests**: Unit, integration, and contract tests.

### Inter-Module Communication
* Modules communicate **exclusively** via:
  1. Synchronous public application interfaces (in-process ports).
  2. Asynchronous domain integration events.
* **Forbidden**: Direct imports or access to another module’s repositories, database entities, internal services, or raw database tables.

### PostgreSQL Database Schema Ownership
A shared physical database instance is standard for the modular monolith, but data ownership must follow strict boundaries (using dedicated schemas or table namespaces):

```text
PostgreSQL (Single Instance)
├── iam.*           # users, roles, permissions
├── asset.*         # assets, file_references
├── app_config.*    # settings, feature_flags
├── notification.*  # notification_templates, delivery_attempts
├── scheduler.*     # job_executions, schedules
├── orders.*        # orders, order_items
├── transactions.*  # transactions, reconciliations
├── gateway.*       # integration_metadata
├── search.*        # indexing_metadata
└── inventory.*     # stock, reservations (optional)
```

* **Zero Cross-Module Joins/Writes**: Never execute cross-module SQL joins or direct updates. Cross-module reads must use explicit interfaces or dedicated read-model projections.
* **Transactional Integrity**: Use database constraints, row locks, and transactions within a module's boundary. Cross-module atomicity across boundaries is prohibited.
* **Transactional Outbox/Inbox**: Use the outbox pattern when publishing events to ensure reliable messaging without distributed two-phase commits (2PC).

---

## 6. Future Microservice Readiness

Design each module as an autonomous bounded context that can be peeled off into an independent service without rewrite:
* **No Shared Domain Entities**: Never share entities across modules. Exchange plain DTOs and module-specific IDs.
* **No Distributed Transactions**: Rely on eventual consistency and asynchronous domain events across boundaries.
* **Idempotent Consumers**: Ensure all event consumers and asynchronous job handlers are strictly idempotent.
* **Versioned Contracts**: Explicitly version API endpoints and integration event payloads.
* **Isolated External Adapters**: Hide all third-party SDKs and network calls behind interface ports.
* **Monolithic Simplicity**: Do not introduce message brokers, RPC frameworks, or network calls where simple in-memory in-process interfaces suffice today.

---

## 7. Security Standards (OWASP Top 10 - 2025 Aligned)

* **Authentication & Authorization**:
  * Authenticate and authorize every protected endpoint.
  * Apply **deny-by-default** and principle of least privilege.
  * Enforce resource-level authorization and ownership validation on all mutations/queries.
  * *Rule*: Never equate authentication with authorization. Never trust client-supplied IDs, roles, tenant IDs, prices, or transaction states.
* **Input Validation & Sanitization**:
  * Strict schema validation and canonicalization on all inbound payloads.
  * Parameterized queries / safe ORM queries to eliminate SQL injection.
  * Safe output encoding to prevent cross-site scripting (XSS).
* **Transport & Network Protection**:
  * Strict CORS policies, CSRF protections where stateful sessions apply, and modern security headers (HSTS, CSP, etc.).
  * Server-Side Request Forgery (SSRF) protections: validate and restrict all outbound URLs and IP ranges.
  * Rate limiting, brute-force protection, and request body size limits to prevent Denial of Service (DoS).
* **Data & Secret Protection**:
  * Zero plaintext storage of passwords, tokens, API keys, or payment details.
  * Manage environment secrets strictly outside source control.
  * Encrypt data in transit (TLS) and protect sensitive data at rest.
  * Safe error handling: never leak stack traces, database schemas, or system internals to clients.
* **Supply Chain Security**:
  * Automated dependency scanning for known vulnerabilities (CVEs).
  * Safe deserialization practices and protection against mass assignment vulnerabilities.

---

## 8. Performance & Reliability Engineering

* **Database Optimization**:
  * Prevent N+1 queries using batch loading or query mappers.
  * Mandatory pagination, filtering, and query limits on collection endpoints.
  * Design indexes based on actual query patterns; verify efficiency with query execution plans (`EXPLAIN ANALYZE`).
* **Connection & Resource Safety**:
  * Connection pooling and connection lifetime limits.
  * **Critical**: Never hold database transactions open during external network calls or long-running computations.
* **Resilience Patterns**:
  * Implement timeouts, bounded retries with exponential backoff, and circuit breakers for external integrations.
  * Implement graceful process shutdown (`SIGTERM`/`SIGINT`) and draining for HTTP servers and background workers.
  * Job deduplication to avoid concurrent execution of identical background tasks.
* **Concurrency Controls**:
  * Implement optimistic or pessimistic locking for high-contention business state updates (e.g., inventory allocation, payment capture).
* **Caching Strategy**:
  * Cache only where access patterns justify it and invalidation/consistency mechanics are fully controlled.

---

## 9. Testing & Quality Assurance

Every feature must be backed by automated test coverage. **Never claim tests pass without executing and verifying their output.**

* **Unit Tests**: Pure domain logic, entities, value objects, and application use cases (mocking external ports).
* **Integration Tests**: Database repositories, migrations, and external service adapters against live or containerized test dependencies.
* **Contract & API Tests**: Public HTTP endpoints, request/response schema validation, and module public interfaces.
* **Security & Auth Tests**: Verification of deny-by-default, permission boundaries, and ownership validation.
* **Concurrency & Failure Tests**: Validation of idempotency keys, race conditions, and error recovery.
* **Architecture Tests**: Automated boundary checks (e.g., via dependency-cruiser or custom linters) to prevent forbidden cross-module imports.
* **Static Analysis**: Strict TypeScript checking, ESLint rules, and vulnerability auditing.

---

## 10. Engineering Standards & Observability

* **Clean Code & Modularity**: Keep functions and classes focused. Eliminate god classes, utility junk drawers, circular dependencies, and duplicate business logic.
* **Type Safety & Ubiquitous Language**: Use explicit types, domain value objects, and domain-accurate terminology.
* **Centralized Infrastructure, Decentralized Domain**: Centralize cross-cutting technical infrastructure (logging, telemetry, database drivers) without centralizing business rules.
* **Configuration Management**: Strictly validate all environment variables at application startup; fail fast if required configuration is missing or malformed.
* **Observability Suite**:
  * Structured JSON logging with unified log levels.
  * Correlation / Request IDs propagated through all execution flows.
  * Readiness and liveness health check endpoints (`/health/ready`, `/health/live`).
  * Application metrics and readiness for distributed tracing (OpenTelemetry).
* **Architectural Decisions**: Document non-trivial decisions, trade-offs, and design compromises in Architecture Decision Records (`docs/adr/`).

---

## 11. Target Architecture & Project Layout

### System Layering

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      Delivery & Infrastructure                         │
│       REST API · Middleware · AuthN · Observability · Workers          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                      Application — Modular Monolith                    │
│                                                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │   IAM    │ │  Asset   │ │  Config  │ │  Notif   │ │  Scheduler   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Order   │ │ Transact │ │ Gateway  │ │  Search  │ │  Inventory*  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                                        │
│  * Each module encapsulates: Domain, Use Cases, Persistence, Contracts │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Data & Integration Infrastructure                   │
│      PostgreSQL · Migrations · Redis · Outbox · Third-Party APIs       │
└────────────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```text
my-platform/
├── apps/
│   ├── api/                              # Backend Modular Monolith
│   │   ├── src/
│   │   │   ├── app.ts                    # Express app initialization
│   │   │   ├── server.ts                 # HTTP server lifecycle & graceful shutdown
│   │   │   ├── bootstrap/                # Container & module auto-discovery
│   │   │   │   ├── container.ts          # Dependency injection container
│   │   │   │   ├── register-modules.ts
│   │   │   │   └── register-routes.ts
│   │   │   ├── config/                   # Validated startup configuration
│   │   │   │   ├── env.ts
│   │   │   │   ├── database.ts
│   │   │   │   ├── security.ts
│   │   │   │   └── logger.ts
│   │   │   ├── shared/                   # Generic technical primitives only (No business logic)
│   │   │   │   ├── domain/
│   │   │   │   ├── application/
│   │   │   │   ├── infrastructure/
│   │   │   │   └── presentation/
│   │   │   ├── modules/                  # Isolated business modules
│   │   │   │   ├── iam/
│   │   │   │   ├── asset/
│   │   │   │   ├── config/
│   │   │   │   ├── notification/
│   │   │   │   ├── scheduler/
│   │   │   │   ├── order/
│   │   │   │   ├── transaction/
│   │   │   │   ├── gateway/
│   │   │   │   ├── search/
│   │   │   │   └── inventory/            # Optional
│   │   │   ├── infrastructure/           # Technical drivers (shared DB pool, cache, logger)
│   │   │   │   ├── database/
│   │   │   │   ├── messaging/
│   │   │   │   ├── cache/
│   │   │   │   ├── storage/
│   │   │   │   └── observability/
│   │   │   └── tests/
│   │   │       ├── integration/
│   │   │       ├── architecture/
│   │   │       └── security/
│   │   ├── migrations/                   # Module-owned database migrations
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                              # React Frontend
│       ├── src/
│       │   ├── app/                      # Providers, Router, Layouts, Global Store
│       │   ├── features/                 # Feature-sliced modules matching backend
│       │   │   ├── iam/
│       │   │   ├── asset/
│       │   │   ├── order/
│       │   │   └── ...
│       │   ├── shared/                   # UI Primitives, base hooks, utilities
│       │   │   ├── components/
│       │   │   ├── hooks/
│       │   │   ├── api/
│       │   │   ├── utils/
│       │   │   └── types/
│       │   ├── assets/
│       │   ├── styles/
│       │   └── main.tsx
│       ├── public/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── contracts/                        # Shared API DTOs, schemas, and event contracts
│   ├── eslint-config/
│   └── typescript-config/
│
├── infrastructure/                       # Deployment manifests, Docker, Helm, Terraform
├── docs/                                 # Architecture diagrams, ADRs, runbooks
├── scripts/                              # CI/CD and developer tooling scripts
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### Standard Module Internal Layout (`modules/<module-name>/`)

```text
modules/order/
├── index.ts                              # Public module entry point & contract exports
├── order.module.ts                       # Module dependency wiring & registration
│
├── domain/                               # Pure Domain (Zero external dependencies)
│   ├── entities/                         # Aggregate roots and entities
│   ├── value-objects/                    # Immutable domain value objects
│   ├── events/                           # Domain integration events
│   ├── services/                         # Domain-specific calculation/orchestration services
│   ├── errors/                           # Domain-specific business exceptions
│   └── repositories/                     # Repository interfaces (ports)
│
├── application/                          # Use Cases & Orchestration
│   ├── commands/                         # State-mutating commands, schemas & handlers
│   ├── queries/                          # Data retrieval queries & handlers
│   ├── ports/                            # Outbound interfaces (e.g. payment.port.ts)
│   └── services/                         # Application coordination services
│
├── infrastructure/                       # Concrete Implementations & Adapters
│   ├── persistence/                      # DB repository implementations, queries & mappers
│   └── integrations/                     # Outbound external API adapters
│
├── presentation/                         # Inbound Delivery Mechanism
│   └── http/                             # Controllers, routes, request/response validation
│
└── tests/
    ├── unit/
    ├── integration/
    └── contract/
```

### Dependency Direction Rules

```text
Presentation Layer   (HTTP routes, controllers, request validation)
        │
        ▼
Application Layer    (Use cases, command/query handlers, outbound port definitions)
        │
        ▼
   Domain Layer      (Pure entities, value objects, business invariants)
        ▲
        │ (implements)
Infrastructure Layer (PostgreSQL repositories, external API clients, messaging adapters)
```

* **Core Rule**: The `Domain` layer must **never** import Express, PostgreSQL drivers, ORMs, or third-party client SDKs. Infrastructure implements the domain's repository and application port abstractions.

---

## 12. React Frontend Architecture

* **Feature-Driven Architecture**: Structure frontend code by business feature (`features/order/`, `features/iam/`, etc.) containing its own API calls, UI components, hooks, pages, schemas, and types.
* **Component Separation**:
  * Domain/feature components reside in `features/<feature>/components/`.
  * Generic UI design-system primitives (buttons, inputs, modals) reside in `shared/components/`.
* **State Management**:
  * Use server-state caching libraries (e.g., TanStack Query) for server data.
  * Avoid giant global state stores; keep state local to features or components.
* **Decoupling Rules**:
  * Never share backend domain entities directly with the React client.
  * Share API schemas and request/response DTOs via `packages/contracts`.
  * Frontend authorization guards are user-experience aids only; never rely on the frontend for security enforcement.

---

## 13. AI Implementation Workflow

Before implementing any feature or modification:
1. **Repository Inspection**: Inspect existing codebase conventions, utilities, and configuration.
2. **Impact Analysis**: Identify affected modules, contract boundaries, and dependency directions.
3. **Plan & Trade-offs**: Detail the implementation approach, architectural trade-offs, security controls, and testing strategy.
4. **Vertical Slice Implementation**: Implement the smallest complete vertical slice across domain, application, infrastructure, and delivery.
5. **Quality Verification**: Add comprehensive unit, integration, and contract tests. Execute test suites and linters; verify and report actual results.
6. **Boundary Review**: Review diffs to guarantee no forbidden cross-module imports, leaked domain abstractions, or security vulnerabilities.
7. **Prudence**: Do not rewrite unrelated files or introduce new dependencies/frameworks without explicit justification. Clarify ambiguous requirements proactively.

---

## 14. Definition of Done (DoD)

A task or feature is marked complete **only** when:
- [ ] Business logic strictly resides within the appropriate module's domain/application layer.
- [ ] SOLID principles, clean architecture layering, and module isolation boundaries are respected.
- [ ] Authentication and authorization (including resource-level checks) are implemented and verified.
- [ ] OWASP security risks are addressed (input validation, SQL injection prevention, safe serialization).
- [ ] Automated tests (unit, integration, and contract) cover expected behavior and critical failure cases.
- [ ] Required database migrations are created, deterministic, and tested.
- [ ] Observability (structured logging, correlation IDs, health checks) is in place.
- [ ] Documentation, API contracts, and ADRs (where applicable) are updated.
- [ ] All linters, type checks, and automated tests have been executed and passed.