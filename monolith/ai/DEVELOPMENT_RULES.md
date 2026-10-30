# Real Estate CareTaking — Development Rules & Engineering Standards

**Document:** `DEVELOPMENT_RULES.md`  
**Version:** 1.0  
**Authority:** Mandatory for all AI agents and human contributors  
**Governance:** Governed by `AGENTS.md` and CI automated verification gates

---

## 1. Golden Engineering Rules

1. **One Sprint, One Objective**: Avoid bundling disparate domains (e.g., identity, RBAC, assets, property management) together. Each sprint must tackle one single, cohesive, bounded objective with unambiguous boundaries.
2. **Repository as Memory**: Never depend on chat history as the source of project context. Every architectural decision, schema change, contract update, and sprint progression must be recorded directly in repository files (`ai/`, `STATUS.md`, `CURRENT_STATE.md`, `CHANGELOG.md`, `DECISIONS.md`).
3. **Evidence-Based Progression**: A sprint is complete *only* when its code, migrations, tests, and acceptance criteria have been verified with observed terminal execution output. No speculative or unverified "done" claims.
4. **Just-In-Time Sprint Specifications**: Avoid creating all 20 sprint specification files upfront. Start with Sprint 00, establish the architecture baseline, and generate detailed specifications only for the next immediate sprints based on actual repository findings.
5. **Read Requirements First**: Never write code without reading the corresponding requirements in `PROJECT_CONTEXT.md` and module contracts in `@monolith/contracts`.
6. **Inspect Before Modifying**: Inspect existing repository structures, utilities, and abstractions. Never create duplicate database pools, competing logger instances, or redundant auth middlewares.
7. **Strict Layer Boundary Isolation**:
   - `domain/` must contain zero dependencies on external frameworks (`express`, `pg`, `axios`, etc.).
   - `presentation/` must handle HTTP transport only and delegate business logic directly to `application/` use cases.
   - Modules must never import internal paths of other modules (`modules/<other-module>/domain/...` is prohibited). All cross-module access must flow through `modules/<other-module>/index.ts`.
8. **Test-Driven Development (TDD)**:
   - Meaningful domain logic, state machines, and access control boundaries must have tests written before or concurrently with implementation.
   - Never consider a feature complete until automated tests execute and pass.
9. **Fail-Closed Security (Deny-by-Default)**:
   - Any new endpoint must explicitly define its authentication and authorization requirements.
   - Public endpoints must be explicitly declared as public exceptions.
10. **No Unobserved Success Claims**:
   - Never report that a test, build, lint, or migration succeeded unless its actual terminal execution output has been observed.

---

## 2. Prevention of AI Hallucinations & Scope Creep

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

## 3. Coding and TypeScript Standards

- **Strict Type Checking**:
  - `strict: true` is enforced across all `tsconfig.json` configurations.
  - Usage of `any` is forbidden. Use `unknown`, generic parameters, or strictly typed DTOs.
  - Nullability must be handled explicitly; avoid non-null assertions (`!`) unless proven safe by preceding guards.
- **File & Naming Conventions**:
  - File names: kebab-case (`property.entity.ts`, `create-property.use-case.ts`, `postgres-property.repository.ts`).
  - Class names: PascalCase (`Property`, `CreatePropertyUseCase`, `PostgresPropertyRepository`).
  - Interfaces: PascalCase prefixed with `I` for repository ports (`IPropertyRepository`) or descriptive names for contracts.
  - Constants and Enums: UPPER_SNAKE_CASE (`PropertyStatus.ACTIVE`, `RentalCategory.COMMERCIAL`).
- **Input Validation**:
  - All incoming request bodies, route parameters, and query strings must be validated at the presentation boundary using Zod schemas or contract type validators.

---

## 4. Database & Persistence Rules

1. **Schema Isolation**: Each module owns its dedicated PostgreSQL schema (`iam`, `property`, `caretaking`, `maintenance`, `rental`, `document`, `finance`, etc.).
2. **No Cross-Schema Foreign Keys**: Foreign keys between tables of different schemas are prohibited to maintain loose coupling and enable future microservice decoupling. Cross-module references are maintained via UUID strings.
3. **Parameterized Queries Only**: Raw SQL concatenations and string interpolations are strictly prohibited to prevent SQL injection vulnerabilities. Always use parameterized queries (`$1, $2, ...`).
4. **Transactional Outbox for Domain Events**: Any domain state change that triggers downstream asynchronous side effects must be written atomically to `common.outbox_events` in the same transaction.

---

## 5. Verification Gates & Local Commands

Run these verification commands before submitting changes:

```bash
# 1. Type check all workspace packages
pnpm typecheck

# 2. Enforce AST-based module isolation and clean architecture layers
pnpm test:arch

# 3. Verify OWASP security controls, headers, and RBAC policies
pnpm test:security

# 4. Run full domain and behavioral unit tests
pnpm test

# 5. Build production bundle
pnpm build
```

---

## 6. Implementation Tracking & Documentation Sync

Whenever completing a task or milestone:
- Record task progress in `monolith/implementation/STATUS.md`.
- Document new architectural decisions or operational changes in `monolith/ai/DECISIONS.md`.
- Update requirement traceability in `docs/requirements/traceability.md` if requirement status changes.
- Ensure all relevant sprint records in `monolith/ai/sprints/` reflect delivered deliverables.

