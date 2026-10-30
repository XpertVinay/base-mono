import { Router, RequestHandler } from 'express';
import { PostgresUserRepository } from './infrastructure/persistence/postgres-user.repository.js';
import { PostgresIamAuditRepository } from './infrastructure/persistence/iam-audit.repository.js';
import { PostgresMfaProtectedRouteRepository } from './infrastructure/persistence/mfa-protected-route.repository.js';
import { PostgresOrganizationRepository } from './infrastructure/persistence/postgres-organization.repository.js';
import { PostgresOrganizationMembershipRepository } from './infrastructure/persistence/postgres-organization-membership.repository.js';
import { PostgresOrganizationInvitationRepository } from './infrastructure/persistence/postgres-organization-invitation.repository.js';
import { PostgresTenantRoleRepository } from './infrastructure/persistence/postgres-tenant-role.repository.js';
import { MfaRouteCache } from './infrastructure/cache/mfa-route.cache.js';

import { RegisterUserUseCase } from './application/commands/register-user.use-case.js';
import { LoginUserUseCase } from './application/commands/login-user.use-case.js';
import { RefreshTokenUseCase } from './application/commands/refresh-token.use-case.js';
import { GetUserByIdQuery } from './application/queries/get-user-by-id.query.js';
import { SetupMfaUseCase } from './application/commands/mfa/setup-mfa.use-case.js';
import { EnableMfaUseCase } from './application/commands/mfa/enable-mfa.use-case.js';
import { VerifyMfaUseCase } from './application/commands/mfa/verify-mfa.use-case.js';
import { ReverifyMfaUseCase } from './application/commands/mfa/reverify-mfa.use-case.js';
import { DisableMfaUseCase } from './application/commands/mfa/disable-mfa.use-case.js';
import { GetMfaStatusQuery } from './application/queries/get-mfa-status.query.js';
import { SsoLoginUseCase } from './application/commands/sso/sso-login.use-case.js';
import { GetAuditLogsQuery } from './application/queries/get-audit-logs.query.js';
import { ManageProtectedRoutesUseCase } from './application/commands/mfa/manage-protected-routes.use-case.js';

import { CreateOrganizationUseCase } from './application/commands/organization/create-organization.use-case.js';
import { UpdateOrganizationUseCase } from './application/commands/organization/update-organization.use-case.js';
import { UpdateOrganizationStatusUseCase } from './application/commands/organization/update-organization-status.use-case.js';
import { InviteMemberUseCase } from './application/commands/organization/invite-member.use-case.js';
import { AcceptInvitationUseCase } from './application/commands/organization/accept-invitation.use-case.js';
import { RejectInvitationUseCase } from './application/commands/organization/reject-invitation.use-case.js';
import { RequestMembershipUseCase } from './application/commands/organization/request-membership.use-case.js';
import { UpdateMembershipUseCase } from './application/commands/organization/update-membership.use-case.js';
import { RemoveMemberUseCase } from './application/commands/organization/remove-member.use-case.js';
import { GetOrganizationQuery } from './application/queries/organization/get-organization.query.js';
import { ListUserOrganizationsQuery } from './application/queries/organization/list-user-organizations.query.js';
import { ListOrganizationMembersQuery } from './application/queries/organization/list-organization-members.query.js';
import { ListOrganizationInvitationsQuery } from './application/queries/organization/list-organization-invitations.query.js';
import { ValidateTenantContextQuery } from './application/queries/organization/validate-tenant-context.query.js';

import { CreateTenantRoleUseCase } from './application/commands/rbac/create-tenant-role.use-case.js';
import { UpdateRolePermissionsUseCase } from './application/commands/rbac/update-role-permissions.use-case.js';
import { AssignRoleToMemberUseCase } from './application/commands/rbac/assign-role-to-member.use-case.js';
import { ListTenantRolesQuery } from './application/queries/rbac/list-tenant-roles.query.js';
import { GetTenantRoleQuery } from './application/queries/rbac/get-tenant-role.query.js';
import { DeleteTenantRoleUseCase } from './application/commands/rbac/delete-tenant-role.use-case.js';
import { EvaluatePermissionQuery } from './application/queries/rbac/evaluate-permission.query.js';

import { IamController } from './presentation/http/iam.controller.js';
import { createIamRouter } from './presentation/http/iam.routes.js';
import { createMfaReverificationMiddleware } from './presentation/middleware/mfa-reverification.middleware.js';
import { createTenantContextMiddleware, requireTenantMembership } from './presentation/middleware/tenant-context.middleware.js';
import { createRequirePermissionMiddleware } from './presentation/middleware/tenant-permission.middleware.js';

