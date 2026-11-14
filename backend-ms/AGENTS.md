# AGENTS.md
# Enterprise Distributed Microservices Platform — Engineering Governance & Operational Manual

**Subsystem:** Distributed Microservices Hub (`boilerplate/backend-ms`)  
**Status:** Mandatory  
**Applies To:** All AI coding agents, backend engineers, and automated CI/CD workflows operating on `backend-ms`.  
**Subsystem Root:** `/Users/vinaykumar/Desktop/IMP/base/boilerplate/backend-ms`

---

## 1. Mission and Operating Principles

You are an AI software engineering agent operating within the **Distributed Microservices Hub** of the enterprise platform. This subsystem is architected as an autonomous, share-nothing, event-driven polyglot-ready microservices mesh communicating synchronously via **gRPC HTTP/2** and asynchronously via **RabbitMQ** event messaging, with ingress routed through a high-performance **API Gateway**.

### 1.1 Core Principles (Autonomous & Share-Nothing Architecture)

1. **Strict Share-Nothing Isolation**: Each microservice under `services/<service-name>` is completely self-contained and independently deployable. No microservice shall depend on a shared monorepo package or parent directory at runtime. Every service must build from its own isolated Docker context (`./services/<service-name>`).
2. **One Task, One Bounded Scope**: Confine code changes strictly to the target microservice. Never cross-import files or schemas from sibling microservices (`import ... from '../sibling-service'` is strictly forbidden).
3. **Contract-First Communication**:
   - **Synchronous RPC**: Defined strictly via Protocol Buffers (`.proto`) located under each service's `src/proto/`.
   - **Asynchronous Events**: Defined strictly via versioned integration event contracts (`DomainIntegrationEvent<T>`) over RabbitMQ topic exchanges.
4. **Evidence-Based Progression**: Never mark a task complete or claim a build or test succeeded without observed terminal execution and passing status.
5. **Zero-Trust Security & Multi-Tenancy**: Every request passing through the API Gateway or between services must enforce cryptographic tenant validation (`x-tenant-id`), identity claims, and Row-Level Security (RLS).
6. **Defense in Depth**: Fallback to hardcoded development secrets in production is strictly prohibited. Microservices fail fast if required secrets or environment configurations are missing or insecure.

---

## 2. Microservice Registry & Port Allocation

To guarantee zero port conflicts and predictable local/containerized operations, adhere strictly to the master service registry:

| Service Name | Directory | HTTP Port | gRPC Port | Protocol | Primary Responsibilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | `services/api-gateway` | `4000` | N/A | HTTP/REST $\to$ gRPC | Reverse proxy, rate limiting, auth propagation, circuit breaker, Swagger docs |
| **IAM Service** | `services/iam-service` | `4001` | `50051` | HTTP / gRPC | Identity, authentication, OIDC, SAML, SSO, MFA, back-office user management |
| **Asset Service** | `services/asset-service` | `4002` | `50052` | HTTP / gRPC | Digital asset storage, file uploads, media metadata |
| **Config Service** | `services/config-service` | `4003` | `50053` | HTTP / gRPC | Dynamic multi-tenant configuration, feature flags |
| **Notification Service** | `services/notification-service` | `4004` | `50054` | HTTP / gRPC | Multi-channel messaging, email, SMS, push notifications |
| **Scheduler Service** | `services/scheduler-service` | `4005` | `50055` | HTTP / gRPC | Distributed cron orchestration, scheduled job execution |
| **Order Service** | `services/order-service` | `4006` | `50056` | HTTP / gRPC | Order lifecycle management, Saga orchestration |
| **Transaction Service** | `services/transaction-service` | `4007` | `50057` | HTTP / gRPC | Invoicing, payments, ledger accounting, billing |
| **Search Service** | `services/search-service` | `4008` | `50058` | HTTP / gRPC | Full-text indexing, query retrieval, Elasticsearch bridge |
| **Inventory Service** | `services/inventory-service` | `4009` | `50059` | HTTP / gRPC | Inventory items, stock levels, warehouse reservations |
| **AI Service** | `services/ai-service` | `4010` | `50060` | HTTP / gRPC | LLM connectors, MCP tool execution, vector embeddings |
| **Audit Service** | `services/audit-service` | `4011` | `50061` | HTTP / gRPC | Immutable audit logging, OpenTelemetry, Prometheus metrics |
| **Organization Service** | `services/organization-service` | `4012` | `50062` | HTTP / gRPC | Multi-tenant organization CRUD, membership hierarchies |
| **RBAC Service** | `services/rbac-service` | `4013` | `50063` | HTTP / gRPC | Fine-grained roles, permission matrices, policy evaluations |

