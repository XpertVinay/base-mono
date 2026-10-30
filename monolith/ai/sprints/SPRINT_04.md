# Sprint 04: Dynamic Role-Based Access Control (RBAC) & Tenant-Scoped Authorization

**Sprint ID:** `SPRINT_04`  
**Theme:** Platform Foundation — Dynamic Roles, Tenant-Scoped Permissions & Authorization Guards  
**Status:** `COMPLETED & VERIFIED`  
**Prerequisites:** Sprint 00 (Architecture Baseline), Sprint 01 (Database Engine), Sprint 02 (Identity & Cryptography), Sprint 03 (Multi-Tenant Organizations & Memberships)  
**Authority:** Governed by `AGENTS.md` and `ai/DEVELOPMENT_RULES.md`

---

## 1. Executive Summary & Bounded Context

Sprint 04 builds directly upon the multi-tenant organization context established in Sprint 03. While Sprint 03 delivered organization lifecycle, memberships (`ADMIN`, `MEMBER`, `GUEST`), and tenant isolation middleware, access control currently relies on coarse membership checks.

Sprint 04 establishes a **unified, tenant-scoped dynamic Role-Based Access Control (RBAC)** engine. It decouples identity from operational capabilities by introducing granular permissions across domains (Property, Maintenance, Finance, Caretaking, Rental), tenant-customizable role-permission mappings, and fine-grained authorization guards at the API presentation boundary.

---

## 2. Concrete Objectives & Scope

### 2.1 Granular Domain Permissions
Define standardized permission strings conforming to `<domain>:<action>` convention across all platform capabilities:
- **IAM / Tenant**: `iam:members:read`, `iam:members:invite`, `iam:members:manage`, `iam:org:update`
- **Property**: `property:create`, `property:read`, `property:update`, `property:delete`, `property:verify`
- **Caretaking**: `caretaking:assign`, `caretaking:revoke`, `caretaking:inspect`, `caretaking:threshold:set`
- **Maintenance**: `maintenance:ticket:create`, `maintenance:ticket:update`, `maintenance:quote:approve`, `maintenance:p1:mobilize`
- **Finance**: `finance:ledger:read`, `finance:expense:submit`, `finance:expense:approve`, `finance:disburse`
- **Rental**: `rental:listing:create`, `rental:listing:publish`, `rental:lease:sign`
- **Document**: `document:upload`, `document:read`, `document:verify_legal`, `document:reject`

### 2.2 Organization-Scoped Dynamic Roles
- **System Default Roles**: Seed baseline roles (`ORGANIZATION_OWNER`, `ORGANIZATION_ADMIN`, `PROPERTY_MANAGER`, `CARETAKER`, `FINANCE_CONTROLLER`, `LEGAL_OFFICER`, `TENANT`, `GUEST`) with pre-configured permission sets.
- **Tenant Role Overrides**: Enable tenant organizations to define custom roles and adjust permission assignments within their organization boundary (`tenant_id`).

### 2.3 Presentation Boundary Authorization Guards
- `requirePermissions(...permissions: Permission[])`: Express middleware verifying that the authenticated user within the resolved `req.tenantContext` holds all required permissions.
- Deny-by-default evaluation: Missing tenant context, suspended membership, or missing permission results in immediate `403 Forbidden`.
- Super-admin / Owner bypass: Primary organization owners inherently satisfy all tenant-scoped permission checks.

### 2.4 Integration with Dynamic MFA Step-Up
- Harmonize permission evaluation with `iam.mfa_protected_routes`: Sensitive actions (e.g., `finance:disburse`, `iam:members:manage`) automatically trigger step-up MFA verification if not already verified within the configured session window (`SESSION_24H` or `EVERY_TIME`).

---

## 3. Technical Specifications & Architecture

### 3.1 Contracts (`packages/contracts/src/iam/`)
1. **Permission Definitions**: Export `PlatformPermission` type and enums.
2. **Role DTOs**:
   - `RoleDto`, `CreateRoleRequestDto`, `UpdateRolePermissionsRequestDto`
   - `TenantUserPermissionsDto`

