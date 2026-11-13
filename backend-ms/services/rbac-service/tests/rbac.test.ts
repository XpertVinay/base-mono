import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

import { Role } from '../src/domain/entities/role.entity.js';
import { Permission } from '../src/domain/entities/permission.entity.js';
import { UserRoleAssignment } from '../src/domain/entities/user-role-assignment.entity.js';

import { IRoleRepository, ListRolesOptions } from '../src/domain/repositories/role-repository.interface.js';
import { IPermissionRepository } from '../src/domain/repositories/permission-repository.interface.js';
import { IUserRoleRepository } from '../src/domain/repositories/user-role-repository.interface.js';

import {
  CreateRoleUseCase,
  GetRoleByIdQuery,
  ListRolesQuery,
  UpdateRoleUseCase,
  DeleteRoleUseCase
} from '../src/application/use-cases/role.use-cases.js';
import {
  ListPermissionsQuery,
  ListPermissionCategoriesQuery,
  GetPermissionByIdQuery,
  CreatePermissionUseCase,
  UpdatePermissionUseCase,
  DeletePermissionUseCase
} from '../src/application/use-cases/permission.use-cases.js';
import {
  AssignRoleToUserUseCase,
  RevokeRoleFromUserUseCase,
  GetUserRolesQuery,
  ListRoleUsersQuery,
  CheckUserPermissionQuery
} from '../src/application/use-cases/assignment.use-cases.js';
import { AppError, NotFoundError } from '../src/shared/presentation/error-handler.middleware.js';

// ==========================================================
// In-Memory Mock Repositories
// ==========================================================
class MockRoleRepository implements IRoleRepository {
  public roles = new Map<string, Role>();

  private key(tenantId: string, id: string): string {
    return `${tenantId}:${id}`;
  }

  async create(role: Role): Promise<Role> {
    this.roles.set(this.key(role.tenantId, role.id), role);
    return role;
  }

  async findById(tenantId: string, id: string): Promise<Role | null> {
    const role = this.roles.get(this.key(tenantId, id));
    if (role) return role;
    if (tenantId !== 'default') {
      return this.roles.get(this.key('default', id)) || null;
    }
    return null;
  }

  async findByName(tenantId: string, name: string): Promise<Role | null> {
    for (const r of this.roles.values()) {
      if ((r.tenantId === tenantId || r.tenantId === 'default') && r.name === name.toUpperCase()) {
        return r;
      }
    }
    return null;
  }

  async list(tenantId: string, options?: ListRolesOptions): Promise<{ items: Role[]; total: number }> {
    let list = Array.from(this.roles.values()).filter(
      r => r.tenantId === tenantId || r.tenantId === 'default'
    );

    if (options?.search) {
      const q = options.search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q)));
    }

    if (options?.isSystem !== undefined) {
      list = list.filter(r => r.isSystem === options.isSystem);
    }

    const total = list.length;
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const start = (page - 1) * limit;
    const items = list.slice(start, start + limit);

    return { items, total };
  }

  async update(role: Role): Promise<Role> {
    this.roles.set(this.key(role.tenantId, role.id), role);
    return role;
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    return this.roles.delete(this.key(tenantId, id));
  }

  async existsByName(tenantId: string, name: string, excludeId?: string): Promise<boolean> {
    for (const r of this.roles.values()) {
      if ((r.tenantId === tenantId || r.tenantId === 'default') && r.name === name.toUpperCase()) {
        if (!excludeId || r.id !== excludeId) {
          return true;
        }
      }
    }
    return false;
  }
}

class MockPermissionRepository implements IPermissionRepository {
  public permissions = new Map<string, Permission>();

  async create(permission: Permission): Promise<Permission> {
    this.permissions.set(permission.id, permission);
    return permission;
  }

  async findById(id: string): Promise<Permission | null> {
    return this.permissions.get(id) || null;
  }

  async findByName(name: string): Promise<Permission | null> {
    for (const p of this.permissions.values()) {
      if (p.name.toLowerCase() === name.toLowerCase()) {
        return p;
      }
    }
    return null;
  }

  async list(category?: string): Promise<Permission[]> {
    let list = Array.from(this.permissions.values());
    if (category) {
      list = list.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    return list;
  }

  async listCategories(): Promise<string[]> {
    const cats = new Set<string>();
    for (const p of this.permissions.values()) {
      cats.add(p.category);
    }
    return Array.from(cats).sort();
  }

  async listByNames(names: string[]): Promise<Permission[]> {
    const set = new Set(names.map(n => n.toLowerCase()));
    return Array.from(this.permissions.values()).filter(p => set.has(p.name.toLowerCase()));
  }

  async update(permission: Permission): Promise<Permission> {
    this.permissions.set(permission.id, permission);
    return permission;
  }

  async delete(id: string): Promise<boolean> {
    return this.permissions.delete(id);
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    for (const p of this.permissions.values()) {
      if (p.name.toLowerCase() === name.toLowerCase()) {
        if (!excludeId || p.id !== excludeId) {
          return true;
        }
      }
    }
    return false;
  }
}

class MockUserRoleRepository implements IUserRoleRepository {
  public assignments = new Map<string, UserRoleAssignment>();
  public roleRepo!: MockRoleRepository;

