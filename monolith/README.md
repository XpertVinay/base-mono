# SOLID Modular Monolith using PERN Stack

A production-ready **Modular Monolith** built with PostgreSQL, Express.js, React, and Node.js with end-to-end TypeScript.

This repository strictly implements Clean Architecture, SOLID principles, OWASP Top 10 (2025) security controls, and guarantees future microservice extraction readiness with zero domain refactoring.

---

## 🌟 Architectural Features

- **Monorepo Structure**:
  - `apps/api`: Node.js & Express Modular Monolith backend.
  - `apps/web`: React 19 frontend organized by feature slices matching backend domains.
  - `packages/contracts`: Stable, explicit API contracts, DTOs, and domain integration events.
  - `packages/typescript-config` & `packages/eslint-config`: Shared developer tooling.
  - `infrastructure/`: Dockerfiles, compose manifests, and PostgreSQL schemas.
  - `docs/`: Comprehensive architecture blueprints, ADRs, security alignment, and runbooks.
- **10 Autonomous Business Modules**:
  1. **IAM**: Identity, password salting, JWT authentication, RBAC authorization.
  2. **Asset**: Asset metadata, ownership tracking, file references.
  3. **Config**: Application runtime settings and dynamic feature flags.
  4. **Notification**: Transactional email/SMS inbox, asynchronous event listeners.
  5. **Scheduler**: Autonomous background cron jobs and execution policies.
  6. **Order**: Order state machine, line items, price calculation, cancellation guards.
  7. **Transaction**: Financial ledger, payment processing, settlement events.
  8. **Gateway**: Protocol routing, health telemetry, module route catalog.
  9. **Search**: Event-projected read model for instant multi-entity search.
  10. **Inventory**: SKU tracking, stock availability levels, reservation guarantees.
- **Microservice Extraction Guarantee**:
  - Modules communicate exclusively via public in-process ports or asynchronous domain integration events.
  - Zero private repository or ORM model cross-imports.
  - Dedicated PostgreSQL schema namespaces (`iam.*`, `orders.*`, `transactions.*`, etc.) with zero cross-schema joins.
- **Automated Architecture Tests**:
  - Validates module import boundaries, detects forbidden cross-imports, and checks for circular dependencies.
- **OWASP 2025 Aligned**:
  - Deny-by-default authorization, resource ownership checks, parameterized queries, rate limiting, and safe error handling.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Automated Test Suite
```bash
# Runs Architecture Tests, Security Controls, and End-to-End Business Integration
pnpm test
```

### 3. Build Monorepo
```bash
pnpm build
```

### 4. Start Local Development
```bash
# Start API (Port 4000)
pnpm dev

# In another terminal, start React Dashboard (Port 5173)
pnpm dev:web
```

Open `http://localhost:5173` to interact with the platform dashboard!

---

## 🧪 Testing Commands

| Command | Purpose |
| :--- | :--- |
| `pnpm test` | Runs all test suites |
| `pnpm test:arch` | Executes AST-based module boundary architecture enforcement |
| `pnpm test:security` | Executes OWASP security tests (Auth, AuthZ, Injection, Headers) |
| `pnpm migrate` | Runs PostgreSQL transactional database migrations |
| `pnpm typecheck` | Validates TypeScript across all monorepo packages |

---

## 📚 Documentation Links
- [Modular Monolith Architecture Blueprint](file:///Users/vinaykumar/Desktop/IMP/base/monolith/docs/architecture/modular-monolith-overview.md)
- [ADR 0001: Modular Monolith Boundaries](file:///Users/vinaykumar/Desktop/IMP/base/monolith/docs/adr/0001-modular-monolith-boundaries.md)
- [ADR 0002: Event-Driven Communication](file:///Users/vinaykumar/Desktop/IMP/base/monolith/docs/adr/0002-inter-module-event-driven-communication.md)
- [ADR 0003: OWASP Security Compliance](file:///Users/vinaykumar/Desktop/IMP/base/monolith/docs/adr/0003-security-and-owasp-compliance.md)
- [Local Development Runbook](file:///Users/vinaykumar/Desktop/IMP/base/monolith/docs/runbooks/local-development.md)
- [Production Deployment Runbook](file:///Users/vinaykumar/Desktop/IMP/base/monolith/docs/runbooks/production-deployment.md)
