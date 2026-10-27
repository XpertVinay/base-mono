# Implementation Roadmap

**Project:** Real Estate CareTaking Platform  
**Architecture:** DDD + Modular Monolith + Event-Driven  
**Stack:** Node.js, Express, TypeScript, PostgreSQL, React, Vite  

---

## Phase 1: Foundation, Governance & Contract Modernization
- **Goal:** Align monorepo contracts, documentation governance, and module boundaries with the approved Real Estate CareTaking PRD (`.ai/prd.md`) and Technical Architecture (`.ai/architecture.md`).
- **Tasks:**
  1. Establish governance artifacts: `traceability.md`, `ROADMAP.md`, `STATUS.md`, `DECISIONS.md`.
  2. Implement shared domain contracts in `@monolith/contracts` for:
     - `iam`: Real estate roles (`OWNER`, `CARETAKER`, `TENANT`, `BUYER`, `VENDOR`, `AGENT`, `LEGAL`, `ADMIN`).
     - `property`: Property definitions, Address VO, Property Categories, Specifications, Status machine.
     - `caretaking`: Caretaker profile, Property assignment, Permission scopes, Thresholds.
     - `maintenance`: Equilibrium Engine (Priority triage P1-P4, SLA deadlines, Emergency float authorization, Quotations, Work orders).
     - `document`: Secure Vault metadata, document types, verification statuses.
     - `rental` & `sale`: Listing contracts, enquiry pipelines, offers.
     - `finance`: Ledger entries, expense approvals, payment states.
- **Completion Criteria:** All contracts strongly typed, exported from `@monolith/contracts`, and building cleanly.

---

## Phase 2: Core Domain & Clean Architecture Modules (Backend API)
- **Goal:** Implement the authoritative backend domain models, application use cases, repositories, and HTTP endpoints in `apps/api/src/modules/` respecting strict module boundaries and OWASP alignment.
- **Tasks:**
  1. **IAM Module Update**:
     - Support all Real Estate CareTaking roles with strict token verification and account statuses.
  2. **Property Module (`modules/property`)**:
     - Domain: Property Aggregate, Address Value Object, Property Type, Property Status transitions (`VACANT`, `RENTED`, `UNDER_MAINTENANCE`, `LISTED_FOR_RENT`, `LISTED_FOR_SALE`).
     - Application: CreatePropertyUseCase, ListPropertiesUseCase, GetPropertyDetailsUseCase, UpdatePropertyStatusUseCase.
     - Infrastructure: Property In-Memory / PostgreSQL Repository.
     - Presentation: Validated HTTP Controller, Zod schemas, routes.
  3. **Caretaking & Assignment Module (`modules/caretaking`)**:
     - Domain: CaretakerProfile, CaretakerAssignment Aggregate, Permission Grants, Spending Limit Thresholds.
     - Invariants: A caretaker cannot access a property without an active, accepted assignment; Zero-spend without explicit threshold approval.
     - Application: OnboardCaretakerUseCase, AssignCaretakerUseCase, AcceptAssignmentUseCase, GrantPermissionUseCase, RevokePermissionUseCase.
     - Presentation: Validated Controller, routes, error handling.
  4. **Maintenance & Equilibrium Module (`modules/maintenance`)**:
     - Domain: MaintenanceRequest Aggregate, Dynamic Priority Triage (P1 Emergency - 15min/4hr SLA, P2 Urgent, P3 Standard, P4 Routine), Emergency Float Escrow, Quotations, Work Orders, Completion Proofs (GPS, before/after images).
     - Application: SubmitMaintenanceRequestUseCase, TriagePriorityUseCase, AuthorizeEmergencyWorkUseCase, ApproveQuotationUseCase, CompleteWorkOrderUseCase.
     - Presentation: Validated Controller, routes.
  5. Module registration & routing integration in `apps/api/src/app.ts` and `bootstrap/register-modules.ts`.
- **Completion Criteria:** Architecture boundary tests pass, unit tests for domain invariants and state transitions pass, OWASP security controls pass.

---

## Phase 3: Web Application Frontend (React + TypeScript)
- **Goal:** Build a state-of-the-art, responsive, and visually stunning web application for Property Owners, Caretakers, and Tenants.
- **Tasks:**
  1. Design system: Modern dark/light glassmorphic styling, curated color palette, accessible typography, micro-animations.
  2. Core Views & Dashboards:
     - **Property Portfolio View**: Interactive property cards, status tags, unit details, address and amenity specs.
     - **Caretaker Coordination View**: Active assignments, granular permission toggles, spending limit settings.
     - **Maintenance & Equilibrium Triage Engine**: Real-time SLA tracker, P1-P4 priority triage queue, emergency float approvals, quote comparisons.
     - **Document Vault**: Document categorization (Title deeds, Tax, Leases), verification badge indicators.
     - **Financial & Expense Tracker**: Itemized repair costs, approval threshold workflows.
  3. API Client integration connecting to backend endpoints.
- **Completion Criteria:** UI responsive, fluid animations, full type-safety with `@monolith/contracts`.

---

## Phase 4: Quality Gates, Architecture Tests & Documentation
- **Goal:** Full verification against `AGENTS.md` Definition of Done.
- **Tasks:**
  1. Run architecture boundary enforcement (`test:arch`).
  2. Run security suite (`test:security`).
  3. Run comprehensive unit & integration tests (`test`).
  4. Update `traceability.md`, `STATUS.md`, and module documentation.
