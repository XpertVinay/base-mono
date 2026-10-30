# Changelog — Real Estate CareTaking Platform

All notable changes to this platform are documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-10-30

### Added
- **Dynamic Role-Based Access Control (RBAC) & Tenant Authorization (Sprint 04)**:
  - Database migration `007_iam_dynamic_rbac.sql` introducing `iam.permissions`, `iam.tenant_roles`, and `iam.tenant_role_permissions`.
  - Defined 28 granular platform permissions conforming to `<domain>:<action>` across 7 domains (IAM, Property, Caretaking, Maintenance, Finance, Rental, Document).
  - Pre-configured baseline system roles (`ORGANIZATION_OWNER`, `ORGANIZATION_ADMIN`, `PROPERTY_MANAGER`, `CARETAKER`, `FINANCE_CONTROLLER`, `LEGAL_OFFICER`, `TENANT`, `GUEST`).
  - Organization custom roles allowing tenants to define unique roles and toggle granular permission assignments within their organization boundary.
  - Domain entity `TenantRole` and persistence repository `PostgresTenantRoleRepository` with resilient fallback caching.
  - Application use cases: `CreateTenantRoleUseCase`, `UpdateRolePermissionsUseCase`, `AssignRoleToMemberUseCase`, `DeleteTenantRoleUseCase`, and queries `EvaluatePermissionQuery`, `ListTenantRolesQuery`, `GetTenantRoleQuery`.
  - Presentation authorization guards: `requirePermission` and `requirePermissions` Express middlewares enforcing deny-by-default access with RFC 7807 problem details.
  - Enforced primary organization owner invariants (owners automatically satisfy all permissions within their tenant and cannot be demoted or stripped of permissions).
  - Suspended member security enforcement: members in `SUSPENDED` status resolve to 0 permissions and are blocked with 403 Forbidden.
  - Dedicated automated test suite `apps/api/src/tests/unit/dynamic-rbac.test.ts` with 18/18 passing tests covering permission resolution, custom roles, multi-tenant boundary isolation, owner invariants, guard middleware, suspended member blocking, and dynamic MFA challenges.

---

## [1.0.0] - 2026-10-30

### Added
- **Multi-Tenant Organization & Membership Architecture (Sprint 03)**:
  - Database migration `006_iam_organizations_and_memberships.sql` introducing `iam.organizations`, `iam.organization_memberships`, and `iam.organization_invitations`.
  - Organization domain entities, value objects, and persistence repositories with dual PostgreSQL and in-memory test fallback stores.
  - Multi-tenant application commands and queries: organization registration, profile editing, status lifecycle transitions (`ACTIVE`, `SUSPENDED`, `ARCHIVED`), member invitations by email, invitation accept/reject flows, join requests, and member management.
  - Tenant context resolution middleware (`createTenantContextMiddleware`, `requireTenantMembership`, `requireOrgAdmin`) ensuring requests are strictly bounded to active user memberships and cross-tenant access is blocked with 403 Forbidden.
  - REST API surface mounted under `/api/iam/organizations*`, `/api/iam/invitations*`, and `/api/iam/me/organizations`.
  - Comprehensive multi-tenant automated test suite (18/18 passing tests) covering lifecycle, multi-org membership without user duplication, invitation workflows, and all 5 mandatory tenant isolation security tests.
