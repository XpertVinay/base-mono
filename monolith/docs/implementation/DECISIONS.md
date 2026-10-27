# Operational & Design Decisions

**Project:** Real Estate CareTaking Platform  
**Scope:** Operational design decisions that do not require full Architecture Decision Records (ADR).

---

## Decision 001: Integration of Real Estate Modules alongside Baseline Monolith
- **Context:** The repository currently has a PERN modular monolith foundation with infrastructure for security, correlation IDs, connection pooling, and event buses.
- **Decision:** Build the dedicated Real Estate CareTaking modules (`property`, `caretaking`, `maintenance`, updating `iam`) following the exact 4-tier Clean Architecture pattern (Domain, Application, Infrastructure, Presentation) and wire them cleanly into the central registry.
- **Consequence:** Preserves all existing architectural tests, security middleware, and CI pipelines while delivering the full functional scope defined in `.ai/prd.md` and `.ai/architecture.md`.

## Decision 002: Maintenance Equilibrium Engine Priority & SLA Matrix
- **Context:** As outlined in `docs/architecture/maintenance-management-equilibrium.md`, maintenance requests require dynamic priority triage between tenant habitability urgency and owner financial safety.
- **Decision:** Implement strict SLA rules:
  - **P1 Emergency**: 15 min response SLA, 4 hr resolution SLA; auto-covered by pre-authorized emergency float escrow up to owner configured limit.
  - **P2 Urgent**: 1 hr response SLA, 24 hr resolution SLA; auto-escalated if unanswered.
  - **P3 Standard**: 4 hr response SLA, 72 hr resolution SLA; standard quotation review.
  - **P4 Routine**: 24 hr response SLA; scheduled review.
