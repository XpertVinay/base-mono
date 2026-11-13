# Enterprise Microservices Platform (`backend-ms`)

A production-grade, domain-driven microservices backend replicated from the modular monolith. Designed for independent deployment, strict OWASP security compliance, gRPC synchronous inter-service communication, and RabbitMQ event-driven asynchronous processing.

---

## 🏛️ Architecture Overview

Each microservice is **100% self-contained** and independently deployable. There are **zero root-level runtime dependencies**:
- Each service contains its own copy of the DDD shared kernel primitives (`Result<T,E>`, `Entity`, `ValueObject`, `AggregateRoot`, `DomainEvent`, logger, crypto, database pool, and messaging).
- Any microservice folder can be extracted, containerized, or deployed to an isolated cluster without touching the rest of the repository.

```
                                  ┌───────────────────────────┐
                                  │   Clients / Web / Mobile  │
                                  └─────────────┬─────────────┘
                                                │ (HTTP / JSON)
                                                ▼
                                  ┌───────────────────────────┐
                                  │   API Gateway (:4000)     │
                                  │  - OWASP Security         │
                                  │  - JWT Verification       │
                                  │  - Correlation Tracing    │
                                  │  - gRPC Upstream Dispatch │
                                  │  - gRPC Health Aggregator │
                                  └─────────────┬─────────────┘
                                                │ gRPC over HTTP/2 (:50051 - :50061)
         ┌──────────────┬──────────────┬────────┼─────────────┬──────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼        ▼             ▼              ▼              ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐     ┌─────────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
   │IAM Service│  │Asset Svc  │  │Config Svc │ ... │ Order Svc   │  │Txn Svc    │  │Search Svc │  │Audit Svc  │
   │  (:4001)  │  │  (:4002)  │  │  (:4003)  │     │   (:4006)   │  │  (:4007)  │  │  (:4008)  │  │  (:4011)  │
   └─────┬─────┘  └───────────┘  └─────┬─────┘     └──────┬──────┘  └─────┬─────┘  └─────▲─────┘  └─────▲─────┘
         │                             │                  │               │              │              │
         │ gRPC (:50051)               │ gRPC (:50053)    │ gRPC (:50059) │              │              │
         │                             └────────────────┐ ├───┐           │              │              │
         │                                              ▼ ▼   ▼           │              │              │
         │                                       ┌──────────────┐         │              │              │
         │                                       │Inventory Svc │         │              │              │
         │                                       │   (:4009)    │         │              │              │
         │                                       └──────────────┘         │              │              │
         │                                                                │              │              │
         │                             RabbitMQ Topic Exchange            │              │              │
         │                            ('microservices.events')            │              │              │
         └──────────────────────────────────────┬─────────────────────────┴──────────────┴──────────────┘
                                                ▼
                     ┌─────────────────────────────────────────────────────┐
                     │ Consumer Services:                                  │
                     │ - order-service (subscribes to txn completed)       │
                     │ - search-service (subscribes to orders, users)      │
                     │ - notification-service (subscribes to all events)   │
                     │ - audit-service (subscribes to all domain events)   │
                     └─────────────────────────────────────────────────────┘
```

---

## 📦 Services Directory Matrix