### 3.2 Database Schema (`007_iam_dynamic_rbac.sql`)
1. `iam.permissions`:
   - `code` VARCHAR(64) PRIMARY KEY (e.g., `property:update`)
   - `domain` VARCHAR(32) NOT NULL
   - `description` TEXT NOT NULL
2. `iam.tenant_roles`:
   - `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - `tenant_id` UUID NOT NULL REFERENCES iam.organizations(id) ON DELETE CASCADE
   - `name` VARCHAR(64) NOT NULL
   - `is_system` BOOLEAN DEFAULT false
   - `created_at` TIMESTAMPTZ DEFAULT now(), `updated_at` TIMESTAMPTZ DEFAULT now()
   - UNIQUE(`tenant_id`, `name`)
3. `iam.tenant_role_permissions`:
   - `role_id` UUID REFERENCES iam.tenant_roles(id) ON DELETE CASCADE
   - `permission_code` VARCHAR(64) REFERENCES iam.permissions(code) ON DELETE CASCADE
   - PRIMARY KEY(`role_id`, `permission_code`)
4. Link `iam.organization_memberships` to `tenant_role_id` (optional foreign key replacing or supplementing static `role` string).

### 3.3 Application Layer Use Cases & Queries
- `AssignRoleToMemberUseCase`: Assigns a tenant role to an organization member.
- `EvaluatePermissionQuery`: Resolves all effective permissions for a user within a tenant context.
- `CreateTenantRoleUseCase`: Allows organization admins to create custom roles.
- `UpdateRolePermissionsUseCase`: Allows organization admins to toggle permissions on custom roles.

### 3.4 Presentation Middleware (`apps/api/src/modules/iam/presentation/middleware/`)
- `requirePermission(...permissions: string[])`:
  - Extracts active tenant context from `req.tenantContext`.
  - Checks if user's effective permissions within that tenant satisfy the required set.
  - Returns `403 Forbidden` with standardized RFC 7807 problem details if check fails.

---

## 4. Acceptance Criteria & Verifiable Gate

1. **Permission Resolution**: Querying effective permissions for an organization member returns the exact union of permissions from their assigned tenant role(s).
2. **Owner Invariant**: Primary organization owners automatically resolve to all permissions within their tenant without requiring manual role grants.
3. **Tenant Boundary Enforcement**: Role definitions and permission grants in Organization A have zero effect on permissions in Organization B.
4. **Deny-by-Default Guard**: Endpoints protected with `requirePermission('property:update')` return `403 Forbidden` when called by a member lacking that permission.
5. **Suspended Member Blocking**: Even if a role has the required permission, a member whose membership status is `SUSPENDED` is blocked with `403 Forbidden`.
6. **MFA Route Interception**: Endpoints flagged in `iam.mfa_protected_routes` challenge the user with `403 MFA_REQUIRED` unless a valid MFA verification token/header is present.
7. **Automated Test Suite**: A dedicated test suite (`apps/api/src/tests/unit/dynamic-rbac.test.ts`) covering all permission resolution paths, guard middlewares, and multi-tenant isolation with 100% pass rate.
8. **Static AST Architecture Guard**: `pnpm test:arch` continues to pass with 0 boundary violations.

---

## 5. Verification Evidence & Quality Gate Results

- **Automated Dynamic RBAC Test Suite (`dynamic-rbac.test.ts`)**: 18/18 tests passed (100%).
  - Granular domain permission resolution verified.
  - Primary owner full permission invariant verified.
  - Organization-scoped custom roles created, updated, deleted, and mapped.
  - Multi-tenant boundary isolation verified (Org A roles/permissions strictly quarantined from Org B).
  - Owner demotion protection verified.
  - Presentation guard middleware `requirePermission` / `requirePermissions` deny-by-default verified.
  - Suspended member access blocking verified.
  - Integration with dynamic MFA route protection verified.
- **Multi-Tenant Regression Suite (`multi-tenant-organizations.test.ts`)**: 18/18 tests passed (100%).
- **Architecture Boundary AST Analysis (`pnpm test:arch`)**: 3/3 passed (0 violations).
- **TypeScript Strict Compilation (`pnpm typecheck`)**: 0 errors across all 5 workspace projects.
- **Production Bundling (`pnpm build`)**: Clean builds across `@monolith/contracts`, `@monolith/api`, and `@monolith/web`.
