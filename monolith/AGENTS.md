# AGENTS.md
# Real Estate CareTaking — AI Engineering Governance

**Version:** 1.0  
**Status:** Mandatory  
**Project:** Real Estate CareTaking  
**Primary References:** `PRD.md`, `architecture.md`  
**Applies To:** All AI coding agents, automated development workflows, and human contributors.

---

# 1. Mission and Operating Principles

You are an AI software engineering agent responsible for implementing the Real Estate CareTaking platform according to the approved Product Requirements Document and Technical Architecture.

Your responsibility is not simply to generate code. You must deliver a correct, secure, testable, maintainable, observable, and production-oriented application while preserving the approved business requirements and architectural constraints.

You must continuously maintain alignment between:

- Product requirements.
- Technical architecture.
- Domain and business rules.
- Implementation.
- Automated tests.
- Security requirements.
- Performance objectives.
- Documentation.
- Deployment and operational readiness.

**Never sacrifice correctness, security, or architectural integrity to maximize code output or implementation speed.**

## 1.1 Mandatory Principles

1. **One Sprint, One Objective**: Avoid bundling disparate domains (e.g., identity, RBAC, assets, property management) together. Each sprint must tackle one single, cohesive, bounded objective with unambiguous boundaries.
2. **Repository as Memory**: Never depend on chat history as the source of project context. Every architectural decision, schema change, contract update, and sprint progression must be recorded directly in repository files (`ai/`, `STATUS.md`, `CURRENT_STATE.md`, `CHANGELOG.md`, `DECISIONS.md`).
3. **Evidence-Based Progression**: A sprint is complete *only* when its code, migrations, tests, and acceptance criteria have been verified with observed terminal execution output. No speculative or unverified "done" claims.
4. **Just-In-Time Sprint Specifications**: Avoid creating all 20 sprint specification files upfront. Start with Sprint 00, establish the architecture baseline, and generate detailed specifications only for the next immediate sprints based on actual repository findings.
5. **Read Requirements First**: Read the relevant requirements before implementation.
6. **Inspect Before Modifying**: Understand the existing repository before modifying it.
7. **Plan Before Substantial Changes**: Plan work before making substantial changes.
8. **Follow PRD & Architecture**: Follow the PRD and `architecture.md`.
9. **Implement One Coherent Increment**: Implement one coherent, verifiable increment at a time.
10. **Test-Driven Development**: Follow TDD for meaningful business logic and critical state transitions.
11. **Reuse Existing Patterns**: Reuse existing implementations when they satisfy the requirement.
12. **Enforce SOLID & DDD**: Enforce SOLID, DDD, and appropriate design patterns.
13. **Strict Module Isolation**: Keep the modular monolith modular and enforce its boundaries.
14. **Server-Side Validation**: Validate every important business rule on the server.
15. **No Premature Completion**: Never mark untested or incomplete functionality as complete.
16. **Document Deviations**: Document deviations, blockers, assumptions, and technical debt.
17. **No Unrelated Changes**: Do not introduce unrelated changes.
18. **No Unobserved Success Claims**: Do not claim a command, test, scan, or deployment succeeded unless its result has been observed.
19. **Stop on Ambiguity**: Stop and report when a required decision cannot safely be inferred.

## 1.2 Rules to Prevent AI Hallucinations and Scope Creep

To maintain software integrity, prevent context degradation, and eliminate scope creep, all AI agents must strictly abide by the following prevention matrix:

| Problem | Prevention Rule | Operational Enforcement |
| :--- | :--- | :--- |
| **Agent invents existing functionality** | **Inspect source code before implementation** | Search codebase, AST exports, and existing module structures before writing any code. Never assume an abstraction is missing without verification. |
| **Agent forgets previous decisions** | **Maintain `DECISIONS.md`** | Review `ai/DECISIONS.md` prior to any structural design. Document all new architectural decisions, rationale, and consequences immediately. |
| **Agent changes unrelated files** | **Enforce sprint scope** | Confine file additions and modifications strictly to the declared scope of the active sprint or task. Do not refactor unrelated modules. |
| **Agent repeats completed work** | **Verify `STATUS.md` and actual code** | Cross-reference `implementation/STATUS.md` and inspect existing test suites and git history before beginning tasks to confirm genuine baseline state. |
| **Agent creates duplicate entities** | **Maintain `DATA_MODEL.md`** | Audit `ai/DATA_MODEL.md` and existing schema migrations before declaring new entities or tables. Maintain single-source truth for data models. |
| **Agent invents API conventions** | **Maintain `API_CONVENTIONS.md`** | Strictly adhere to `ai/API_CONVENTIONS.md` for REST route paths, HTTP verbs, payload envelopes (`data`, `error`), and standard headers (`X-Tenant-ID`, `X-Correlation-ID`). |
| **Agent skips tests** | **Definition of Done** | No feature or bugfix is complete without automated unit/integration tests executing with observable passing terminal output. |
| **Agent loses session context** | **Update `CURRENT_STATE.md`** | Keep `ai/handover/CURRENT_STATE.md` synchronized at every task boundary, documenting exact progress, open issues, and the single next action. |
| **Agent starts future features** | **Explicit sprint boundary** | Strictly enforce sprint boundaries. When the active sprint's acceptance criteria are fulfilled, stop immediately and await user direction before starting future sprints. |

---

# 2. Source of Truth and Instruction Precedence

## 2.1 Authoritative Artifacts

The repository must maintain the following documents.

| Artifact | Purpose | Authority |
|---|---|---|
| `PRD.md` / `ai/PROJECT_CONTEXT.md` | Product scope, user journeys, requirements, acceptance criteria | Product behavior |
| `architecture.md` / `ai/ARCHITECTURE.md` | Architecture, module boundaries, technology standards, security | Technical design |
| `AGENTS.md` / `ai/DEVELOPMENT_RULES.md` | AI execution rules, development workflow, validation gates | Development process |
| `ai/MODULE_MAP.md` | Modules catalog, responsibilities, public exports, and boundaries | Modular boundaries |
| `ai/DATA_MODEL.md` | Database schemas, table models, indexes, and isolation | Relational data model |
| `ai/API_CONVENTIONS.md` | HTTP methods, REST paths, standard envelopes, and headers | API contracts |
| `ai/SECURITY_MODEL.md` | RS256 JWKS tokens, device fingerprint anti-hijacking, dynamic MFA | Security architecture |
| `docs/adr/` / `ai/DECISIONS.md` | Approved architectural decisions and exceptions | Recorded decisions |
| `docs/requirements/traceability.md` | Mapping of requirements to code and tests | Requirement coverage |
| `docs/implementation/ROADMAP.md` | Ordered implementation phases and dependencies | Delivery sequence |
| `implementation/STATUS.md` / `docs/implementation/STATUS.md` | Current progress, blockers, and next steps | Execution state |
| `ai/sprints/` | Chronological sprint milestone records and deliverables | Sprint delivery tracking |
| `ai/handover/` | Current operational baseline and comprehensive changelog | System handover |
| Module `README.md` files | Module responsibilities, contracts, and operational requirements | Module-level design |
| OpenAPI specifications | API request, response, and error contracts | API compatibility |

Existing files may have different names. Inspect the repository before creating duplicates. If an authoritative artifact is missing, create or request approval for it as appropriate.

## 2.2 Conflict Resolution

Apply these rules:

- Product behavior must follow the approved PRD.
- Technical implementation must follow `architecture.md`.
- Approved ADRs govern decisions explicitly recorded in them.
- This file governs the agent's execution process.
- Existing code is evidence of the current implementation, not automatic proof that its design is correct.
- A test does not override a documented business requirement merely because the existing implementation passes it.
- A newer document does not automatically override another authoritative document unless its approval and supersession are clear.

If two authoritative requirements conflict:

1. Identify the exact conflicting statements.
2. Explain the practical consequences.
3. Identify which implementation decisions are blocked.
4. Continue only with work that does not depend on the unresolved decision.
5. Request a decision from the designated product or technical owner.

Never silently resolve a material product, security, data, or architecture conflict.

---

# 3. Mandatory Repository Discovery

Before modifying code, inspect the repository.

Determine:

- Existing directory structure.
- Language and runtime versions.
- Package manager and lockfiles.
- Existing modules and public interfaces.
- Database schema and migration history.
- Existing API contracts.
- Authentication and authorization implementation.
- Test frameworks and test commands.
- Linting, formatting, and type-checking configuration.
- Build and deployment processes.
- Existing architectural rules.
- Current Git status and unrelated local modifications.

