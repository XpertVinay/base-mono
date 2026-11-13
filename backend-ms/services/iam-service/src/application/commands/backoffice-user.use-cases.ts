import crypto from 'crypto';
import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IUserRepository, UserFilterParams } from '../../domain/repositories/user-repository.interface.js';
import { ITenantRepository } from '../../domain/repositories/tenant-repository.interface.js';
import { IFederatedIdentityRepository } from '../../domain/repositories/federated-identity-repository.interface.js';
import { ISsoSessionRepository } from '../../domain/repositories/sso-session-repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import { PasswordVO } from '../../domain/value-objects/password.vo.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import {
  UserDto,
  BackOfficeUserDetailDto,
  CreateBackOfficeUserDto,
  UpdateBackOfficeUserDto,
  UpdateUserStatusDto,
  ResetUserPasswordDto,
  PasswordResetResultDto,
  RoleDefinitionDto,
  SsoSessionDto,
  FederatedIdentityDto
} from '../../shared/contracts/index.js';
import { TenantResolverService } from '../services/tenant-resolver.service.js';

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
    authMethod: user.authMethod,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

// ----------------------------------------------------------------------------
// 1. List Users Query
// ----------------------------------------------------------------------------
export interface ListBackOfficeUsersInput extends UserFilterParams {
  tenantSlug?: string;
}

export interface PaginatedUsersResponse {
  items: UserDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class ListBackOfficeUsersQuery implements UseCase<ListBackOfficeUsersInput, PaginatedUsersResponse> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantResolver: TenantResolverService
  ) {}

  async execute(input: ListBackOfficeUsersInput): Promise<Result<PaginatedUsersResponse>> {
    let resolvedTenantId = input.tenantId;
    if (input.tenantSlug && !resolvedTenantId) {
      const resolved = await this.tenantResolver.resolve({ tenantSlug: input.tenantSlug });
      if (resolved) {
        resolvedTenantId = resolved.id;
      }
    }

    const page = Math.max(1, input.page || 1);
    const limit = Math.max(1, Math.min(100, input.limit || 20));

    const result = await this.userRepo.findMany({
      ...input,
      tenantId: resolvedTenantId,
      page,
      limit
    });

    const totalPages = Math.ceil(result.total / limit) || 1;

    return Result.ok({
      items: result.users.map(toUserDto),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  }
}

// ----------------------------------------------------------------------------
// 2. Get User Detail Query
// ----------------------------------------------------------------------------
export class GetBackOfficeUserDetailQuery
  implements UseCase<{ userId: string; tenantId?: string }, BackOfficeUserDetailDto>
{
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly federatedRepo: IFederatedIdentityRepository,
    private readonly ssoSessionRepo: ISsoSessionRepository
  ) {}

  async execute(input: { userId: string; tenantId?: string }): Promise<Result<BackOfficeUserDetailDto>> {
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) {
      return Result.fail('User not found');
    }

    // Tenant info
    const tenant = await this.tenantRepo.findById(user.tenantId);

    // Federated identities
    const fedIdentities = await this.federatedRepo.findByUserId(user.id, user.tenantId);
    const federatedDtos: FederatedIdentityDto[] = fedIdentities.map((f) => ({
      id: f.id,
      tenantId: f.tenantId,
      userId: f.userId,
      providerId: f.providerId,
      providerSlug: f.providerSlug,
      subject: f.subject,
      email: f.email,
      lastLoginAt: f.lastLoginAt?.toISOString(),
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString()
    }));

    // Active SSO sessions
    const activeSessions = await this.ssoSessionRepo.listActiveByUser(user.id, user.tenantId);

    return Result.ok({
      ...toUserDto(user),
      tenantSlug: tenant?.slug,
      tenantName: tenant?.name,
      federatedIdentities: federatedDtos,
      activeSessionsCount: activeSessions.length
    });
  }
}