| Service | HTTP Port | gRPC Port | Primary Responsibilities | Cross-Service Communication |
|---|---|---|---|---|
| **api-gateway** | `4000` | - | Single entry point, gRPC upstream dispatch, OWASP headers, rate limiting, token forwarding | Dispatches to all 13 downstreams via gRPC over HTTP/2 |
| **iam-service** | `4001` | `50051` | Identity, JWT issue & validation, RBAC | Publishes `iam.user_registered` to RabbitMQ; Serves `IAMService` gRPC |
| **asset-service** | `4002` | `50052` | Media assets, files, binary storage paths | Serves `AssetService` gRPC to API Gateway |
| **config-service** | `4003` | `50053` | Dynamic configuration, active payment gateway toggles | Serves `ConfigService` gRPC to API Gateway & `transaction-service` |
| **notification-service** | `4004` | `50054` | Email, SMS, Webhook notifications | Consumes `iam.user_registered`, `orders.order_created`, `transactions.transaction_completed` via RabbitMQ; Serves `NotificationService` gRPC |
| **scheduler-service** | `4005` | `50055` | Cron tasks, periodic background executions | Serves `SchedulerService` gRPC to API Gateway |
| **order-service** | `4006` | `50056` | Order lifecycle, basket totals, checkout status | Serves `OrderService` gRPC; Synchronous gRPC client to `inventory-service`; Publishes `orders.order_created`; Consumes `transactions.transaction_completed` |
| **transaction-service** | `4007` | `50057` | Multi-provider payments (Stripe, PayPal, Razorpay, Mock), hosted redirects | Serves `TransactionService` gRPC; Synchronous gRPC client to `config-service` for gateway resolution; Publishes `transactions.transaction_completed` |
| **search-service** | `4008` | `50058` | Inverted search index, full-text queries | Serves `SearchService` gRPC; Consumes `orders.order_created` & `iam.user_registered` projections from RabbitMQ |
| **inventory-service** | `4009` | `50059` | Stock quantities, SKUs, reservation transactions | Serves `InventoryService` gRPC (`CheckStock`, `ReserveStock`, `GetStock`, `AddStock`) |
| **ai-service** | `4010` | `50060` | MCP client, provider management, tools execution & multi-step orchestration | Serves `AIService` gRPC to API Gateway & internal microservices |
| **audit-service** | `4011` | `50061` | Immutable audit logs, telemetry, monitoring adapters (AWS CloudWatch, Prometheus, Grafana) | RabbitMQ consumer for all domain events; Serves `AuditService` gRPC |
| **organization-service** | `4012` | `50062` | Multi-tenant organization CRUD, status management, tenant membership lifecycle | Serves `OrganizationService` gRPC to API Gateway |
| **rbac-service** | `4013` | `50063` | Dynamic roles, granular permission catalog, user role assignments, permission checking | Serves `RbacService` gRPC to API Gateway & IAM |

---

## 🔍 Audit Logging & Monitoring (Flag-Based Adapters)

The **Audit Service** provides unified compliance logging and operational observability with flag-based activation:

### Monitoring Adapters:
1. **AWS CloudWatch Adapter** (`ENABLE_CLOUDWATCH=true`):
   - Dispatches structured audit events and custom metrics to AWS CloudWatch Logs & Metrics.
   - Configurable log group (`AWS_CLOUDWATCH_LOG_GROUP`) and stream (`AWS_CLOUDWATCH_LOG_STREAM`).
2. **Prometheus Metrics Adapter** (`ENABLE_PROMETHEUS=true`):
   - Real-time metrics collection exposed at `http://localhost:4011/metrics` (and JSON summary via Gateway `/api/v1/audit/metrics/summary`).
   - Tracks metrics including `audit_events_total`, `audit_errors_total`, `remediation_actions_total`, and `customer_impact_risk_score`.
3. **Grafana Adapter & Dashboard** (`ENABLE_GRAFANA=true`):
   - Exposes formatted annotations at `/api/v1/audit/grafana/annotations` marking system events on Grafana dashboards.
   - Compatible with standard Prometheus and Loki data sources.

### Flag-Based Config Query:
```bash
curl http://localhost:4000/api/v1/audit/config
```

---

## ⚡ Synchronous Inter-Service Communication (gRPC)

Protocol buffer contracts (`.proto`) are bundled natively inside each service requiring them:

### 1. Config Service (`config.proto` on port `50053`)
- **RPC `GetConfigByKey`**: Returns configuration values for a given key.
- **RPC `GetActivePaymentGateway`**: Enables `transaction-service` to dynamically fetch whether Stripe, PayPal, Razorpay, or Mock is active in real time with sub-millisecond overhead.

### 2. IAM Service (`iam.proto` on port `50051`)
- **RPC `VerifyToken`**: Validates JWT tokens (including `tenantId`, `tenantSlug`, `authMethod`, `provider`, and optional `expectedTenantId` enforcement) and returns user + tenant identity attributes.
- **RPC `GetUserById`**: Returns user profile, tenant ID, auth method, and authorization roles.
- **RPC `ResolveTenant`**: Resolves tenant metadata and configuration (`allowLocalLogin`, `allowFederatedLogin`, `autoProvisionUsers`, `allowedEmailDomains`) by ID or slug.

---

## 🔐 OIDC Federated Login & Configurable Multi-Tenancy

`iam-service` and the shared microservice kernel support **OpenID Connect (OIDC) federated login** and **configurable multi-tenancy**:

