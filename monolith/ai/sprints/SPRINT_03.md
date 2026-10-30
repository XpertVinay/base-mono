# Sprint 03: Multi-Tenant Organization Management

**Sprint ID:** `SPRINT_03`  
**Theme:** Platform Foundation — Organizations, Memberships, Context Resolution & Tenant Isolation  
**Status:** `COMPLETED / VERIFIED`  
**Core Components:** Organizations, onboarding, memberships, invitations, join requests, tenant context resolution, tenant isolation enforcement

---

## 1. Objectives & Scope

1. **Organization Lifecycle Management**:
   - Organization registration with unique slug, display name, organization type (`PROPERTY_MANAGEMENT`, `HOA`, `REAL_ESTATE_AGENCY`, `ENTERPRISE`, `FAMILY_OFFICE`), and initial settings.
   - Profile updating and lifecycle state transitions (`ACTIVE`, `SUSPENDED`, `ARCHIVED`).
   - Primary owner association (`ownerUserId`), ensuring the creator is automatically registered as an active `ADMIN` member.

2. **Membership & Invitation Management**:
   - Support multiple organizations per user without duplicating user identities.
   - Email invitation workflow with secure token generation, expiration enforcement, and accept/reject transitions.
   - Membership request workflow (user requests to join -> admin approves or rejects).
   - Member management: role assignment (`ADMIN`, `MEMBER`, `GUEST`), suspension, reactivation, and removal.
   - Invariant enforcement: primary organization owner cannot be demoted, suspended, or removed.

3. **Tenant Context & Cross-Tenant Isolation**:
   - Resolve active organization context from `X-Tenant-ID` request header or JWT claims.
   - Validate user membership at the API boundary; reject unauthenticated or non-member access with `403 Forbidden`.
   - Prevent cross-tenant leakage: Organization A members cannot read or modify Organization B records.
   - Prevent header-tampering attacks: changing organization identifiers without membership fails authorization.

---

## 2. Delivered Artifacts & Implementation State

### 2.1 Contracts (`@monolith/contracts`)
- Defined domain types and DTOs in `packages/contracts/src/iam/index.ts`:
  - `OrganizationDto`, `CreateOrganizationRequestDto`, `UpdateOrganizationRequestDto`, `UpdateOrganizationStatusRequestDto`
  - `OrganizationMembershipDto`, `UpdateMembershipRequestDto`
  - `OrganizationInvitationDto`, `CreateInvitationRequestDto`
  - `UserOrganizationContextDto`

### 2.2 Database Schema & Migrations
- Migration file: `apps/api/migrations/006_iam_organizations_and_memberships.sql`
  - `iam.organizations`: UUID primary key, unique slug, type, status, `owner_user_id`, JSONB settings, timestamps.
  - `iam.organization_memberships`: UUID primary key, `organization_id`, `user_id`, role, status (`ACTIVE`, `SUSPENDED`, `PENDING`), `joined_at`, timestamps. Unique on `(organization_id, user_id)`.
  - `iam.organization_invitations`: UUID primary key, `organization_id`, email, role, token, status (`PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`), `invited_by_user_id`, `expires_at`, timestamps.

### 2.3 Domain Layer (`apps/api/src/modules/iam/domain`)
- **Entities**:
  - `Organization`: Aggregate root encapsulating slug validation, profile updates, and status transitions.
  - `OrganizationMembership`: Membership entity managing roles (`ADMIN`, `MEMBER`, `GUEST`), status (`ACTIVE`, `SUSPENDED`, `PENDING`), and owner protection invariants.
  - `OrganizationInvitation`: Invitation entity managing token verification, acceptance, rejection, and expiration checks.
- **Repository Interfaces**:
  - `IOrganizationRepository`, `IOrganizationMembershipRepository`, `IOrganizationInvitationRepository`.

### 2.4 Infrastructure Layer (`apps/api/src/modules/iam/infrastructure/persistence`)
- `PostgresOrganizationRepository`: PostgreSQL implementation with fallback in-memory store for isolated test suites.
- `PostgresOrganizationMembershipRepository`: Querying by organization, user, active status, and dual-index lookups.
- `PostgresOrganizationInvitationRepository`: Querying by token, email, and organization with status-aware indexes.

