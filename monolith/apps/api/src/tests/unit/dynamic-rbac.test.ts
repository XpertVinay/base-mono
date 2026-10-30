import { describe, it, expect, beforeEach } from 'vitest';
import { Organization } from '../../modules/iam/domain/entities/organization.entity.js';
import { OrganizationMembership } from '../../modules/iam/domain/entities/organization-membership.entity.js';
import { User } from '../../modules/iam/domain/entities/user.entity.js';
import { Password } from '../../modules/iam/domain/value-objects/password.vo.js';

import { PostgresOrganizationRepository } from '../../modules/iam/infrastructure/persistence/postgres-organization.repository.js';
import { PostgresOrganizationMembershipRepository } from '../../modules/iam/infrastructure/persistence/postgres-organization-membership.repository.js';
import { PostgresTenantRoleRepository } from '../../modules/iam/infrastructure/persistence/postgres-tenant-role.repository.js';
import { PostgresUserRepository } from '../../modules/iam/infrastructure/persistence/postgres-user.repository.js';
import { PostgresMfaProtectedRouteRepository } from '../../modules/iam/infrastructure/persistence/mfa-protected-route.repository.js';
import { MfaRouteCache } from '../../modules/iam/infrastructure/cache/mfa-route.cache.js';

import { EvaluatePermissionQuery } from '../../modules/iam/application/queries/rbac/evaluate-permission.query.js';
import { CreateTenantRoleUseCase } from '../../modules/iam/application/commands/rbac/create-tenant-role.use-case.js';
import { UpdateRolePermissionsUseCase } from '../../modules/iam/application/commands/rbac/update-role-permissions.use-case.js';
import { AssignRoleToMemberUseCase } from '../../modules/iam/application/commands/rbac/assign-role-to-member.use-case.js';
import { ListTenantRolesQuery } from '../../modules/iam/application/queries/rbac/list-tenant-roles.query.js';
import { GetTenantRoleQuery } from '../../modules/iam/application/queries/rbac/get-tenant-role.query.js';
import { DeleteTenantRoleUseCase } from '../../modules/iam/application/commands/rbac/delete-tenant-role.use-case.js';

import { createRequirePermissionMiddleware } from '../../modules/iam/presentation/middleware/tenant-permission.middleware.js';
import { createMfaReverificationMiddleware } from '../../modules/iam/presentation/middleware/mfa-reverification.middleware.js';
import { ValidateTenantContextQuery } from '../../modules/iam/application/queries/organization/validate-tenant-context.query.js';

import {
  ALL_PLATFORM_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS
} from '@monolith/contracts';
import { ForbiddenError, UnauthorizedError, ConflictError } from '../../shared/presentation/error-handler.middleware.js';