Read:

1. `AGENTS.md` and applicable nested agent instructions.
2. `PRD.md`.
3. `architecture.md`.
4. Relevant ADRs.
5. Relevant module documentation.
6. Existing code and tests affected by the task.

Do not overwrite existing work or discard unrelated user changes.

If the repository is not initialized, create the approved baseline structure before implementing business modules.

Do not create a second application, duplicate module, alternative dependency-injection container, or competing configuration system without first checking whether an equivalent already exists.

---

# 4. Requirement Traceability

Every implemented feature must be traceable to an approved requirement.

## 4.1 Requirement Identifiers

Use stable requirement identifiers.

Examples:

- `AUTH-001`: Authentication requirement.
- `PROP-001`: Property management requirement.
- `ASG-001`: Caretaker assignment requirement.
- `PERM-001`: Permission management requirement.
- `RENT-001`: Rental management requirement.
- `SALE-001`: Sale management requirement.
- `MAINT-001`: Maintenance requirement.
- `DOC-001`: Document management requirement.
- `FIN-001`: Financial management requirement.
- `SEC-001`: Security requirement.
- `PERF-001`: Performance requirement.
- `OPS-001`: Operations and deployment requirement.

Preserve identifiers already defined by the PRD. Do not renumber existing requirements merely to make the documentation look uniform.

## 4.2 Traceability Matrix

Maintain `docs/requirements/traceability.md`.

Each requirement must record:

- Requirement ID.
- Requirement description.
- Priority.
- Related module.
- Dependencies.
- Implementation status.
- Relevant source files or public interfaces.
- Test references.
- Security implications.
- Performance implications, where applicable.
- Acceptance criteria.
- Outstanding issues.

Allowed statuses:

- `NOT_STARTED`
- `IN_PROGRESS`
- `IMPLEMENTED`
- `TESTED`
- `VERIFIED`
- `BLOCKED`
- `DEFERRED`
- `NOT_APPLICABLE`

`IMPLEMENTED` means code exists.

`TESTED` means the relevant automated tests have executed successfully.

`VERIFIED` means all required acceptance checks have passed and supporting evidence is available.

Do not use `VERIFIED` merely because the implementation compiles.

## 4.3 Requirement Changes

When a requirement changes:

1. Update the approved PRD or relevant specification.
2. Identify impacted modules and contracts.
3. Update acceptance criteria.
4. Update the traceability matrix.
5. Update affected tests.
6. Review database and API compatibility.
7. Implement the approved change.

Do not silently redefine the scope while coding.

---

# 5. Mandatory Development Lifecycle

Every feature must follow this lifecycle.

## Phase 1: Understand

- Identify the requirement and its business purpose.
- Read relevant PRD and architecture sections.
- Inspect existing implementations.
- Identify dependencies and affected modules.
- Identify authorization, data isolation, and privacy implications.
- Identify performance and asynchronous processing implications.
- Determine whether the requirement is already implemented.

Deliverable: A concise understanding of the expected behavior.

## Phase 2: Plan

Create a task-specific implementation plan.

The plan must identify:

- Requirement IDs.
- Files and modules affected.
- Public interfaces and contracts affected.
- Database changes.
- Security controls.
- Tests to add or modify.
- Documentation updates.
- Dependencies and blockers.
- Completion criteria.

For substantial changes, break the work into small, independently verifiable tasks.

Do not create a plan that merely lists files to generate. It must explain the behavior each task will deliver.

## Phase 3: Validate the Design

Before implementation, verify that the proposed design:

- Respects module boundaries.
- Follows dependency inversion.
- Places business rules in the correct layer.
- Reuses existing abstractions where appropriate.
- Avoids circular dependencies.
- Uses factories only where justified.
- Preserves data ownership.
- Handles authorization and state transitions.
- Supports required failure handling.
- Does not introduce unnecessary infrastructure.

For a significant architectural change, create or update an ADR before implementing it.

## Phase 4: Test-Driven Development

For meaningful domain behavior and critical state transitions:

1. Write a failing test describing the expected behavior.
2. Run the test and confirm that it fails for the intended reason.
3. Implement the smallest correct change.
4. Run the focused test.
5. Refactor while preserving behavior.
6. Run relevant regression tests.
7. Add tests for discovered edge cases.

Do not fabricate a failing test result if the test was not executed.

If a test-first approach is impractical for a particular task, explain why and still provide appropriate validation before completion.

## Phase 5: Implement

- Implement only the approved scope.
- Follow the standard module structure.
- Keep controllers thin.
- Keep domain rules independent of frameworks.
- Use explicit application use cases.
- Inject dependencies rather than hiding them in global state.
- Use typed DTOs and validated inputs.
- Use transactions for related state changes.
- Add required audit events.
- Implement idempotency where needed.
- Add observability and safe error handling.
- Keep changes small enough to review.

Do not generate a large volume of placeholder files or speculative functionality to make the repository appear complete.

## Phase 6: Validate

Run the applicable checks:

- Formatting.
- Linting.
- Type checking.
- Unit tests.
- Integration tests.
- Contract tests.
- Architecture boundary tests.
- Security tests.
- End-to-end tests.
- Performance tests.
- Build verification.

Inspect the actual results and distinguish passed, failed, skipped, and blocked checks.

## Phase 7: Document

Update the relevant:

- Requirement traceability records.
- Module README.
- API specification.
- Database documentation.
- ADRs.
- Operational runbooks.
- Implementation status.
- Known limitations.

Avoid duplicating the same specification across many documents when a canonical reference can be linked instead.

## Phase 8: Review and Close

Before marking the task complete:

- Confirm acceptance criteria.
- Inspect the complete diff.
- Verify that unrelated files were not changed.
- Check for secrets and sensitive information.
- Check for missing authorization.
- Check for unintended breaking changes.
- Confirm tests actually ran.
- Record remaining risks and limitations.
- Update implementation status.

If a gate fails, fix the issue or report the blocker. Do not bypass a required gate to achieve a nominally completed status.

---

# 6. Incremental Implementation Rules

## 6.1 One Coherent Increment at a Time

A task should deliver one coherent, testable capability.

Examples:

- Create a property.
- Assign a caretaker.
- Grant a property-specific permission.
- Submit a maintenance request.
- Approve a quotation.
- Record maintenance completion.

Avoid implementing every property, rental, sale, finance, and notification module in a single uncontrolled change.

## 6.2 Vertical Slices

Prefer complete vertical slices over broad but unfinished layers.

For example, a caretaker assignment slice should include:

- Validated API input.
- Application use case.
- Domain validation.
- Persistence.
- Authorization.
- Audit history.
- API response.
- Tests.
- Documentation.

Do not create empty controllers and placeholder services for every future module before delivering a working end-to-end feature.

## 6.3 Dependencies

Implement prerequisites before dependent features.

A typical dependency sequence is:

1. Repository standards and build pipeline.
2. Configuration and observability.
3. Authentication and authorization foundations.
4. Property onboarding.
5. Caretaker profiles.
6. Assignments and permission management.
7. Tasks and maintenance.
8. Document management.
9. Rental and sale workflows.
10. Finance and payment integrations.
11. Notifications, reporting, and operational hardening.

This is a suggested sequence, not an unconditional requirement. Follow the actual dependency graph and approved roadmap.

---

# 7. Architecture Compliance Rules

Every change must comply with `architecture.md`.

## 7.1 SOLID

- Keep each class or module cohesive.
- Use interfaces at meaningful dependency boundaries.
- Avoid large classes that combine unrelated business responsibilities.
- Prefer composition over unnecessary inheritance.
- Ensure implementations honor interface contracts.
- Keep public interfaces focused.
- Inject infrastructure dependencies.

## 7.2 DDD

- Implement domain invariants in the appropriate domain or application boundary.
- Use aggregates to protect consistency.
- Use value objects for meaningful concepts.
- Separate business entities from database records and API DTOs.
- Model explicit state transitions.
- Keep bounded contexts aligned with business responsibilities.
- Avoid generic repositories that expose unrestricted persistence operations across modules.

## 7.3 Factory Pattern

Use factories for complex or policy-dependent creation and approved implementation selection.

Do not:

- Create factories for trivial objects without a meaningful benefit.
- Load arbitrary code based on user input.
- Introduce service locators in place of dependency injection.
- Use factories to bypass validation.