### Infrastructure Services
- **PostgreSQL 16**: Port `5432` (Relational database & pgvector)
- **RabbitMQ 3.x Broker**: Port `5672` (AMQP messaging) | Port `15672` (Web Management UI)
- **Prometheus**: Port `9090` (Metrics scraping)
- **Grafana**: Port `3000` (Observability dashboards)

---

## 3. Microservice Architectural Layers (Domain-Driven Design)

Every microservice maintains a clean Hexagonal / DDD internal structure:

```
services/<service-name>/
├── Dockerfile                # Self-contained multi-stage production container build
├── package.json              # Autonomous dependencies (strictly pruned, zero dead packages)
├── tsconfig.json             # Service TypeScript compiler options
├── migrations/               # Service-specific PostgreSQL SQL migration scripts
├── tests/                    # In-memory integration and unit tests (Node.js test runner)
└── src/
    ├── server.ts             # Application bootstrapper, port binding, and 2-phase graceful shutdown
    ├── app.ts                # Express application factory, route mounting, dependency injection
    ├── domain/               # Pure business models (Entities, Value Objects, Aggregate Roots)
    │   ├── entities/
    │   ├── value-objects/
    │   └── repositories/     # Repository interfaces (ports)
    ├── application/          # Use cases, Commands, Queries, DTOs
    │   ├── commands/
    │   ├── queries/
    │   └── dto/
    ├── infrastructure/       # Adapters (Postgres repositories, RabbitMQ publishers/consumers)
    │   ├── database/         # Database migrations runner & advisory locks
    │   └── persistence/      # PostgreSQL repository implementations
    ├── grpc/                 # gRPC server implementation and in-process Express bridge
    │   ├── <service>.grpc-server.ts
    │   └── express-grpc-bridge.ts
    ├── proto/                # Protocol Buffer contracts
    │   └── <service>.proto
    ├── presentation/         # HTTP controllers, routers, and request validation schemas (Zod)
    │   └── http/
    └── shared/               # Self-contained microservice chassis (isolated per service)
        ├── contracts/        # Base API response structures & domain integration event interfaces
        ├── infrastructure/   # DatabasePool, RabbitMQService, Logger
        └── presentation/     # Auth, Tenant, Rate-Limiter, Correlation ID, and Error middlewares
```

---

## 4. Master Command Reference

### 4.1 Subsystem Root Commands (`boilerplate/backend-ms`)
```bash
cd /Users/vinaykumar/Desktop/IMP/base/boilerplate/backend-ms

# Install dependencies across all 14 services independently
npm run install:all

# Build all 14 services (compiles TypeScript and copies proto files)
npm run build:all

# Start full multi-container Docker Compose stack
npm run docker:up

# View aggregated container logs
npm run docker:logs

# Teardown container stack
npm run docker:down
```

### 4.2 Individual Microservice Commands (e.g. `iam-service`)
```bash
cd /Users/vinaykumar/Desktop/IMP/base/boilerplate/backend-ms/services/iam-service

# Install dependencies (strictly scoped to this service)
npm install

# Start in development mode with live file watching (tsx)
npm run dev

# Run database migrations
npm run db:migrate

# Execute unit and integration tests
npm test

# Build production artifacts (TypeScript -> dist/ + proto copy)
npm run build

# Start production server
npm start
```

---

## 5. Architectural Standards & Quality Guidelines