- **Dedicated Documentation Structure**: Established canonical `ai/` instruction files (`PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `MODULE_MAP.md`, `DEVELOPMENT_RULES.md`, `DATA_MODEL.md`, `API_CONVENTIONS.md`, `DECISIONS.md`, `SECURITY_MODEL.md`), sprint records (`sprints/SPRINT_00.md` to `SPRINT_19.md`), handover docs (`CURRENT_STATE.md`, `CHANGELOG.md`), and `implementation/STATUS.md`.
- **Modern React Enterprise Frontend**: Delivered six dedicated views in `@monolith/web`:
  - `PropertyView`: Property portfolio, status state transitions, emergency float overview, and onboarding modal.
  - `CaretakingView`: Caretaker network roster, property delegations, granular permission toggles, and spending threshold slider.
  - `MaintenanceEquilibriumView`: Dynamic triage queue (P1-P4), emergency float badge, quotation approval workflow, and GPS photo telemetry proofs.
  - `RentalView`: Active rental listings, yield metrics, tenant lead funnel table, and lease scheduling actions.
  - `DocumentVaultView`: Property legal document repository, classification filters, verification status badges, and legal audit approval buttons.
  - `FinanceView`: Property financial ledger, cash flow summary cards, owner approval gates, and settlement execution.
- **Dynamic Multi-Tenant Theme Engine**: White-label dynamic theme generator applying organization branding, palette, and typography from `app_config.tenant_configurations`.
- **Mobile Client Hardening**: Integrated `X-Device-Fingerprint`, `X-Tenant-ID`, and `X-Correlation-ID` automated header injection in `boilerplate/mobile/src/core/api/apiClient.ts` with Expo SecureStore token persistence.

---

## [0.9.0] - 2026-10-27

### Added
- **Asymmetric RS256 Token Hardening**: Implemented RSA key management in `TokenService`, RS256 JWT signing, tenant claim propagation, and RFC 7517 compliant OpenID Connect JWKS endpoint at `/api/iam/.well-known/jwks.json`.
- **Anti-Session Hijacking**: Integrated persistent device fingerprinting (`X-Device-Fingerprint`) with User-Agent HMAC validation in `auth.middleware.ts`, while intentionally decoupling client IP from token hash to support mobile cellular/Wi-Fi roaming.
- **Dynamic MFA Route Protection**: Added `iam.mfa_protected_routes` supporting database-driven path protection with `SESSION_24H` and `EVERY_TIME` verification modes.
- **Immutable Security Audit Log**: Created `iam.audit_logs` tracking user logins, MFA challenges, permission grants, and access violations.
- **Hierarchical Multi-Tenant Config**: Built relational `app_config.tenant_configurations` supporting per-tenant branding and policy overrides with in-memory TTL caching.

---

## [0.8.0] - 2026-10-23

### Added
- **Real Estate Domain Modules in Backend API**:
  - `property`: 4-tier Clean Architecture, Address VO, emergency float limits, and lifecycle state machine.
  - `caretaking`: Caretaker profiles, property assignments, granular permission scopes, spending threshold enforcement, and instant permission revocation (`FR-ASG-010`).
  - `maintenance`: Maintenance Equilibrium Engine, dynamic priority triage (P1-P4), SLA targets, pre-authorized emergency float escrow, quotation thresholds, and anti-fraud GPS/photographic telemetry proofs.
  - `rental`: Rental listing publishing, tenant lead qualification funnel, and on-site visit scheduling.
  - `document`: Encrypted property document custody vault, classification tagging, and dual-key legal verification workflows.
  - `finance`: Property financial ledgers, double-entry expense classification, owner approval gates, and settlement invariant enforcement.
- **Shared Domain Contracts**: Added strongly typed contracts and DTOs in `@monolith/contracts`.
- **Route Registration**: Mounted business module endpoints under `/api/*` in `apps/api/src/bootstrap/register-routes.ts`.

---

## [0.5.0] - 2026-10-15

### Added
- **Monorepo Inception & Baseline Architecture**:
  - pnpm workspace scaffolding with `@monolith/api`, `@monolith/web`, and `@monolith/contracts`.
  - PostgreSQL schema isolation runner and migration harness.
  - AST-based architecture enforcement tests (`apps/api/src/tests/architecture/module-boundaries.test.ts`).
  - OWASP Top 10 security test suite (`apps/api/src/tests/security/security-controls.test.ts`).
  - Health check probes (`/health/live`, `/health/ready`).