## 7.4 Reusability

Before creating a utility or abstraction:

1. Search for existing implementations.
2. Verify that the existing behavior is appropriate.
3. Identify the actual common responsibility.
4. Extract shared behavior only when the abstraction remains cohesive.
5. Test the abstraction independently.
6. Document its supported contract.

Do not create a generic framework around hypothetical future requirements.

## 7.5 Database Ownership

- Each module owns its tables and migrations.
- Cross-module writes must use an approved application contract.
- Do not bypass domain logic with direct SQL from controllers.
- Do not change schemas manually without a migration.
- Do not introduce destructive migrations without an approved deployment plan.
- Preserve existing production data.

---

# 8. Security Governance

Security is a release requirement, not an optional enhancement.

For every feature, assess:

- Authentication.
- Authorization.
- Property-level access.
- Tenant or organization isolation.
- Input validation.
- Output encoding.
- Sensitive data exposure.
- File upload and download controls.
- Rate limiting and resource exhaustion.
- Auditability.
- Error handling.
- External dependency risks.

## 8.1 Property Caretaking Security Invariants

The following are mandatory:

1. A caretaker must not access a property merely by knowing its ID.
2. A caretaker's access must be limited to active, authorized assignments.
3. Permission revocation must prevent subsequent restricted actions.
4. Required owner approvals must be enforced on the server.
5. Approval records must identify the approving actor and timestamp.
6. A vendor must access only the job information required for its assignment.
7. Tenants and buyers must not receive private owner information.
8. Sensitive documents must not be publicly accessible.
9. Administrative privileges must be explicitly scoped and audited.
10. Payment and financial state must not be trusted solely from client input.
11. Duplicate requests and webhook replays must not create duplicate financial effects.
12. Security failures must not reveal sensitive data.

## 8.2 Vulnerability Management

- Use maintained, approved dependencies.
- Run automated dependency and secret scans.
- Fix security regressions before marking a task complete.
- Never suppress security findings merely to make CI pass.
- Document and escalate any required security exception.
- Do not claim OWASP compliance or successful VAPT without appropriate evidence.

## 8.3 Sensitive Data

Never commit:

- Production credentials.
- API keys.
- Private keys.
- Access tokens.
- Database passwords.
- Real owner identity documents.
- Real property documents.
- Unnecessary production personal data.

Use environment-specific configuration and approved secret management.

---

# 9. Performance and Background Processing

Follow the latency objectives in `architecture.md`.

## 9.1 API Performance

- Measure p50, p95, and p99 latency.
- Use pagination for large collections.
- Avoid N+1 queries.
- Avoid unnecessary database round trips.
- Use appropriate indexes.
- Avoid blocking operations in request handlers.
- Use bounded timeouts for external dependencies.
- Monitor connection pools and query duration.
- Optimize based on measurements, not speculation.

The routine API target is p95 at or below 200 ms under the agreed representative workload.

Do not claim this target is achieved without performance evidence.

## 9.2 Background Processing

Move suitable long-running work to background processing, including:

- Bulk notifications.
- Large document processing.
- Bulk imports and exports.
- Expensive report generation.
- Non-critical external synchronization.
- AI processing.

Return `202 Accepted` only when the requested work has been durably accepted.

Use a job identifier, observable job state, retries, idempotency, and failure reporting.

## 9.3 Operations That Must Preserve Immediate Correctness

Do not defer authoritative business decisions merely to meet a latency target.

Examples include:

- Recording an owner approval.
- Revoking a permission.
- Persisting an offer decision.
- Enforcing an expense threshold.
- Recording an authoritative payment status transition.

Optimize the synchronous critical path and defer suitable side effects.

---

# 10. Database and Migration Safety

Before every database change:

1. Identify affected tables and modules.
2. Inspect existing schema and migrations.
3. Define constraints and indexes.
4. Evaluate data migration requirements.
5. Evaluate compatibility with currently deployed application versions.
6. Write a reversible migration where practical.
7. Test migration and rollback or recovery procedures.
8. Consider locking and table size.
9. Document any irreversible operation.

Prefer expand-and-contract migrations.

Never delete, overwrite, or reset existing production data to make a test pass.

Tests must use isolated test data and an appropriate test database.

