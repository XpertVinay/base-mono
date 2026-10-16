# Architecture Overview: SOLID Modular Monolith

## 1. System Vision
This application implements an enterprise-grade **Modular Monolith** using PostgreSQL, Express.js, React, and Node.js (PERN) with end-to-end TypeScript.

It provides the velocity and operational simplicity of a unified single-deployment unit, while enforcing strict domain isolation and clean architecture boundaries so that any module can be extracted into an independent microservice in the future without rewriting core business logic.

---

## 2. Core Architectural Pillars

### Clean Architecture Layers
Every business module (`apps/api/src/modules/<module>/`) maintains four distinct architectural layers:

```text
Presentation Layer   (Express HTTP Controllers, Zod Schema Validation, Routes)
        │
        ▼
Application Layer    (Use Cases, Commands, Queries, Port Definitions)
        │
        ▼
   Domain Layer      (Aggregate Roots, Entities, Value Objects, Domain Events)
        ▲
        │ (implements)
Infrastructure Layer (PostgreSQL Repositories, Database Mappers, Event Publishers)
```

- **Domain Layer**: Completely agnostic of frameworks, web servers, databases, or SDKs.
- **Application Layer**: Orchestrates use cases using port interfaces.
- **Infrastructure Layer**: Implements ports using concrete database drivers (`pg.Pool`), storage adapters, and external APIs.
- **Presentation Layer**: Exposes HTTP routes and translates incoming requests to typed use case commands.

---

## 3. Module Boundaries & Database Schema Ownership

Cross-module direct database queries or SQL joins are **strictly prohibited**. The shared physical PostgreSQL instance is partitioned into isolated schema namespaces:

| Module | Schema Namespace | Primary Data Ownership |
| :--- | :--- | :--- |
| **IAM** | `iam.*` | Users, hashed passwords, roles, activity status |
| **Asset** | `asset.*` | Asset metadata, file storage references, owner IDs |
| **Config** | `app_config.*` | Dynamic application runtime settings and feature flags |
| **Notification** | `notification.*` | Delivery attempts, channels (Email, SMS), recipients |
| **Scheduler** | `scheduler.*` | Job schedules, cron policies, last/next execution records |
| **Order** | `orders.*` | Orders, order line items, order state machine |
| **Transaction** | `transactions.*` | Financial ledger records, payment references, settlements |
| **Search** | `search.*` | Denormalized search read-models projected via events |
| **Inventory** | `inventory.*` | SKUs, total quantities, reserved quantities, available stock |
| **Gateway** | `gateway.*` | Route metadata, gateway health probes |
| **Common** | `common.*` | Transactional outbox events |

---

## 4. Communication Mechanics

### Synchronous (In-Process Ports)
When Module A requires synchronous data from Module B (e.g. Order verifying User identity):
1. Module B defines a public service interface (`IIamModulePublicApi`) in `modules/iam/index.ts`.
2. Module B registers its implementation in the IoC Container (`container.ts`).
3. Module A invokes this in-memory contract via constructor-injected port. **Zero network latency or HTTP overhead.**

### Asynchronous (Domain Integration Events)
For decoupled side-effects (e.g., Order Created -> Notification Dispatched -> Search Index Updated -> Inventory Reserved):
1. The originating module publishes a domain integration event (e.g., `orders.order_created`) through `IEventBus`.
2. Consuming modules subscribe independently and handle events with error isolation.
3. Neither module possesses compile-time knowledge of the other.

---

## 5. Automated Verification
The architecture is continuously verified by automated tests:
- `apps/api/src/tests/architecture/module-boundaries.test.ts`: Analyzes the module AST and fails if any private module file is imported outside its boundary.
- `apps/api/src/tests/security/security-controls.test.ts`: Verifies deny-by-default, RBAC authorization, and OWASP headers.
- `apps/api/src/tests/unit/health-and-modules.test.ts`: End-to-end integration covering all 10 modules.