### 2.5 Application Layer (`apps/api/src/modules/iam/application`)
- **Commands**:
  - `CreateOrganizationUseCase`: Atomically registers organization and initial active `ADMIN` membership for the owner.
  - `UpdateOrganizationUseCase`: Validates admin authorization and updates name and settings.
  - `UpdateOrganizationStatusUseCase`: Manages lifecycle transitions (`ACTIVE`, `SUSPENDED`, `ARCHIVED`).
  - `InviteMemberUseCase`: Generates secure invitations for target email addresses.
  - `AcceptInvitationUseCase`: Consumes invitation token and activates user membership in the organization.
  - `RejectInvitationUseCase`: Explicitly marks invitation as rejected.
  - `RequestMembershipUseCase`: Allows users to initiate join requests in `PENDING` state.
  - `UpdateMembershipUseCase`: Modifies membership role or status, preventing self-demotion or owner removal.
  - `RemoveMemberUseCase`: Revokes organization membership.
- **Queries**:
  - `GetOrganizationQuery`: Fetches organization details by ID or slug.
  - `ListUserOrganizationsQuery`: Returns all organizations and membership roles associated with a user identity.
  - `ListOrganizationMembersQuery`: Lists active/suspended members within a tenant boundary.
  - `ListOrganizationInvitationsQuery`: Lists pending invitations for tenant administrators.
  - `ValidateTenantContextQuery`: Validates `X-Tenant-ID` against the authenticated user's active memberships.

### 2.6 Presentation & Middleware Layer (`apps/api/src/modules/iam/presentation`)
- **Middleware** (`tenant-context.middleware.ts`):
  - `createTenantContextMiddleware`: Resolves tenant ID from headers/claims and attaches verified tenant context.
  - `requireTenantMembership`: Guard blocking requests from users lacking active membership in the target tenant.
  - `requireOrgAdmin`: Guard verifying caller holds an `ADMIN` role within the resolved tenant context.
- **Controller & Routes**:
  - Registered 15 REST endpoints under `/api/iam/organizations*`, `/api/iam/invitations*`, and `/api/iam/me/organizations`.

---

## 3. Verification & Quality Gates

### 3.1 Unit & Security Test Suite
- Test file: `apps/api/src/tests/unit/multi-tenant-organizations.test.ts`
- **Results: 18 / 18 tests passing (100%)**
  - **Organization Lifecycle & Administration (5 tests)**:
    - Creates organization and automatically registers creator as active `ADMIN`.
    - Enforces slug uniqueness and rejects duplicates.
    - Allows organization admin to update organization profile.
    - Prevents non-admin member from modifying organization profile.
    - Updates organization lifecycle status (`ACTIVE` -> `SUSPENDED` -> `ARCHIVED`).
  - **Multi-Organization Per User (1 test)**:
    - Single platform identity successfully belongs to multiple distinct organizations with independent roles.
  - **Invitation & Membership Workflows (6 tests)**:
    - Admin invites by email -> user accepts -> becomes active member.
    - User explicitly rejects invitation.
    - Expired invitations are rejected.
    - Join request workflow (`PENDING` -> approved -> `ACTIVE`).
    - Admin suspends, reactivates, and removes member.
    - Primary organization owner cannot be demoted or suspended.
  - **Mandatory Security & Tenant Isolation Tests (5 tests)**:
    - *Security Test 1*: User cannot access an organization without valid membership (returns 403).
    - *Security Test 2*: Suspended members cannot perform protected operations or access tenant context (returns 403).
    - *Security Test 3*: Organization A members cannot read or modify Organization B records (tenant isolation enforced).
    - *Security Test 4*: Changing organization identifiers in headers cannot bypass authorization.
    - *Security Test 5*: Users access multiple organizations through their authorized memberships with appropriate context switching.
  - **Middleware Guard Verification (1 test)**:
    - Resolves active tenant context and enforces `requireOrgAdmin` guard correctly.

### 3.2 Workspace Quality Gates
- `pnpm typecheck`: Passed with 0 errors across all 5 workspace projects (`@monolith/contracts`, `@monolith/api`, `@monolith/web`).
- `pnpm test:arch`: 3/3 AST architecture boundary tests passed.
- `pnpm test:security`: 5/5 OWASP security tests passed.
