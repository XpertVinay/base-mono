# Runbook: Production Deployment

## Deployment Architecture
The platform is packaged into container images with multi-stage builds:
- `infrastructure/docker/Dockerfile.api` (Production Node.js 22 runtime)
- `infrastructure/docker/Dockerfile.web` (Nginx Alpine static bundle)

## 1. Running with Docker Compose
To deploy the complete production stack (PostgreSQL + API + Web):

```bash
cd /Users/vinaykumar/Desktop/IMP/base/monolith

# Launch containers in background
docker compose -f infrastructure/docker-compose.yml up -d --build

# View container logs
docker compose -f infrastructure/docker-compose.yml logs -f api
```

## 2. Zero-Downtime Migration Execution
Before routing traffic to a new API release, execute transactional database migrations:

```bash
pnpm --filter @monolith/api db:migrate
```

Each migration is executed inside an atomic PostgreSQL transaction and recorded in `public._migrations`.

## 3. Production Health Probes
- **Liveness Probe**: `GET /health/live` (HTTP 200) -> Kubernetes liveness probe
- **Readiness Probe**: `GET /health/ready` (HTTP 200 if PostgreSQL connected; HTTP 503 if degraded) -> Kubernetes readiness probe

## 4. Microservice Extraction Procedure
When scaling requirements justify extracting a module (e.g. `Order` or `Transaction`) into an independent service:
1. Copy the module directory (`apps/api/src/modules/<name>/`) to a new standalone service repository.
2. In the target module, replace in-process `IEventBus` with a message broker adapter (RabbitMQ/Kafka).
3. The originating module's database tables already reside in their dedicated PostgreSQL schema namespace, meaning the database can be peeled off or split with zero schema changes.
4. Replace callers of the in-process public API (`IOrderModulePublicApi`) with an HTTP or gRPC client using the identical TypeScript contract from `@monolith/contracts`.