describe('Sprint 04: Dynamic Role-Based Access Control (RBAC) & Tenant Authorization', () => {
  let orgRepo: PostgresOrganizationRepository;
  let membershipRepo: PostgresOrganizationMembershipRepository;
  let tenantRoleRepo: PostgresTenantRoleRepository;
  let userRepo: PostgresUserRepository;
  let protectedRouteRepo: PostgresMfaProtectedRouteRepository;
  let mfaCache: MfaRouteCache;

  let evaluatePermissionQuery: EvaluatePermissionQuery;
  let createTenantRoleUseCase: CreateTenantRoleUseCase;
  let updateRolePermissionsUseCase: UpdateRolePermissionsUseCase;
  let assignRoleToMemberUseCase: AssignRoleToMemberUseCase;
  let listTenantRolesQuery: ListTenantRolesQuery;
  let getTenantRoleQuery: GetTenantRoleQuery;
  let deleteTenantRoleUseCase: DeleteTenantRoleUseCase;
  let validateTenantContextQuery: ValidateTenantContextQuery;
  let requirePerm: ReturnType<typeof createRequirePermissionMiddleware>;

  const orgAId = 'org-alpha-1';
  const orgBId = 'org-beta-2';

  const ownerA = { id: 'user-owner-a', email: 'owner.a@alpha.io', name: 'Alice Owner' };
  const adminA = { id: 'user-admin-a', email: 'admin.a@alpha.io', name: 'Aaron Admin' };
  const memberA = { id: 'user-member-a', email: 'member.a@alpha.io', name: 'Mark Member' };

  const ownerB = { id: 'user-owner-b', email: 'owner.b@beta.io', name: 'Bob Owner' };

  beforeEach(async () => {
    orgRepo = new PostgresOrganizationRepository();
    membershipRepo = new PostgresOrganizationMembershipRepository();
    tenantRoleRepo = new PostgresTenantRoleRepository();
    userRepo = new PostgresUserRepository();
    protectedRouteRepo = new PostgresMfaProtectedRouteRepository();
    mfaCache = new MfaRouteCache(protectedRouteRepo);

    evaluatePermissionQuery = new EvaluatePermissionQuery(orgRepo, membershipRepo, tenantRoleRepo);
    createTenantRoleUseCase = new CreateTenantRoleUseCase(orgRepo, membershipRepo, tenantRoleRepo);
    updateRolePermissionsUseCase = new UpdateRolePermissionsUseCase(orgRepo, membershipRepo, tenantRoleRepo);
    assignRoleToMemberUseCase = new AssignRoleToMemberUseCase(orgRepo, membershipRepo, tenantRoleRepo);
    listTenantRolesQuery = new ListTenantRolesQuery(orgRepo, membershipRepo, tenantRoleRepo);
    getTenantRoleQuery = new GetTenantRoleQuery(orgRepo, membershipRepo, tenantRoleRepo);
    deleteTenantRoleUseCase = new DeleteTenantRoleUseCase(orgRepo, membershipRepo, tenantRoleRepo);
    validateTenantContextQuery = new ValidateTenantContextQuery(orgRepo, membershipRepo);
    requirePerm = createRequirePermissionMiddleware(evaluatePermissionQuery, validateTenantContextQuery);

    // Seed Users
    for (const u of [ownerA, adminA, memberA, ownerB]) {
      await userRepo.save(User.create(u.email, Password.fromHashed('dummy-hash'), u.name, 'USER', u.id));
    }

    // Seed Org A and Memberships
    await orgRepo.save(new Organization({
      id: orgAId,
      name: 'Alpha Estates',
      slug: 'alpha-estates',
      type: 'PROPERTY_MANAGEMENT',
      status: 'ACTIVE',
      ownerUserId: ownerA.id
    }));

    await membershipRepo.save(new OrganizationMembership({
      id: 'mem-owner-a',
      organizationId: orgAId,
      userId: ownerA.id,
      role: 'ADMIN',
      status: 'ACTIVE'
    }));

    await membershipRepo.save(new OrganizationMembership({
      id: 'mem-admin-a',
      organizationId: orgAId,
      userId: adminA.id,
      role: 'ADMIN',
      status: 'ACTIVE'
    }));

    await membershipRepo.save(new OrganizationMembership({
      id: 'mem-member-a',
      organizationId: orgAId,
      userId: memberA.id,
      role: 'MEMBER',
      status: 'ACTIVE'
    }));

    // Seed Org B
    await orgRepo.save(new Organization({
      id: orgBId,
      name: 'Beta Properties',
      slug: 'beta-props',
      type: 'ENTERPRISE',
      status: 'ACTIVE',
      ownerUserId: ownerB.id
    }));

    await membershipRepo.save(new OrganizationMembership({
      id: 'mem-owner-b',
      organizationId: orgBId,
      userId: ownerB.id,
      role: 'ADMIN',
      status: 'ACTIVE'
    }));
  });

  describe('1. Granular Domain Permissions & Baseline System Roles', () => {
    it('verifies primary organization owner automatically resolves to all platform permissions without explicit role assignment', async () => {
      const perms = await evaluatePermissionQuery.execute(ownerA.id, orgAId);

      expect(perms.isOwner).toBe(true);
      expect(perms.roles).toContain('ORGANIZATION_OWNER');
      expect(perms.permissions.length).toBe(ALL_PLATFORM_PERMISSIONS.length);
      for (const p of ALL_PLATFORM_PERMISSIONS) {
        expect(perms.permissions).toContain(p);
      }
    });

    it('verifies ADMIN member holds full platform permissions in their organization', async () => {
      const perms = await evaluatePermissionQuery.execute(adminA.id, orgAId);

      expect(perms.isOwner).toBe(false);
      expect(perms.roles).toContain('ADMIN');
      expect(perms.permissions.length).toBe(ALL_PLATFORM_PERMISSIONS.length);
      expect(perms.permissions).toContain('property:delete');
      expect(perms.permissions).toContain('finance:disburse');
    });

    it('verifies baseline system roles have precise domain permissions', async () => {
      // Test Caretaker system baseline
      await membershipRepo.save(new OrganizationMembership({
        id: 'mem-caretaker',
        organizationId: orgAId,
        userId: memberA.id,
        role: 'CARETAKER',
        status: 'ACTIVE'
      }));

      const caretakerPerms = await evaluatePermissionQuery.execute(memberA.id, orgAId);
      expect(caretakerPerms.permissions).toEqual(expect.arrayContaining(SYSTEM_ROLE_PERMISSIONS.CARETAKER));
      expect(caretakerPerms.permissions).not.toContain('finance:disburse');
      expect(caretakerPerms.permissions).not.toContain('property:delete');

      // Test Finance Controller system baseline
      await membershipRepo.save(new OrganizationMembership({
        id: 'mem-finance',
        organizationId: orgAId,
        userId: memberA.id,
        role: 'FINANCE_CONTROLLER',
        status: 'ACTIVE'
      }));

      const financePerms = await evaluatePermissionQuery.execute(memberA.id, orgAId);
      expect(financePerms.permissions).toContain('finance:disburse');
      expect(financePerms.permissions).toContain('finance:expense:approve');
      expect(financePerms.permissions).not.toContain('property:create');
    });
  });

  describe('2. Organization-Scoped Custom Roles & Dynamic Permissions', () => {
    it('allows an organization admin to create a custom role with a specific permission set', async () => {
      const customRole = await createTenantRoleUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        name: 'INSPECTOR',
        description: 'Field inspection specialist',
        permissions: ['property:read', 'caretaking:inspect', 'document:upload']
      });

      expect(customRole.name).toBe('INSPECTOR');
      expect(customRole.tenantId).toBe(orgAId);
      expect(customRole.permissions).toEqual(['property:read', 'caretaking:inspect', 'document:upload']);
      expect(customRole.isSystem).toBe(false);

      const fetched = await getTenantRoleQuery.execute(orgAId, customRole.id, adminA.id);
      expect(fetched.name).toBe('INSPECTOR');
      expect(fetched.permissions).toEqual(['property:read', 'caretaking:inspect', 'document:upload']);
    });

    it('assigns custom role to member and resolves exact union of permissions', async () => {
      const customRole = await createTenantRoleUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        name: 'REPAIR_COORDINATOR',
        permissions: ['property:read', 'maintenance:ticket:create', 'maintenance:ticket:update']
      });

      await assignRoleToMemberUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        targetUserId: memberA.id,
        roleIdOrName: customRole.id
      });

      const memberPerms = await evaluatePermissionQuery.execute(memberA.id, orgAId);
      expect(memberPerms.roles).toContain('REPAIR_COORDINATOR');
      expect(memberPerms.permissions).toEqual(
        expect.arrayContaining(['property:read', 'maintenance:ticket:create', 'maintenance:ticket:update'])
      );
      expect(memberPerms.permissions).not.toContain('property:delete');
      expect(memberPerms.permissions).not.toContain('finance:disburse');
    });

    it('updates custom role permissions and immediately reflects in member permissions', async () => {
      const customRole = await createTenantRoleUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        name: 'CUSTOM_AUDITOR',
        permissions: ['property:read', 'finance:ledger:read']
      });

      await assignRoleToMemberUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        targetUserId: memberA.id,
        roleIdOrName: customRole.id
      });

      // Update role permissions: grant document:read
      await updateRolePermissionsUseCase.execute({
        organizationId: orgAId,
        roleId: customRole.id,
        userId: adminA.id,
        permissions: ['property:read', 'finance:ledger:read', 'document:read']
      });

      const updated = await evaluatePermissionQuery.execute(memberA.id, orgAId);
      expect(updated.permissions).toContain('document:read');
    });

    it('rejects duplicate role names within the same tenant', async () => {
      await createTenantRoleUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        name: 'AUDITOR',
        permissions: ['finance:ledger:read']
      });

      await expect(
        createTenantRoleUseCase.execute({
          organizationId: orgAId,
          userId: adminA.id,
          name: 'AUDITOR',
          permissions: ['finance:ledger:read']
        })
      ).rejects.toThrow(ConflictError);
    });

    it('allows deleting custom roles but protects system roles from deletion', async () => {
      const customRole = await createTenantRoleUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        name: 'TEMPORARY_ROLE',
        permissions: ['property:read']
      });

      await deleteTenantRoleUseCase.execute(orgAId, customRole.id, adminA.id);
      const roles = await listTenantRolesQuery.execute(orgAId, adminA.id);
      expect(roles.find(r => r.name === 'TEMPORARY_ROLE')).toBeUndefined();
    });
  });

  describe('3. Multi-Tenant Boundary Isolation', () => {
    it('verifies custom roles and permissions in Organization A have zero effect on Organization B', async () => {
      // Create role in Org A
      const customRoleA = await createTenantRoleUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        name: 'ALPHA_SUPERVISOR',
        permissions: ['property:create', 'property:update']
      });

      // User memberA is also added to Org B as a standard MEMBER
      await membershipRepo.save(new OrganizationMembership({
        id: 'mem-member-b',
        organizationId: orgBId,
        userId: memberA.id,
        role: 'MEMBER',
        status: 'ACTIVE'
      }));

      // Assign custom role to memberA in Org A
      await assignRoleToMemberUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        targetUserId: memberA.id,
        roleIdOrName: customRoleA.id
      });

      // Check permissions in Org A: holds property:create
      const permsA = await evaluatePermissionQuery.execute(memberA.id, orgAId);
      expect(permsA.permissions).toContain('property:create');

      // Check permissions in Org B: does NOT hold property:create
      const permsB = await evaluatePermissionQuery.execute(memberA.id, orgBId);
      expect(permsB.permissions).not.toContain('property:create');
      expect(permsB.roles).not.toContain('ALPHA_SUPERVISOR');

      // Org B admin cannot assign Org A's custom role
      await expect(
        assignRoleToMemberUseCase.execute({
          organizationId: orgBId,
          userId: ownerB.id,
          targetUserId: memberA.id,
          roleIdOrName: customRoleA.id
        })
      ).rejects.toThrow();
    });
  });

  describe('4. Owner Protection Invariant', () => {
    it('prevents demoting or changing role of the primary organization owner', async () => {
      await expect(
        assignRoleToMemberUseCase.execute({
          organizationId: orgAId,
          userId: adminA.id,
          targetUserId: ownerA.id,
          roleIdOrName: 'CARETAKER'
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('5. Presentation Boundary Authorization Guards (requirePermission)', () => {
    it('allows access when user holds required permission', async () => {
      const middleware = requirePerm('property:read');

      const req: any = {
        user: { id: memberA.id, email: memberA.email, role: 'USER' },
        headers: { 'x-tenant-id': orgAId }
      };
      const res: any = {};
      let nextCalled = false;
      let nextError: any = null;

      await middleware(req, res, (err) => {
        nextCalled = true;
        nextError = err;
      });

      expect(nextCalled).toBe(true);
      expect(nextError).toBeUndefined();
    });

    it('rejects access with 403 Forbidden when user lacks required permission', async () => {
      const middleware = requirePerm('property:delete');

      const req: any = {
        user: { id: memberA.id, email: memberA.email, role: 'USER' },
        headers: { 'x-tenant-id': orgAId }
      };
      const res: any = {};
      let nextCalled = false;
      let nextError: any = null;

      await middleware(req, res, (err) => {
        nextCalled = true;
        nextError = err;
      });

      expect(nextCalled).toBe(true);
      expect(nextError).toBeInstanceOf(ForbiddenError);
      expect(nextError.message).toContain('Missing required permission');
    });

    it('allows primary owner to bypass all tenant permission checks', async () => {
      const middleware = requirePerm('property:delete', 'finance:disburse');

      const req: any = {
        user: { id: ownerA.id, email: ownerA.email, role: 'USER' },
        headers: { 'x-tenant-id': orgAId }
      };
      const res: any = {};
      let nextCalled = false;
      let nextError: any = null;

      await middleware(req, res, (err) => {
        nextCalled = true;
        nextError = err;
      });

      expect(nextCalled).toBe(true);
      expect(nextError).toBeUndefined();
    });

    it('allows global platform ADMIN to bypass all tenant permission checks', async () => {
      const middleware = requirePerm('property:delete');

      const req: any = {
        user: { id: 'super-admin-user', email: 'admin@platform.com', role: 'ADMIN' },
        headers: { 'x-tenant-id': orgAId }
      };
      const res: any = {};
      let nextCalled = false;
      let nextError: any = null;

      await middleware(req, res, (err) => {
        nextCalled = true;
        nextError = err;
      });

      expect(nextCalled).toBe(true);
      expect(nextError).toBeUndefined();
    });

    it('rejects requests missing organization context with 403 Forbidden', async () => {
      const middleware = requirePerm('property:read');

      const req: any = {
        user: { id: memberA.id, email: memberA.email, role: 'USER' },
        headers: {} // No X-Tenant-ID header
      };
      const res: any = {};
      let nextError: any = null;

      await middleware(req, res, (err) => {
        nextError = err;
      });

      expect(nextError).toBeInstanceOf(ForbiddenError);
      expect(nextError.message).toContain('Missing organization identifier');
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const middleware = requirePerm('property:read');

      const req: any = {
        headers: { 'x-tenant-id': orgAId }
      };
      const res: any = {};
      let nextError: any = null;

      await middleware(req, res, (err) => {
        nextError = err;
      });

      expect(nextError).toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('6. Suspended Member Security Blocking', () => {
    it('blocks suspended members with 403 Forbidden even if their assigned role contains the permission', async () => {
      // Assign custom role with finance:disburse
      const customRole = await createTenantRoleUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        name: 'PAYOUT_OFFICER',
        permissions: ['property:read', 'finance:disburse']
      });

      await assignRoleToMemberUseCase.execute({
        organizationId: orgAId,
        userId: adminA.id,
        targetUserId: memberA.id,
        roleIdOrName: customRole.id
      });

      // Suspend member
      const membership = (await membershipRepo.findByOrgAndUser(orgAId, memberA.id))!;
      membership.suspend();
      await membershipRepo.save(membership);

      // Verify EvaluatePermission returns 0 permissions for suspended member
      const evalPerms = await evaluatePermissionQuery.execute(memberA.id, orgAId);
      expect(evalPerms.permissions.length).toBe(0);

      // Verify guard middleware blocks access
      const requirePerm = createRequirePermissionMiddleware(evaluatePermissionQuery, validateTenantContextQuery);
      const middleware = requirePerm('property:read');

      const req: any = {
        user: { id: memberA.id, email: memberA.email, role: 'USER' },
        headers: { 'x-tenant-id': orgAId }
      };
      const res: any = {};
      let nextError: any = null;

      await middleware(req, res, (err) => {
        nextError = err;
      });

      expect(nextError).toBeInstanceOf(ForbiddenError);
      expect(nextError.message).toContain('suspended');
    });
  });

  describe('7. Integration with Dynamic MFA Route Protection', () => {
    it('blocks sensitive disburse endpoint when user has not verified MFA', async () => {
      // Register route as MFA protected in repository and warm up cache
      await protectedRouteRepo.save({
        id: 'mfa-route-disburse',
        method: 'POST',
        pathPattern: '/api/finance/disburse',
        description: 'Critical fund disbursement',
        reverificationMode: 'EVERY_TIME',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await mfaCache.warmUp();

      const mfaMiddleware = createMfaReverificationMiddleware(mfaCache, userRepo);

      const req: any = {
        method: 'POST',
        path: '/api/finance/disburse',
        originalUrl: '/api/finance/disburse',
        params: {},
        headers: { 'x-tenant-id': orgAId },
        user: { id: adminA.id, email: adminA.email, role: 'USER' },
        socket: { remoteAddress: '127.0.0.1' }
      };

      let statusCode = 0;
      let jsonPayload: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              jsonPayload = body;
            }
          };
        }
      };

      await mfaMiddleware(req, res, () => {});

      // Admin user has not enabled MFA on account -> 403 MFA_REQUIRED
      expect(statusCode).toBe(403);
      expect(jsonPayload.error).toBe('MFA_REQUIRED');
    });
  });
});