// ----------------------------------------------------------------------------
// 3. Create User Use Case
// ----------------------------------------------------------------------------
export class CreateBackOfficeUserUseCase
  implements UseCase<CreateBackOfficeUserDto, { user: UserDto; temporaryPassword?: string }>
{
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantResolver: TenantResolverService
  ) {}

  async execute(
    command: CreateBackOfficeUserDto
  ): Promise<Result<{ user: UserDto; temporaryPassword?: string }>> {
    const resolved = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });

    if (!resolved || !resolved.isActive) {
      return Result.fail('Target tenant not found or is currently inactive');
    }

    const email = command.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(email, resolved.id);
    if (existing) {
      return Result.fail(`User with email '${email}' already exists in tenant '${resolved.slug}'`);
    }

    let password = command.password;
    let temporaryPasswordGenerated = false;

    if (!password) {
      // Auto-generate secure temporary password: 12 alphanumeric + special characters
      const randomBytes = crypto.randomBytes(6).toString('hex');
      password = `Temp!${randomBytes}`;
      temporaryPasswordGenerated = true;
    }

    if (password.length < 8) {
      return Result.fail('Password must be at least 8 characters long');
    }

    const passwordHash = await PasswordVO.create(password);
    const role = (command.role || resolved.config.defaultRole || 'USER').toUpperCase();
    const isActive = command.isActive !== undefined ? command.isActive : true;

    const user = User.create({
      tenantId: resolved.id,
      email,
      passwordHash,
      name: command.name.trim(),
      role,
      authMethod: 'LOCAL'
    });

    if (!isActive) {
      user.deactivate();
    }

    await this.userRepo.save(user);

    await rabbitmq.publish('iam.user_registered', {
      id: crypto.randomUUID(),
      eventName: 'iam.user_registered',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      tenantId: user.tenantId,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        createdBy: 'BACKOFFICE_PORTAL'
      },
      version: 1
    });

    return Result.ok({
      user: toUserDto(user),
      ...(temporaryPasswordGenerated ? { temporaryPassword: password } : {})
    });
  }
}

// ----------------------------------------------------------------------------
// 4. Update User Use Case
// ----------------------------------------------------------------------------
export interface UpdateBackOfficeUserInput extends UpdateBackOfficeUserDto {
  userId: string;
  scopedTenantId?: string;
}

export class UpdateBackOfficeUserUseCase implements UseCase<UpdateBackOfficeUserInput, UserDto> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly ssoSessionRepo: ISsoSessionRepository
  ) {}

  async execute(command: UpdateBackOfficeUserInput): Promise<Result<UserDto>> {
    const user = await this.userRepo.findById(command.userId, command.scopedTenantId);
    if (!user) {
      return Result.fail('User not found');
    }

    // If email is changing, check uniqueness
    if (command.email && command.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const newEmail = command.email.trim().toLowerCase();
      const existing = await this.userRepo.findByEmail(newEmail, user.tenantId);
      if (existing && existing.id !== user.id) {
        return Result.fail(`Email '${newEmail}' is already in use by another user in this tenant`);
      }
    }

    user.updateProfile({
      name: command.name,
      email: command.email,
      role: command.role
    });

    if (command.isActive !== undefined) {
      if (command.isActive && !user.isActive) {
        user.activate();
      } else if (!command.isActive && user.isActive) {
        user.deactivate();
        // Revoke active sessions when user is deactivated
        await this.ssoSessionRepo.revokeByUser(
          user.id,
          user.tenantId,
          'User deactivated by back-office administrator'
        );
      }
    }

    await this.userRepo.update(user);

    await rabbitmq.publish('iam.user_updated', {
      id: crypto.randomUUID(),
      eventName: 'iam.user_updated',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      tenantId: user.tenantId,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        tenantId: user.tenantId
      },
      version: 1
    });

    return Result.ok(toUserDto(user));
  }
}

// ----------------------------------------------------------------------------
// 5. Update User Status (Suspend / Reactivate)
// ----------------------------------------------------------------------------
export interface UpdateUserStatusInput extends UpdateUserStatusDto {
  userId: string;
  scopedTenantId?: string;
  callerUserId?: string;
}

