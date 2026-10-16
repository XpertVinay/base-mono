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
                                  │  - Health Aggregator      │
                                  └─────────────┬─────────────┘
                                                │ Reverse Proxy
         ┌──────────────┬──────────────┬────────┼─────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼        ▼             ▼              ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐     ┌─────────────┐  ┌───────────┐  ┌───────────┐
   │IAM Service│  │Asset Svc  │  │Config Svc │ ... │ Order Svc   │  │Txn Svc    │  │Search Svc │
   │  (:4001)  │  │  (:4002)  │  │  (:4003)  │     │   (:4006)   │  │  (:4007)  │  │  (:4008)  │
   └─────┬─────┘  └───────────┘  └─────┬─────┘     └──────┬──────┘  └─────┬─────┘  └─────▲─────┘
         │                             │                  │               │              │
         │ gRPC (:50051)               │ gRPC (:50053)    │ gRPC (:50059) │              │
         │                             └────────────────┐ ├───┐           │              │
         │                                              ▼ ▼   ▼           │              │
         │                                       ┌──────────────┐         │              │
         │                                       │Inventory Svc │         │              │
         │                                       │   (:4009)    │         │              │
         │                                       └──────────────┘         │              │
         │                                                                │              │
         │                             RabbitMQ Topic Exchange            │              │
         │                            ('microservices.events')            │              │
         └──────────────────────────────────────┬─────────────────────────┴──────────────┘
                                                ▼
                     ┌─────────────────────────────────────────────────────┐
                     │ Consumer Services:                                  │
                     │ - order-service (subscribes to txn completed)       │
                     │ - search-service (subscribes to orders, users)      │
                     │ - notification-service (subscribes to all events)   │
                     └─────────────────────────────────────────────────────┘
```

---

## 📦 Services Directory Matrix

| Service | HTTP Port | gRPC Port | Primary Responsibilities | Cross-Service Communication |
|---|---|---|---|---|
| **api-gateway** | `4000` | - | Single entry point, reverse proxy, OWASP headers, rate limiting, token forwarding | Routes to all 9 downstreams |
| **iam-service** | `4001` | `50051` | Identity, JWT issue & validation, RBAC | Publishes `iam.user_registered` to RabbitMQ; Serves `IAMService` gRPC |
| **asset-service** | `4002` | - | Media assets, files, binary storage paths | Independent persistence |
| **config-service** | `4003` | `50053` | Dynamic configuration, active payment gateway toggles | Serves `ConfigService` gRPC to `transaction-service` |
| **notification-service** | `4004` | - | Email, SMS, Webhook notifications | Consumes `iam.user_registered`, `orders.order_created`, `transactions.transaction_completed` via RabbitMQ |
| **scheduler-service** | `4005` | - | Cron tasks, periodic background executions | Standalone background executor |
| **order-service** | `4006` | - | Order lifecycle, basket totals, checkout status | Synchronous gRPC client to `inventory-service`; Publishes `orders.order_created`; Consumes `transactions.transaction_completed` |
| **transaction-service** | `4007` | - | Multi-provider payments (Stripe, PayPal, Razorpay, Mock), hosted redirects | Synchronous gRPC client to `config-service` for gateway resolution; Publishes `transactions.transaction_completed` |
| **search-service** | `4008` | - | Inverted search index, full-text queries | Consumes `orders.order_created` & `iam.user_registered` projections from RabbitMQ |
| **inventory-service** | `4009` | `50059` | Stock quantities, SKUs, reservation transactions | Serves `InventoryService` gRPC (`CheckStock`, `ReserveStock`) |

---

## ⚡ Synchronous Inter-Service Communication (gRPC)

Protocol buffer contracts (`.proto`) are bundled natively inside each service requiring them:

### 1. Config Service (`config.proto` on port `50053`)
- **RPC `GetConfigByKey`**: Returns configuration values for a given key.
- **RPC `GetActivePaymentGateway`**: Enables `transaction-service` to dynamically fetch whether Stripe, PayPal, Razorpay, or Mock is active in real time with sub-millisecond overhead.

### 2. IAM Service (`iam.proto` on port `50051`)
- **RPC `VerifyToken`**: Validates JWT tokens and returns user identity attributes.
- **RPC `GetUserById`**: Returns user profile and authorization roles.

### 3. Inventory Service (`inventory.proto` on port `50059`)
- **RPC `CheckStock`**: Real-time stock availability check prior to order creation.
- **RPC `ReserveStock`**: Atomically reserves quantities for incoming orders.

---

## 🐇 Asynchronous Event-Driven Architecture (RabbitMQ)

- **Exchange**: `microservices.events` (Topic Exchange)
- **Durability**: Persistent messages, durable queues with dead-letter and auto-reconnect resilience.

### Event Catalog:
1. **`iam.user_registered`**:
   - **Publisher**: `iam-service`
   - **Subscribers**: `notification-service` (sends welcome email), `search-service` (indexes user into search directory).
2. **`orders.order_created`**:
   - **Publisher**: `order-service`
   - **Subscribers**: `notification-service` (sends order confirmation), `search-service` (indexes order).
3. **`transactions.transaction_completed`**:
   - **Publisher**: `transaction-service`
   - **Subscribers**: `order-service` (transitions order status from `PENDING` to `PAID`), `notification-service` (sends payment receipt).

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
- All 9 backend microservices

### 2. Verify Health
```bash
make health
# or curl directly:
curl http://localhost:4000/health/detailed
```

### 3. Example API Workflows (through Gateway `:4000`)

#### Register User
```bash
curl -X POST http://localhost:4000/api/v1/iam/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!","name":"Alice"}'
```

#### Login & Obtain JWT Token
```bash
curl -X POST http://localhost:4000/api/v1/iam/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'
```

#### Check Inventory
```bash
curl http://localhost:4000/api/v1/inventory/prod-1
```

#### Search Documents
```bash
curl "http://localhost:4000/api/v1/search?q=Alice"
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
    └── inventory-service/      # Port 4009, gRPC 50059
```