import { cryptoService } from '../../shared/infrastructure/crypto.service.js';
import { eventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { UserDto, UserOrganizationContextDto, PlatformPermission, TenantUserPermissionsDto } from '@monolith/contracts';

export interface IIamModulePublicApi {
  getUserById(id: string): Promise<UserDto | null>;
  verifyMfaStatus(userId: string): Promise<{ enabled: boolean; lastVerifiedAt: Date | null }>;
  getMfaRouteCache(): MfaRouteCache;
  getMfaMiddleware(): RequestHandler;
  validateTenantContext(userId: string, orgId: string): Promise<UserOrganizationContextDto>;
  createTenantContextMiddleware(): RequestHandler;
  requireTenantMembership(): RequestHandler;
  evaluatePermissions(userId: string, orgId: string): Promise<TenantUserPermissionsDto>;
  requirePermission(...permissions: PlatformPermission[]): RequestHandler;
  requirePermissions(...permissions: PlatformPermission[]): RequestHandler;
}

export class IamModule {
  public static init(): { router: Router; publicApi: IIamModulePublicApi; mfaMiddleware: RequestHandler } {
    // 1. Repositories & Caches
    const userRepository = new PostgresUserRepository();
    const auditRepository = new PostgresIamAuditRepository();
    const protectedRouteRepository = new PostgresMfaProtectedRouteRepository();
    const organizationRepository = new PostgresOrganizationRepository();
    const membershipRepository = new PostgresOrganizationMembershipRepository();
    const invitationRepository = new PostgresOrganizationInvitationRepository();
    const tenantRoleRepository = new PostgresTenantRoleRepository();
    const mfaRouteCache = new MfaRouteCache(protectedRouteRepository);

    // Warm up protected route cache asynchronously
    mfaRouteCache.warmUp();

    // 2. Application Use Cases & Queries
    const registerUserUseCase = new RegisterUserUseCase(userRepository, cryptoService, eventBus);
    const loginUserUseCase = new LoginUserUseCase(userRepository, cryptoService, auditRepository);
    const refreshTokenUseCase = new RefreshTokenUseCase(userRepository, auditRepository);
    const getUserByIdQuery = new GetUserByIdQuery(userRepository);

    const setupMfaUseCase = new SetupMfaUseCase(userRepository, auditRepository);
    const enableMfaUseCase = new EnableMfaUseCase(userRepository, auditRepository);
    const verifyMfaUseCase = new VerifyMfaUseCase(userRepository, auditRepository);
    const reverifyMfaUseCase = new ReverifyMfaUseCase(userRepository, auditRepository);
    const disableMfaUseCase = new DisableMfaUseCase(userRepository, cryptoService, auditRepository);
    const getMfaStatusQuery = new GetMfaStatusQuery(userRepository);

    const ssoLoginUseCase = new SsoLoginUseCase(userRepository, auditRepository);
    const getAuditLogsQuery = new GetAuditLogsQuery(auditRepository);
    const manageProtectedRoutesUseCase = new ManageProtectedRoutesUseCase(
      protectedRouteRepository,
      mfaRouteCache,
      auditRepository
    );

    // Organization Use Cases & Queries (Sprint 03)
    const createOrgUseCase = new CreateOrganizationUseCase(organizationRepository, membershipRepository);
    const updateOrgUseCase = new UpdateOrganizationUseCase(organizationRepository, membershipRepository);
    const updateOrgStatusUseCase = new UpdateOrganizationStatusUseCase(organizationRepository, membershipRepository);
    const inviteMemberUseCase = new InviteMemberUseCase(organizationRepository, membershipRepository, invitationRepository);
    const acceptInvitationUseCase = new AcceptInvitationUseCase(invitationRepository, membershipRepository, organizationRepository);
    const rejectInvitationUseCase = new RejectInvitationUseCase(invitationRepository);
    const requestMembershipUseCase = new RequestMembershipUseCase(organizationRepository, membershipRepository);
    const updateMembershipUseCase = new UpdateMembershipUseCase(organizationRepository, membershipRepository);
    const removeMemberUseCase = new RemoveMemberUseCase(organizationRepository, membershipRepository);
    const getOrgQuery = new GetOrganizationQuery(organizationRepository, membershipRepository);
    const listUserOrgsQuery = new ListUserOrganizationsQuery(membershipRepository, organizationRepository);
    const listOrgMembersQuery = new ListOrganizationMembersQuery(membershipRepository, userRepository);
    const listOrgInvitationsQuery = new ListOrganizationInvitationsQuery(invitationRepository, membershipRepository);
    const validateTenantContextQuery = new ValidateTenantContextQuery(organizationRepository, membershipRepository);

    // Dynamic RBAC Use Cases & Queries (Sprint 04)
    const evaluatePermissionQuery = new EvaluatePermissionQuery(organizationRepository, membershipRepository, tenantRoleRepository);
    const createTenantRoleUseCase = new CreateTenantRoleUseCase(organizationRepository, membershipRepository, tenantRoleRepository);
    const updateRolePermissionsUseCase = new UpdateRolePermissionsUseCase(organizationRepository, membershipRepository, tenantRoleRepository);
    const assignRoleToMemberUseCase = new AssignRoleToMemberUseCase(organizationRepository, membershipRepository, tenantRoleRepository);
    const listTenantRolesQuery = new ListTenantRolesQuery(organizationRepository, membershipRepository, tenantRoleRepository);
    const getTenantRoleQuery = new GetTenantRoleQuery(organizationRepository, membershipRepository, tenantRoleRepository);
    const deleteTenantRoleUseCase = new DeleteTenantRoleUseCase(organizationRepository, membershipRepository, tenantRoleRepository);

    // 3. Presentation HTTP Controller & Router
    const controller = new IamController(
      registerUserUseCase,
      loginUserUseCase,
      refreshTokenUseCase,
      getUserByIdQuery,
      setupMfaUseCase,
      enableMfaUseCase,
      verifyMfaUseCase,
      reverifyMfaUseCase,
      disableMfaUseCase,
      getMfaStatusQuery,
      ssoLoginUseCase,
      getAuditLogsQuery,
      manageProtectedRoutesUseCase,
      createOrgUseCase,
      updateOrgUseCase,
      updateOrgStatusUseCase,
      inviteMemberUseCase,
      acceptInvitationUseCase,
      rejectInvitationUseCase,
      requestMembershipUseCase,
      updateMembershipUseCase,
      removeMemberUseCase,
      getOrgQuery,
      listUserOrgsQuery,
      listOrgMembersQuery,
      listOrgInvitationsQuery,
      validateTenantContextQuery,
      createTenantRoleUseCase,
      updateRolePermissionsUseCase,
      assignRoleToMemberUseCase,
      listTenantRolesQuery,
      getTenantRoleQuery,
      deleteTenantRoleUseCase,
      evaluatePermissionQuery
    );

    const router = createIamRouter(controller);
    const mfaMiddleware = createMfaReverificationMiddleware(mfaRouteCache, userRepository, auditRepository);
    const requirePermissionGuard = createRequirePermissionMiddleware(evaluatePermissionQuery, validateTenantContextQuery);

    // 4. Public API for Cross-Module Ingestion
    const publicApi: IIamModulePublicApi = {
      getUserById: async (id: string) => {
        const result = await getUserByIdQuery.execute({ id });
        return result.isSuccess ? result.getValue() : null;
      },
      verifyMfaStatus: async (userId: string) => {
        const user = await userRepository.findById(userId);
        return {
          enabled: user?.mfaEnabled ?? false,
          lastVerifiedAt: user?.mfaLastVerifiedAt ?? null
        };
      },
      getMfaRouteCache: () => mfaRouteCache,
      getMfaMiddleware: () => mfaMiddleware,
      validateTenantContext: async (userId: string, orgId: string) => {
        return validateTenantContextQuery.execute(userId, orgId);
      },
      createTenantContextMiddleware: () => createTenantContextMiddleware(validateTenantContextQuery),
      requireTenantMembership: () => requireTenantMembership(validateTenantContextQuery),
      evaluatePermissions: async (userId: string, orgId: string) => {
        return evaluatePermissionQuery.execute(userId, orgId);
      },
      requirePermission: (...permissions: PlatformPermission[]) => requirePermissionGuard(...permissions),
      requirePermissions: (...permissions: PlatformPermission[]) => requirePermissionGuard(...permissions)
    };

    container.register('iamPublicApi', publicApi);
    container.register('IIamModulePublicApi', publicApi);

    return { router, publicApi, mfaMiddleware };
  }
}