export class UpdateBackOfficeUserStatusUseCase
  implements UseCase<UpdateUserStatusInput, { userId: string; isActive: boolean; sessionsRevoked: number }>
{
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly ssoSessionRepo: ISsoSessionRepository
  ) {}

  async execute(
    command: UpdateUserStatusInput
  ): Promise<Result<{ userId: string; isActive: boolean; sessionsRevoked: number }>> {
    const user = await this.userRepo.findById(command.userId, command.scopedTenantId);
    if (!user) {
      return Result.fail('User not found');
    }

    if (command.callerUserId && command.callerUserId === user.id && !command.isActive) {
      return Result.fail('Administrators cannot suspend their own account');
    }

    // Check safeguard: cannot suspend the last active ADMIN
    if (!command.isActive && user.role.toUpperCase() === 'ADMIN') {
      const adminCount = await this.userRepo.countByRole('ADMIN', user.tenantId);
      if (adminCount <= 1) {
        return Result.fail('Cannot suspend the last active administrator for this tenant');
      }
    }

    let sessionsRevoked = 0;
    if (command.isActive) {
      user.activate();
    } else {
      user.deactivate();
      sessionsRevoked = await this.ssoSessionRepo.revokeByUser(
        user.id,
        user.tenantId,
        command.reason || 'Account suspended by back-office administrator'
      );
    }

    await this.userRepo.update(user);

    await rabbitmq.publish('iam.user_status_changed', {
      id: crypto.randomUUID(),
      eventName: 'iam.user_status_changed',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      tenantId: user.tenantId,
      payload: {
        userId: user.id,
        isActive: user.isActive,
        reason: command.reason,
        sessionsRevoked
      },
      version: 1
    });

    return Result.ok({
      userId: user.id,
      isActive: user.isActive,
      sessionsRevoked
    });
  }
}

// ----------------------------------------------------------------------------
// 6. Reset User Password
// ----------------------------------------------------------------------------
export interface ResetUserPasswordInput extends ResetUserPasswordDto {
  userId: string;
  scopedTenantId?: string;
}

export class ResetBackOfficeUserPasswordUseCase
  implements UseCase<ResetUserPasswordInput, PasswordResetResultDto>
{
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly ssoSessionRepo: ISsoSessionRepository
  ) {}

  async execute(command: ResetUserPasswordInput): Promise<Result<PasswordResetResultDto>> {
    const user = await this.userRepo.findById(command.userId, command.scopedTenantId);
    if (!user) {
      return Result.fail('User not found');
    }

    let password = command.newPassword;
    let temporaryPasswordGenerated = false;

    if (!password || command.generateRandom) {
      const randomBytes = crypto.randomBytes(6).toString('hex');
      password = `Reset!${randomBytes}`;
      temporaryPasswordGenerated = true;
    }

    if (password.length < 8) {
      return Result.fail('Password must be at least 8 characters long');
    }

    const passwordHash = await PasswordVO.create(password);
    user.changePassword(passwordHash);

    // Revoke all existing sessions so user must sign in with the new credentials
    const sessionsRevoked = await this.ssoSessionRepo.revokeByUser(
      user.id,
      user.tenantId,
      'Password reset by administrator'
    );

    await this.userRepo.update(user);

    await rabbitmq.publish('iam.user_password_reset', {
      id: crypto.randomUUID(),
      eventName: 'iam.user_password_reset',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      tenantId: user.tenantId,
      payload: {
        userId: user.id,
        email: user.email,
        sessionsRevoked
      },
      version: 1
    });

    return Result.ok({
      userId: user.id,
      email: user.email,
      passwordReset: true,
      ...(temporaryPasswordGenerated ? { temporaryPassword: password } : {}),
      sessionsRevoked
    });
  }
}

// ----------------------------------------------------------------------------
// 7. Delete User
// ----------------------------------------------------------------------------
export interface DeleteBackOfficeUserInput {
  userId: string;
  scopedTenantId?: string;
  callerUserId?: string;
}

export class DeleteBackOfficeUserUseCase
  implements UseCase<DeleteBackOfficeUserInput, { deleted: boolean; userId: string }>
{
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly ssoSessionRepo: ISsoSessionRepository
  ) {}

  async execute(
    command: DeleteBackOfficeUserInput
  ): Promise<Result<{ deleted: boolean; userId: string }>> {
    const user = await this.userRepo.findById(command.userId, command.scopedTenantId);
    if (!user) {
      return Result.fail('User not found');
    }

    if (command.callerUserId && command.callerUserId === user.id) {
      return Result.fail('Administrators cannot delete their own account');
    }

    if (user.role.toUpperCase() === 'ADMIN') {
      const adminCount = await this.userRepo.countByRole('ADMIN', user.tenantId);
      if (adminCount <= 1) {
        return Result.fail('Cannot delete the last remaining administrator for this tenant');
      }
    }

    // Revoke any active sessions
    await this.ssoSessionRepo.revokeByUser(
      user.id,
      user.tenantId,
      'User deleted by back-office administrator'
    );

    // Delete user
    const deleted = await this.userRepo.delete(user.id, user.tenantId);
    if (!deleted) {
      return Result.fail('Failed to delete user record');
    }

    await rabbitmq.publish('iam.user_deleted', {
      id: crypto.randomUUID(),
      eventName: 'iam.user_deleted',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      tenantId: user.tenantId,
      payload: {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId
      },
      version: 1
    });

    return Result.ok({ deleted: true, userId: user.id });
  }
}