For changes involving payments, ownership, assignments, permissions, or audit records, evaluate transactional consistency explicitly.

---

# 11. Event-Driven Processing Rules

When introducing events:

- Distinguish commands from events.
- Use explicit, versioned contracts.
- Avoid embedding unnecessary sensitive information.
- Use a transactional outbox for business events requiring durable publication.
- Make consumers idempotent.
- Apply bounded retries and backoff.
- Handle duplicate and out-of-order delivery where relevant.
- Provide dead-letter monitoring and recovery.
- Propagate correlation identifiers.
- Document event ownership and consumer dependencies.

Do not use asynchronous events to bypass authorization or hide failed business operations.

Do not introduce a message broker when a simple in-process call is sufficient and durable delivery is unnecessary.

---

# 12. Frontend and API Consistency

- Follow the approved React and TypeScript structure.
- Reuse existing UI components and form patterns.
- Use typed API contracts.
- Centralize request and error handling.
- Provide loading, success, empty, and failure states.
- Validate forms on the client for usability and on the server for correctness.
- Avoid duplicating authoritative business logic in React.
- Keep role-specific UI aligned with backend permissions.
- Do not expose sensitive data in browser storage or public URLs unnecessarily.
- Ensure API documentation reflects actual behavior.

If an API contract changes, identify and update all affected consumers and contract tests.

---

# 13. Testing and Quality Gates

## 13.1 Mandatory Tests

Every applicable change must have appropriate coverage across:

- Unit tests.
- Integration tests.
- Contract tests.
- End-to-end tests.
- Security tests.
- Performance tests.

Not every trivial documentation-only change requires every test category. The agent must identify which checks are applicable and why.

## 13.2 Critical Regression Scenarios

Maintain regression tests for:

- Unauthorized property access.
- Cross-tenant data access.
- Caretaker permission escalation.
- Revoked permissions.
- Approval bypass.
- Duplicate payment processing.
- Invalid state transitions.
- Document access violations.
- Event retries and replay.
- Concurrent modifications.
- Failed background jobs.
- API and database compatibility during deployments.

## 13.3 Failure Reporting

For each validation command, report:

- Command executed.
- Result.
- Relevant failure details.
- Whether the failure is related to the current change.
- Any blocked checks.

Never fabricate test output, skip a required check without disclosure, or report a successful build when the command failed.

---

# 14. CI/CD and Deployment Safety

Every change must remain compatible with the approved deployment strategy.

The agent must consider:

- Build reproducibility.
- Dependency locking.
- Environment configuration.
- Container security.
- Database migration order.
- API compatibility.
- Event compatibility.
- Readiness and liveness checks.
- Graceful shutdown.
- Rollback or roll-forward.
- Observability and alerting.

Never deploy to production, alter live infrastructure, delete production data, rotate production credentials, or perform irreversible actions without explicit authorization.

Do not introduce Kubernetes resources or IaC changes unless they are part of the approved scope.

When a module is prepared for future service extraction, preserve clear contracts and data ownership without prematurely creating separate deployments.

---

# 15. AI Agent Task Management

Maintain the following implementation artifacts:

## 15.1 `docs/implementation/ROADMAP.md`

Record:

- Delivery phases.
- Features.
- Requirement IDs.
- Dependencies.
- Completion criteria.
- Approved deferrals.

## 15.2 `docs/implementation/STATUS.md`

Record:

- Current phase.
- Current task.
- Completed tasks.
- Tasks in progress.
- Pending tasks.
- Blocked tasks.
- Latest validation results.
- Known risks.
- Next recommended task.

## 15.3 `docs/implementation/DECISIONS.md`

Use only for operational decisions that do not warrant a formal ADR. Material architecture decisions belong in `docs/adr/`.

## 15.4 Progress Rules

- Update status after completing a meaningful increment.
- Do not mark partially implemented features as complete.
- Keep blockers explicit.
- Record assumptions requiring confirmation.
- Do not erase historical decisions to conceal a failed approach.
- Avoid creating duplicate task-tracking systems.
- Preserve enough context for another agent to continue safely.

The status file must reflect observed repository state, not merely the agent's intended work.

---

# 16. Multi-Agent Coordination

If multiple AI agents are available, assign responsibilities explicitly.

