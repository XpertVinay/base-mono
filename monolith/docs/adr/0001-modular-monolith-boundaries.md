# ADR 0001: Modular Monolith Architecture & Module Boundaries

## Status
Accepted

## Context
We require an architecture that avoids the complexity and distributed transaction overhead of microservices, while eliminating the tight coupling and code tangling common in traditional monolithic applications.

## Decision
1. Organize the backend as a single deployable unit divided into strict business modules (IAM, Asset, Config, Notification, Scheduler, Order, Transaction, Gateway, Search, Inventory).
2. Each module exposes a single public entry point (`index.ts`). Private repositories, ORM models, and internal use cases are strictly internal to the module.
3. Module boundaries are automatically enforced in CI using AST-based architecture tests (`module-boundaries.test.ts`).
4. Database tables reside in dedicated PostgreSQL schemas per module (`iam.*`, `orders.*`, etc.). Cross-schema SQL joins are strictly forbidden.

## Consequences
- **Positive**: Single codebase, straightforward local development, fast build/test cycles, zero network hop latency between modules.
- **Positive**: Each module is autonomously extracted into an independent microservice in the future by moving its folder and database schema.
- **Trade-off**: Requires discipline and automated lint/architecture tests to prevent developers from bypassing module boundaries.