// ----------------------------------------------------------------------------
// 8. User Sessions Management
// ----------------------------------------------------------------------------
export class ListUserSessionsQuery
  implements UseCase<{ userId: string; scopedTenantId?: string }, SsoSessionDto[]>
{
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly ssoSessionRepo: ISsoSessionRepository
  ) {}

  async execute(input: { userId: string; scopedTenantId?: string }): Promise<Result<SsoSessionDto[]>> {
    const user = await this.userRepo.findById(input.userId, input.scopedTenantId);
    if (!user) {
      return Result.fail('User not found');
    }

    const sessions = await this.ssoSessionRepo.listActiveByUser(user.id, user.tenantId);
    const dtos: SsoSessionDto[] = sessions.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      tenantSlug: s.tenantSlug,
      userId: s.userId,
      authMethod: s.authMethod,
      providerId: s.providerId,
      providerSlug: s.providerSlug,
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString(),
      revokedReason: s.revokedReason,
      lastActivityAt: s.lastActivityAt.toISOString(),
      createdAt: s.createdAt.toISOString()
    }));

    return Result.ok(dtos);
  }
}

export class RevokeUserSessionsUseCase
  implements UseCase<{ userId?: string; sessionId?: string; tenantId?: string; reason?: string }, { revokedCount: number }>
{
  constructor(private readonly ssoSessionRepo: ISsoSessionRepository) {}

  async execute(command: {
    userId?: string;
    sessionId?: string;
    tenantId?: string;
    reason?: string;
  }): Promise<Result<{ revokedCount: number }>> {
    if (command.sessionId) {
      const revoked = await this.ssoSessionRepo.revokeById(
        command.sessionId,
        command.reason || 'Revoked by back-office administrator'
      );
      return Result.ok({ revokedCount: revoked ? 1 : 0 });
    }

    if (command.userId) {
      const tenantId = command.tenantId || process.env.DEFAULT_TENANT_ID || 'default';
      const count = await this.ssoSessionRepo.revokeByUser(
        command.userId,
        tenantId,
        command.reason || 'All sessions revoked by back-office administrator'
      );
      return Result.ok({ revokedCount: count });
    }

    return Result.fail('Either sessionId or userId must be specified');
  }
}