### Configurable Multi-Tenancy Flags
| Variable | Default | Description |
|---|---|---|
| `MULTI_TENANCY_ENABLED` | `true` | Enable/disable tenant propagation and enforcement across API Gateway and all microservices |
| `MULTI_TENANCY_MODE` | `optional` | `disabled` (always `default`), `optional` (resolve from JWT/`x-tenant-id`/`x-tenant-slug`/query or fallback to `DEFAULT_TENANT_ID`), `strict` (require explicit tenant on `requireTenant()` routes) |
| `DEFAULT_TENANT_ID` | `default` | Default tenant ID when mode is `optional` or `disabled` |
| `TENANT_HEADER` | `x-tenant-id` | Header carrying tenant ID |
| `TENANT_SLUG_HEADER` | `x-tenant-slug` | Header carrying tenant slug |
| `TENANT_SUBDOMAIN_ENABLED` | `false` | Optional subdomain-based tenant slug resolution |
| `OIDC_ENCRYPTION_KEY` | `JWT_SECRET` fallback | Key used for AES-256-GCM encryption of OIDC `client_secret` values at rest |

### OIDC & Tenant Endpoints (`/api/v1/iam/...`)
- **Tenants**: `GET /tenants/config`, `GET /tenants`, `POST /tenants`, `GET /tenants/:idOrSlug`, `PATCH /tenants/:idOrSlug`
- **OIDC Discovery & Flow**: `GET /oidc/providers`, `GET /oidc/:provider/authorize` (PKCE S256 + state + nonce), `GET|POST /oidc/:provider/callback`, `POST /oidc/token-exchange`, `POST /refresh`
- **Federated Identity Linking**: `POST /oidc/:provider/link`, `GET /federated-identities`, `DELETE /federated-identities/:id`
- **Admin OIDC Config**: `GET /oidc/admin/supported-types`, `GET|POST /oidc/admin/providers`, `PATCH|DELETE /oidc/admin/providers/:id`, `POST /oidc/admin/providers/:id/test-discovery`

### Extending Other Microservices
1. **HTTP**: `tenantContextMiddleware()` is already mounted in every service's `src/app.ts` (`req.tenant` & `req.context.tenantId`). Add `requireTenant()` from `src/shared/presentation/tenant.middleware.ts` to any route requiring strict tenant enforcement.
2. **PostgreSQL**: Use `dbPool.withTenantContext(req.tenant.tenantId, async (client) => ...)` from `src/shared/infrastructure/database/connection-pool.ts` to scope `app.current_tenant_id` via `SET LOCAL` for RLS or tenant-scoped queries.
3. **RabbitMQ**: Events carry optional `tenantId` in `DomainIntegrationEvent` and `x-tenant-id` AMQP headers automatically.
4. **Custom OIDC Providers**: Implement `IOidcProviderAdapter` and register it in `OidcProviderRegistry` (`services/iam-service/src/infrastructure/oidc/oidc-provider-registry.ts`). Built-in presets: `GENERIC_OIDC`, `GOOGLE`, `ENTRA_ID`, `OKTA`, `KEYCLOAK`, and `MOCK`.

### 3. Inventory Service (`inventory.proto` on port `50059`)
- **RPC `CheckStock`**: Real-time stock availability check prior to order creation.
- **RPC `ReserveStock`**: Atomically reserves quantities for incoming orders.

### 4. Audit Service (`audit.proto` on port `50061`)
- **RPC `RecordAuditLog`**: Low-latency synchronous audit logging for high-assurance operations.
- **RPC `QueryAuditLogs`**: Structured query interface for administrative audits.

---

## 🐇 Asynchronous Event-Driven Architecture (RabbitMQ)

- **Exchange**: `microservices.events` (Topic Exchange)
- **Durability**: Persistent messages, durable queues with dead-letter and auto-reconnect resilience.

### Event Catalog:
1. **`iam.user_registered`**:
   - **Publisher**: `iam-service`
   - **Subscribers**: `notification-service`, `search-service`, `audit-service`
2. **`orders.order_created`**:
   - **Publisher**: `order-service`
   - **Subscribers**: `notification-service`, `search-service`, `audit-service`
3. **`transactions.transaction_completed`**:
   - **Publisher**: `transaction-service`
   - **Subscribers**: `order-service` (marks order `PAID`), `notification-service`, `audit-service`

---

## 🛡️ OWASP Security & Hardening Controls

- **Zero Monorepo Couplings**: No symlinks or root dependencies. Every service has full isolated code ownership.
- **Strict Content Security Policy (CSP) & Helmet**: Applied at API Gateway and individual service layers.
- **Parameterized SQL**: All database queries strictly use parameterized queries (`$1, $2...`) via `pg` pool.
- **Strict Rate Limiting**: Anti-DoS rate limiters on both gateway and service endpoints.
- **Constant-Time Password Hashing**: `bcryptjs` with 12 salt rounds in `PasswordVO`.
- **Error Obfuscation**: Production errors suppress internal stack traces and database schemas from external clients.
- **Correlation ID Propagation**: Automatic injection of `x-request-id` / `x-correlation-id` across HTTP, gRPC, and RabbitMQ logs.