### 5.1 Re-Usability & Dependency Hygiene
1. **No Shared Runtime Packages**: Do not create shared packages in the monorepo root that microservices import at runtime. Every service must run in a standalone container with zero parent directory context.
2. **Prune Unused Dependencies**: Services must only declare dependencies they actively import. Never copy-paste `bcryptjs` or other heavy libraries into non-auth services.
3. **Service Chassis Consistency**: Cross-cutting utilities (such as `express-grpc-bridge.ts`, `connection-pool.ts`, and `rabbitmq.service.ts`) are maintained inside each service's `src/shared/`. Keep them consistent using clean design patterns.

### 5.2 Performance Standards
1. **Connection Pool Sizing**:
   - High-throughput services (`order-service`, `transaction-service`, `iam-service`): `DB_POOL_MAX=8` (idle: 2).
   - Moderate services (`audit-service`, `inventory-service`, `notification-service`): `DB_POOL_MAX=5` (idle: 1).
   - Read-heavy/lightweight services (`config-service`, `asset-service`, `scheduler-service`): `DB_POOL_MAX=3` (idle: 1).
   - Set `statement_timeout: 10000` (10s) and `idleTimeoutMillis: 15000` to prevent connection leaks.
2. **gRPC Transport & Keep-Alive**:
   - The API Gateway maintains long-lived HTTP/2 gRPC channels with keep-alive pings (`grpc.keepalive_time_ms: 10000`, `grpc.keepalive_timeout_ms: 5000`).
   - The in-process `express-grpc-bridge.ts` dispatches requests byte-for-byte without intermediate string conversions.
3. **Localized Caching**:
   - Use in-memory LRU caching in `api-gateway` for JWT public keys and tenant verification.
   - Cache dynamic tenant configurations in `config-service` with a 60-second TTL.

### 5.3 Zero-Trust Security Standards
1. **Asymmetric Token Verification**: API Gateway and microservices verify RS256 JWT tokens using IAM's public keys. Never fall back to static symmetric strings in production environments.
2. **Cryptographic Gateway-to-Service Ingress**: API Gateway signs downstream requests with HMAC-SHA256 (`x-gateway-signature`, timestamp, nonce). Microservices verify signatures to prevent header spoofing.
3. **Strict Multi-Tenant Scoping**: All database queries must be scoped to the authenticated tenant. Database repositories must execute queries within `withTenantContext` (`SET LOCAL app.current_tenant_id = $1`).
4. **Boundary Validation**: Every HTTP endpoint must validate payloads using **Zod** schemas in the presentation layer.

### 5.4 High Availability & Operational Resilience
1. **API Gateway Circuit Breaker**: Dispatches to downstream microservices are protected by circuit breakers. Repeated timeouts or 5xx errors trip the breaker, immediately returning 503 and preventing Gateway event loop starvation.
2. **RabbitMQ Reliable Delivery & DLQ**:
   - Publishing: In-flight messages emitted during channel reconnects are buffered in memory and flushed upon reconnection (no silent message loss).
   - Consuming: Failed message handling triggers retries with exponential backoff up to 3 attempts, after which the message is routed to the Dead Letter Queue (`<service>.dlq`) via `microservices.dlx`.
3. **Database Migration Advisory Locks**: Startup migrations in multi-replica environments must acquire a PostgreSQL advisory lock (`SELECT pg_advisory_xact_lock(...)`) to prevent DDL race conditions.
4. **Graceful Draining Shutdown**:
   - On `SIGTERM`/`SIGINT`, stop accepting new ingress connections.
   - Allow up to 10 seconds for active HTTP/gRPC requests to finish.
   - Cleanly close RabbitMQ channels and database connection pools before exiting.
5. **Standardized Health Probes**:
   - `GET /health/live`: Fast process liveness check (200 OK).
   - `GET /health/ready`: Readiness probe verifying PostgreSQL connection, RabbitMQ channel, and gRPC server availability.

---

## 6. Definition of Done (DoD) for Backend Tasks

Before claiming any backend task or bug fix is complete:
1. **Bounded Scope Verified**: Only files within the target service were modified.
2. **Type Safety Passed**: `npm run build` succeeds with zero TypeScript errors.
3. **Tests Passing**: Service unit/integration tests (`npm test`) pass completely.
4. **Security Verified**: Tenant context is enforced; no hardcoded credentials introduced.
5. **Clean Logs**: Service starts cleanly without unhandled rejections or connection warnings.