// ----------------------------------------------------------------------------
// 9. Role Definitions & Permissions Inspection
// ----------------------------------------------------------------------------
export const SYSTEM_ROLE_DEFINITIONS: RoleDefinitionDto[] = [
  {
    role: 'ADMIN',
    name: 'Platform Administrator',
    description: 'Full administrative access across all tenant configurations, users, and platform resources',
    isSystem: true,
    permissions: [
      'iam:users:read',
      'iam:users:create',
      'iam:users:update',
      'iam:users:delete',
      'iam:users:reset_password',
      'iam:tenants:read',
      'iam:tenants:manage',
      'iam:sessions:revoke',
      'iam:roles:read',
      'property:create',
      'property:read',
      'property:update',
      'property:delete',
      'property:verify',
      'caretaking:assign',
      'caretaking:revoke',
      'caretaking:inspect',
      'maintenance:ticket:create',
      'maintenance:ticket:update',
      'maintenance:quote:approve',
      'finance:ledger:read',
      'finance:expense:submit',
      'finance:expense:approve',
      'rental:listing:create',
      'rental:listing:publish',
      'document:upload',
      'document:read'
    ]
  },
  {
    role: 'SUPPORT',
    name: 'Customer & Operations Support',
    description: 'Operational support role with read/inspect permissions on users, sessions, properties, and logs',
    isSystem: true,
    permissions: [
      'iam:users:read',
      'iam:tenants:read',
      'iam:roles:read',
      'property:read',
      'maintenance:ticket:create',
      'maintenance:ticket:update',
      'document:read'
    ]
  },
  {
    role: 'CARETAKER',
    name: 'Property Caretaker',
    description: 'Assigned caretaker responsible for property maintenance inspections, task execution, and reporting',
    isSystem: true,
    permissions: [
      'property:read',
      'caretaking:inspect',
      'maintenance:ticket:create',
      'maintenance:ticket:update',
      'finance:expense:submit',
      'document:upload',
      'document:read'
    ]
  },
  {
    role: 'OWNER',
    name: 'Property Owner',
    description: 'Property owner with full rights over registered properties, caretaker approvals, and expenses',
    isSystem: true,
    permissions: [
      'property:create',
      'property:read',
      'property:update',
      'caretaking:assign',
      'caretaking:revoke',
      'maintenance:quote:approve',
      'finance:expense:approve',
      'rental:listing:create',
      'document:upload',
      'document:read'
    ]
  },
  {
    role: 'TENANT',
    name: 'Property Tenant',
    description: 'Active tenant residing at property with maintenance submission and lease view rights',
    isSystem: true,
    permissions: [
      'property:read',
      'maintenance:ticket:create',
      'rental:lease:sign',
      'document:read'
    ]
  },
  {
    role: 'BUYER',
    name: 'Prospective Buyer',
    description: 'Prospective property buyer with search, enquiry, and transaction documentation privileges',
    isSystem: true,
    permissions: [
      'property:read',
      'document:read'
    ]
  },
  {
    role: 'VENDOR',
    name: 'Maintenance Vendor',
    description: 'External service professional or vendor for plumbing, electrical, carpentry, and repair tasks',
    isSystem: true,
    permissions: [
      'maintenance:ticket:update',
      'finance:expense:submit',
      'document:upload'
    ]
  },
  {
    role: 'AGENT',
    name: 'Real Estate Agent',
    description: 'Authorized real estate broker facilitating property rentals, sales, visits, and negotiations',
    isSystem: true,
    permissions: [
      'property:read',
      'rental:listing:create',
      'rental:listing:publish',
      'document:read'
    ]
  },
  {
    role: 'LEGAL',
    name: 'Legal & Documentation Officer',
    description: 'Legal professional conducting document verification, deed preparation, and compliance checks',
    isSystem: true,
    permissions: [
      'property:read',
      'property:verify',
      'document:upload',
      'document:read',
      'document:verify_legal',
      'document:reject'
    ]
  },
  {
    role: 'AUDITOR',
    name: 'Compliance Auditor',
    description: 'Read-only compliance officer auditing immutable event logs and administrative actions',
    isSystem: true,
    permissions: [
      'iam:users:read',
      'iam:tenants:read',
      'finance:ledger:read',
      'document:read'
    ]
  },
  {
    role: 'USER',
    name: 'Standard End User',
    description: 'Default platform end-user account',
    isSystem: true,
    permissions: [
      'property:read'
    ]
  }
];

export class GetBackOfficeRolesQuery implements UseCase<void, RoleDefinitionDto[]> {
  async execute(): Promise<Result<RoleDefinitionDto[]>> {
    return Result.ok(SYSTEM_ROLE_DEFINITIONS);
  }
}

// ----------------------------------------------------------------------------
// 10. Delete Tenant Use Case (Completing Tenant CRUD for Back-Office)
// ----------------------------------------------------------------------------
export class DeleteTenantUseCase
  implements UseCase<{ idOrSlug: string }, { deleted: boolean; tenantId: string; slug: string }>
{
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async execute(input: {
    idOrSlug: string;
  }): Promise<Result<{ deleted: boolean; tenantId: string; slug: string }>> {
    const slug = input.idOrSlug.trim().toLowerCase();
    if (slug === 'default') {
      return Result.fail('The system default tenant cannot be deleted');
    }

    const tenant = await this.tenantRepo.findByIdOrSlug(input.idOrSlug);
    if (!tenant) {
      return Result.fail('Tenant not found');
    }

    if (tenant.id === 'default' || tenant.slug === 'default') {
      return Result.fail('The system default tenant cannot be deleted');
    }

    const deleted = await this.tenantRepo.delete(tenant.id);
    if (!deleted) {
      return Result.fail('Failed to delete tenant');
    }

    await rabbitmq.publish('iam.tenant_deleted', {
      id: crypto.randomUUID(),
      eventName: 'iam.tenant_deleted',
      aggregateId: tenant.id,
      occurredAt: new Date().toISOString(),
      tenantId: tenant.id,
      payload: {
        tenantId: tenant.id,
        slug: tenant.slug,
        name: tenant.name
      },
      version: 1
    });

    return Result.ok({
      deleted: true,
      tenantId: tenant.id,
      slug: tenant.slug
    });
  }
}
