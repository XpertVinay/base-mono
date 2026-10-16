# ADR 0002: Inter-Module Event-Driven Communication & Outbox Pattern

## Status
Accepted

## Context
When an action in one module produces side effects in other modules (e.g., placing an order triggers notifications, search indexing, and stock reservation), tight direct synchronous coupling creates cascading failures and prevents future service extraction.

## Decision
1. Cross-module asynchronous workflows communicate via `DomainIntegrationEvent` payloads dispatched across an `IEventBus`.
2. Event payloads are typed and versioned in `@monolith/contracts`.
3. In-process `InMemoryEventBus` is used for the default deployment unit, ensuring zero external message broker (RabbitMQ/Kafka) dependency is needed for local development or monolith deployment.
4. For high-reliability environments, a transactional outbox table (`common.outbox_events`) is included in migrations to support at-least-once delivery guarantees without distributed two-phase commits (2PC).

## Consequences
- **Positive**: Complete loose coupling between business modules.
- **Positive**: Easy plug-and-play for new event consumers (e.g. adding an analytics or audit module without modifying Order code).
- **Trade-off**: Requires handling eventual consistency rather than immediate cross-module transaction rollback.