Suggested roles:

- Product Analyst: Requirement decomposition and traceability.
- Architect: Domain boundaries, contracts, and ADRs.
- Developer: Implementation and tests.
- QA Engineer: Independent verification and regression testing.
- Security Reviewer: Threat analysis and security validation.
- DevOps Engineer: Build, deployment, IaC, and operational readiness.

## Coordination rules

1. Assign one owner to each implementation task.
2. Define file and module ownership when work overlaps.
3. Avoid concurrent changes to the same migration, contract, or shared interface without coordination.
4. Require interface agreements before parallel implementation.
5. Integrate changes through reviewed commits or equivalent controlled changes.
6. Run the combined test suite after integration.
7. Resolve conflicting implementations before merging.
8. Do not treat another agent's completion claim as validation evidence.
9. Keep a single authoritative progress record.

Parallel execution is permitted only when dependencies and shared-file conflicts are controlled.

---

# 17. Change Management

Classify each task before implementation.

### Type A — Small change

Examples: documentation correction, isolated bug fix, minor UI adjustment.

Required: focused review, applicable tests, and documentation updates where needed.

### Type B — Feature change

Examples: new maintenance workflow, property listing, caretaker assignment.

Required: implementation plan, traceability updates, tests, security review, API documentation, and acceptance validation.

### Type C — Architectural change

Examples: module extraction, database ownership change, new messaging infrastructure, authentication redesign.

Required: ADR, dependency analysis, migration plan, security and performance assessment, compatibility testing, and explicit approval where required.

### Type D — High-risk change

Examples: financial processing, authorization changes, ownership-related workflows, document access, destructive migrations, production infrastructure changes.

Required: explicit risk assessment, additional tests, independent review where available, recovery planning, and authorized approval before irreversible operations.

---

# 18. Definition of Done

A feature can be marked `VERIFIED` only when:

- [ ] Its approved requirement IDs are identified.
- [ ] Acceptance criteria are explicit.
- [ ] The implementation matches the PRD.
- [ ] The implementation follows `architecture.md`.
- [ ] Domain rules and state transitions are enforced.
- [ ] Authorization is enforced server-side.
- [ ] Database ownership and migration rules are respected.
- [ ] Required tests pass.
- [ ] Relevant regression tests pass.
- [ ] Applicable security checks pass.
- [ ] Performance has been measured when required.
- [ ] Long-running operations have an appropriate execution strategy.
- [ ] Errors and failure conditions are handled.
- [ ] Audit and observability requirements are satisfied.
- [ ] API and event contracts are documented.
- [ ] Relevant module documentation is updated.
- [ ] Traceability records reflect actual evidence.
- [ ] The diff contains no unrelated changes.
- [ ] Remaining limitations are documented.
- [ ] No unsupported success claims are made.

If any mandatory condition is unmet, retain the appropriate incomplete or blocked status.

---

# 19. Mandatory Task Completion Report

At the end of each meaningful task, report:

## Task Summary
What was implemented and why.

## Requirement Traceability
Which requirement IDs were addressed.

## Files Changed
The important files created, modified, or removed.

## Architecture Compliance
How module boundaries, design principles, and security controls were preserved.

## Tests and Validation
Commands executed, results observed, and checks not run.

## Database and API Changes
Migrations, contracts, events, and compatibility implications.

## Security and Performance
Relevant risks, checks, measurements, and limitations.

## Outstanding Work
Incomplete requirements, blockers, assumptions, and known defects.

## Next Step
The smallest logical task that advances the approved roadmap.

Do not report routine internal reasoning or expose hidden chain-of-thought. Provide decisions, evidence, outcomes, and concise rationale.

---

# 20. Final Enforcement Rule

The PRD defines the product. The architecture defines the engineering boundaries. This document governs how changes are made and verified.

**No feature is complete merely because code has been generated.**

A feature is complete only when its approved behavior is implemented, its critical invariants are enforced, its applicable tests pass, its architectural constraints are respected, and its completion status is supported by evidence.

When requirements are unclear, dependencies are missing, or the proposed implementation violates a mandatory constraint, stop the affected work, explain the issue, and request the necessary decision.

The objective is a coherent, maintainable, secure, and scalable Real Estate CareTaking platform—not the largest possible amount of generated code.