---

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js >= 20 (optional for local running)

### 1. Launch Platform with Docker Compose
```bash
cd backend-ms
make up
```
This will start:
- PostgreSQL 16 (with automatic schema initialization)
- RabbitMQ 3 Management UI at `http://localhost:15672` (guest / guest)
- API Gateway at `http://localhost:4000`
- All 13 backend microservices

### 2. Verify Health & Access Swagger API Documentation
```bash
make health
# or curl directly:
curl http://localhost:4000/api/v1/health/detailed
```

### 3. 📚 Swagger API & gRPC Contract Documentation
Interactive Swagger UI with a multi-specification dropdown selector is available directly via the API Gateway:
- **Interactive Swagger UI**: [http://localhost:4000/api-docs](http://localhost:4000/api-docs) (aliases: `/docs`, `/swagger`, `/api/docs`, `/api/v1/docs`)
- **Combined Specification (REST + gRPC)**: [http://localhost:4000/api-docs/openapi.json](http://localhost:4000/api-docs/openapi.json) (aliases: `/api/v1/openapi.json`, `/api/openapi.json`)
- **HTTP REST APIs Specification**: [http://localhost:4000/api-docs/rest.json](http://localhost:4000/api-docs/rest.json) (aliases: `/api/v1/rest.json`, `/api/rest.json`)
- **gRPC Services Contract Specification**: [http://localhost:4000/api-docs/grpc.json](http://localhost:4000/api-docs/grpc.json) (aliases: `/api/v1/grpc.json`, `/api/grpc.json`)

#### 📋 Unified Standard Response Envelope Format
Both HTTP REST APIs and gRPC contracts return all payloads within the standardized response envelope:
```json
{
  "status": true,
  "message": "Success message",
  "data": { ... },
  "errors": [],
  "meta_data": {
    "requestId": "req-c7f8a9e1-3b4d-4e9a-9d2a-8f7a6b5c4d3e",
    "timestamp": "2026-10-16T10:30:00.000Z",
    "debug": {
      "service": "iam-service",
      "env": "development",
      "durationMs": 14
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 120,
      "totalPages": 6,
      "hasNext": true,
      "hasPrev": false
    },
    "further_steps": [
      "Authenticate with POST /api/v1/iam/login",
      "Proceed to checkout"
    ]
  }
}
```

On validation or operational errors:
```json
{
  "status": false,
  "message": "Validation error: invalid request input",
  "data": null,
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "field": "email",
      "message": "Invalid email address format"
    }
  ],
  "meta_data": {
    "requestId": "req-c7f8a9e1",
    "timestamp": "2026-10-16T10:30:00.000Z",
    "pagination": null,
    "further_steps": ["Check request body schema in /api-docs"]
  }
}
```

### 4. Example API Workflows (through Gateway `:4000`)

#### Register User
```bash
curl -X POST http://localhost:4000/api/v1/iam/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!","name":"Alice"}'
```

#### Check Audit Trail
```bash
curl http://localhost:4000/api/v1/audit/logs
```

#### Check Prometheus Metrics
```bash
curl http://localhost:4011/metrics
```

---

## 📁 Repository Structure
```
backend-ms/
├── docker-compose.yml          # Full multi-container orchestration
├── init-db.sql                 # Database bootstrap schemas and seed data
├── Makefile                    # Developer workflow automation
├── package.json                # Root automation scripts
├── .env.example
├── README.md
└── services/
    ├── api-gateway/            # Port 4000 (Reverse Proxy & Security)
    ├── iam-service/            # Port 4001, gRPC 50051
    ├── asset-service/          # Port 4002
    ├── config-service/         # Port 4003, gRPC 50053
    ├── notification-service/   # Port 4004
    ├── scheduler-service/      # Port 4005
    ├── order-service/          # Port 4006 (gRPC client -> inventory)
    ├── transaction-service/    # Port 4007 (gRPC client -> config)
    ├── search-service/         # Port 4008
    ├── inventory-service/      # Port 4009, gRPC 50059
    └── audit-service/          # Port 4011, gRPC 50061 (CloudWatch/Prometheus/Grafana)
```