  private key(tenantId: string, userId: string, roleId: string): string {
    return `${tenantId}:${userId}:${roleId}`;
  }

  async assignRole(assignment: UserRoleAssignment): Promise<UserRoleAssignment> {
    this.assignments.set(this.key(assignment.tenantId, assignment.userId, assignment.roleId), assignment);
    return assignment;
  }

  async revokeRole(tenantId: string, userId: string, roleId: string): Promise<boolean> {
    return this.assignments.delete(this.key(tenantId, userId, roleId));
  }

  async getUserRoles(tenantId: string, userId: string): Promise<UserRoleAssignment[]> {
    return Array.from(this.assignments.values()).filter(
      a => (a.tenantId === tenantId || a.tenantId === 'default') && a.userId === userId
    );
  }

  async getUsersByRole(tenantId: string, roleId: string): Promise<UserRoleAssignment[]> {
    return Array.from(this.assignments.values()).filter(
      a => (a.tenantId === tenantId || a.tenantId === 'default') && a.roleId === roleId
    );
  }

  async hasRole(tenantId: string, userId: string, roleIdOrName: string): Promise<boolean> {
    for (const a of this.assignments.values()) {
      if ((a.tenantId === tenantId || a.tenantId === 'default') && a.userId === userId) {
        if (a.roleId === roleIdOrName || (a.roleName && a.roleName.toUpperCase() === roleIdOrName.toUpperCase())) {
          return true;
        }
      }
    }
    return false;
  }

  async getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(tenantId, userId);
    const permissions = new Set<string>();

    for (const a of roles) {
      const role = await this.roleRepo.findById(tenantId, a.roleId);
      if (role) {
        role.permissions.forEach(p => permissions.add(p));
      }
    }

    return Array.from(permissions);
  }

  async countAssignmentsByRoleId(tenantId: string, roleId: string): Promise<number> {
    let count = 0;
    for (const a of this.assignments.values()) {
      if ((a.tenantId === tenantId || a.tenantId === 'default') && a.roleId === roleId) {
        count++;
      }
    }
    return count;
  }

  async assignmentExists(tenantId: string, userId: string, roleId: string): Promise<boolean> {
    return this.assignments.has(this.key(tenantId, userId, roleId));
  }
}

// ==========================================================
// Tests
// ==========================================================
describe('RBAC Service Unit & Domain Tests', () => {
  let roleRepo: MockRoleRepository;
  let permRepo: MockPermissionRepository;
  let userRoleRepo: MockUserRoleRepository;

  beforeEach(() => {
    roleRepo = new MockRoleRepository();
    permRepo = new MockPermissionRepository();
    userRoleRepo = new MockUserRoleRepository();
    userRoleRepo.roleRepo = roleRepo;

    // Seed standard test permissions
    permRepo.create(new Permission({
      id: 'p1',
      name: 'property:read',
      category: 'property',
      description: 'Read properties',
      isSystem: true
    }));
    permRepo.create(new Permission({
      id: 'p2',
      name: 'property:create',
      category: 'property',
      description: 'Create properties',
      isSystem: true
    }));
    permRepo.create(new Permission({
      id: 'p3',
      name: 'finance:ledger:read',
      category: 'finance',
      description: 'Read ledger',
      isSystem: true
    }));
    permRepo.create(new Permission({
      id: 'p4',
      name: 'rbac:roles:create',
      category: 'rbac',
      description: 'Create roles',
      isSystem: true
    }));

    // Seed standard test system role
    roleRepo.create(new Role({
      id: 'r_admin',
      tenantId: 'default',
      name: 'ADMIN',
      description: 'Administrator',
      isSystem: true,
      permissions: ['property:read', 'property:create', 'finance:ledger:read', 'rbac:roles:create']
    }));
  });

  describe('Role Entity', () => {
    test('creates role with uppercase name and trims inputs', () => {
      const role = new Role({
        id: 'r_custom',
        tenantId: 'tenant-123',
        name: '  editor  ',
        description: '  Editor description  ',
        permissions: ['property:read', 'property:create']
      });

      assert.strictEqual(role.name, 'EDITOR');
      assert.strictEqual(role.tenantId, 'tenant-123');
      assert.strictEqual(role.description, 'Editor description');
      assert.strictEqual(role.isSystem, false);
      assert.strictEqual(role.hasPermission('property:read'), true);
      assert.strictEqual(role.hasPermission('finance:ledger:read'), false);
    });

    test('supports wildcard permissions matching', () => {
      const adminRole = new Role({
        id: 'r_wild',
        tenantId: 'default',
        name: 'SUPER_USER',
        permissions: ['*']
      });
      assert.strictEqual(adminRole.hasPermission('anything:read'), true);

      const propRole = new Role({
        id: 'r_prop',
        tenantId: 'default',
        name: 'PROP_MANAGER',
        permissions: ['property:*']
      });
      assert.strictEqual(propRole.hasPermission('property:read'), true);
      assert.strictEqual(propRole.hasPermission('property:update'), true);
      assert.strictEqual(propRole.hasPermission('finance:read'), false);
    });

    test('prevents renaming of system roles', () => {
      const systemRole = new Role({
        id: 'r_sys',
        tenantId: 'default',
        name: 'SYSTEM_ADMIN',
        isSystem: true
      });

      assert.throws(() => {
        systemRole.updateDetails({ name: 'NEW_NAME' });
      }, /System roles cannot be renamed/);
    });
  });

  describe('Role CRUD Use Cases', () => {
    test('CreateRoleUseCase creates a new role with valid permissions', async () => {
      const useCase = new CreateRoleUseCase(roleRepo, permRepo);
      const role = await useCase.execute({
        tenantId: 'tenant-1',
        name: 'CONTENT_CREATOR',
        description: 'Creates content',
        permissions: ['property:create']
      });

      assert.strictEqual(role.name, 'CONTENT_CREATOR');
      assert.strictEqual(role.tenantId, 'tenant-1');
      assert.deepStrictEqual(role.permissions, ['property:create']);
    });

    test('CreateRoleUseCase rejects duplicate role name in tenant', async () => {
      const useCase = new CreateRoleUseCase(roleRepo, permRepo);
      await useCase.execute({
        tenantId: 'tenant-1',
        name: 'SUPPORT_AGENT'
      });

      await assert.rejects(async () => {
        await useCase.execute({
          tenantId: 'tenant-1',
          name: 'support_agent'
        });
      }, (err: any) => err instanceof AppError && err.code === 'ROLE_ALREADY_EXISTS');
    });

    test('CreateRoleUseCase rejects invalid permission string', async () => {
      const useCase = new CreateRoleUseCase(roleRepo, permRepo);
      await assert.rejects(async () => {
        await useCase.execute({
          tenantId: 'tenant-1',
          name: 'INVALID_ROLE',
          permissions: ['non_existent:permission']
        });
      }, (err: any) => err instanceof AppError && err.code === 'INVALID_PERMISSION');
    });

    test('GetRoleByIdQuery retrieves role or throws NotFoundError', async () => {
      const query = new GetRoleByIdQuery(roleRepo);
      const role = await query.execute('default', 'r_admin');
      assert.strictEqual(role.name, 'ADMIN');

      await assert.rejects(async () => {
        await query.execute('default', 'non_existent_role');
      }, NotFoundError);
    });

    test('ListRolesQuery supports search and pagination', async () => {
      const create = new CreateRoleUseCase(roleRepo, permRepo);
      await create.execute({ tenantId: 't1', name: 'BILLING_CLERK' });
      await create.execute({ tenantId: 't1', name: 'AUDITOR' });

      const query = new ListRolesQuery(roleRepo);
      const result = await query.execute('t1', { search: 'BILL' });

      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].name, 'BILLING_CLERK');
    });

    test('UpdateRoleUseCase updates role details and permissions', async () => {
      const create = new CreateRoleUseCase(roleRepo, permRepo);
      const role = await create.execute({
        tenantId: 't1',
        name: 'MODERATOR',
        permissions: ['property:read']
      });

      const update = new UpdateRoleUseCase(roleRepo, permRepo);
      const updated = await update.execute({
        tenantId: 't1',
        id: role.id,
        name: 'SENIOR_MODERATOR',
        description: 'Updated description',
        permissions: ['property:read', 'property:create']
      });

      assert.strictEqual(updated.name, 'SENIOR_MODERATOR');
      assert.strictEqual(updated.description, 'Updated description');
      assert.strictEqual(updated.hasPermission('property:create'), true);
    });

    test('DeleteRoleUseCase deletes custom role', async () => {
      const create = new CreateRoleUseCase(roleRepo, permRepo);
      const role = await create.execute({ tenantId: 't1', name: 'TEMPORARY_ROLE' });

      const deleteUseCase = new DeleteRoleUseCase(roleRepo, userRoleRepo);
      const deleted = await deleteUseCase.execute('t1', role.id);
      assert.strictEqual(deleted, true);

      const exists = await roleRepo.findById('t1', role.id);
      assert.strictEqual(exists, null);
    });

    test('DeleteRoleUseCase prevents deletion of system role', async () => {
      const deleteUseCase = new DeleteRoleUseCase(roleRepo, userRoleRepo);
      await assert.rejects(async () => {
        await deleteUseCase.execute('default', 'r_admin');
      }, (err: any) => err instanceof AppError && err.code === 'CANNOT_DELETE_SYSTEM_ROLE');
    });

    test('DeleteRoleUseCase prevents deletion of role actively assigned to users', async () => {
      const createRole = new CreateRoleUseCase(roleRepo, permRepo);
      const role = await createRole.execute({ tenantId: 't1', name: 'ASSIGNED_ROLE' });

      const assign = new AssignRoleToUserUseCase(userRoleRepo, roleRepo);
      await assign.execute({
        tenantId: 't1',
        userId: 'usr_001',
        roleId: role.id
      });

      const deleteUseCase = new DeleteRoleUseCase(roleRepo, userRoleRepo);
      await assert.rejects(async () => {
        await deleteUseCase.execute('t1', role.id);
      }, (err: any) => err instanceof AppError && err.code === 'ROLE_IN_USE');
    });
  });

  describe('Permission CRUD Use Cases', () => {
    test('CreatePermissionUseCase creates new permission', async () => {
      const useCase = new CreatePermissionUseCase(permRepo);
      const perm = await useCase.execute({
        name: 'custom:metric:export',
        category: 'analytics',
        description: 'Export metrics'
      });

      assert.strictEqual(perm.name, 'custom:metric:export');
      assert.strictEqual(perm.category, 'analytics');
      assert.strictEqual(perm.isSystem, false);
    });

    test('ListPermissionsQuery lists permissions with category filter', async () => {
      const query = new ListPermissionsQuery(permRepo);
      const propPerms = await query.execute('property');
      assert.strictEqual(propPerms.length, 2);
      propPerms.forEach(p => assert.strictEqual(p.category, 'property'));
    });

    test('DeletePermissionUseCase prevents deletion of system permissions', async () => {
      const deleteUseCase = new DeletePermissionUseCase(permRepo);
      await assert.rejects(async () => {
        await deleteUseCase.execute('p1');
      }, (err: any) => err instanceof AppError && err.code === 'CANNOT_DELETE_SYSTEM_PERMISSION');
    });
  });

  describe('User Role Assignment & Permission Evaluation', () => {
    test('Assigns role to user and evaluates granted permissions', async () => {
      const assign = new AssignRoleToUserUseCase(userRoleRepo, roleRepo);
      await assign.execute({
        tenantId: 'default',
        userId: 'user_42',
        roleId: 'r_admin'
      });

      const checkPerm = new CheckUserPermissionQuery(userRoleRepo);
      const resultGranted = await checkPerm.execute('default', 'user_42', 'property:read');
      assert.strictEqual(resultGranted.allowed, true);
      assert.ok(resultGranted.userRoles.includes('ADMIN'));

      const resultDenied = await checkPerm.execute('default', 'user_42', 'nonexistent:access');
      assert.strictEqual(resultDenied.allowed, false);
    });

    test('Revoke role removes user permissions', async () => {
      const assign = new AssignRoleToUserUseCase(userRoleRepo, roleRepo);
      await assign.execute({
        tenantId: 'default',
        userId: 'user_99',
        roleId: 'r_admin'
      });

      const revoke = new RevokeRoleFromUserUseCase(userRoleRepo);
      await revoke.execute('default', 'user_99', 'r_admin');

      const checkPerm = new CheckUserPermissionQuery(userRoleRepo);
      const result = await checkPerm.execute('default', 'user_99', 'property:read');
      assert.strictEqual(result.allowed, false);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    test('Roles created in Tenant A are not accessible by Tenant B', async () => {
      const createRole = new CreateRoleUseCase(roleRepo, permRepo);
      const roleA = await createRole.execute({
        tenantId: 'tenant-alpha',
        name: 'INTERNAL_OPERATOR',
        permissions: ['property:read']
      });

      const getRole = new GetRoleByIdQuery(roleRepo);
      const retrieved = await getRole.execute('tenant-alpha', roleA.id);
      assert.strictEqual(retrieved.id, roleA.id);

      // Attempt access from tenant-beta must throw NotFoundError
      await assert.rejects(async () => {
        await getRole.execute('tenant-beta', roleA.id);
      }, NotFoundError);
    });
  });
});
