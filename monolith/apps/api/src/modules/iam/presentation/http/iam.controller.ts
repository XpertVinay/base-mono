import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegisterUserUseCase } from '../../application/commands/register-user.use-case.js';
import { LoginUserUseCase } from '../../application/commands/login-user.use-case.js';
import { RefreshTokenUseCase } from '../../application/commands/refresh-token.use-case.js';
import { GetUserByIdQuery } from '../../application/queries/get-user-by-id.query.js';
import { SetupMfaUseCase } from '../../application/commands/mfa/setup-mfa.use-case.js';
import { EnableMfaUseCase } from '../../application/commands/mfa/enable-mfa.use-case.js';
import { VerifyMfaUseCase } from '../../application/commands/mfa/verify-mfa.use-case.js';
import { ReverifyMfaUseCase } from '../../application/commands/mfa/reverify-mfa.use-case.js';
import { DisableMfaUseCase } from '../../application/commands/mfa/disable-mfa.use-case.js';
import { GetMfaStatusQuery } from '../../application/queries/get-mfa-status.query.js';
import { SsoLoginUseCase } from '../../application/commands/sso/sso-login.use-case.js';
import { GetAuditLogsQuery } from '../../application/queries/get-audit-logs.query.js';
import { ManageProtectedRoutesUseCase } from '../../application/commands/mfa/manage-protected-routes.use-case.js';
import { CreateOrganizationUseCase } from '../../application/commands/organization/create-organization.use-case.js';
import { UpdateOrganizationUseCase } from '../../application/commands/organization/update-organization.use-case.js';
import { UpdateOrganizationStatusUseCase } from '../../application/commands/organization/update-organization-status.use-case.js';
import { InviteMemberUseCase } from '../../application/commands/organization/invite-member.use-case.js';
import { AcceptInvitationUseCase } from '../../application/commands/organization/accept-invitation.use-case.js';
import { RejectInvitationUseCase } from '../../application/commands/organization/reject-invitation.use-case.js';
import { RequestMembershipUseCase } from '../../application/commands/organization/request-membership.use-case.js';
import { UpdateMembershipUseCase } from '../../application/commands/organization/update-membership.use-case.js';
import { RemoveMemberUseCase } from '../../application/commands/organization/remove-member.use-case.js';
import { GetOrganizationQuery } from '../../application/queries/organization/get-organization.query.js';
import { ListUserOrganizationsQuery } from '../../application/queries/organization/list-user-organizations.query.js';
import { ListOrganizationMembersQuery } from '../../application/queries/organization/list-organization-members.query.js';
import { ListOrganizationInvitationsQuery } from '../../application/queries/organization/list-organization-invitations.query.js';
import { ValidateTenantContextQuery } from '../../application/queries/organization/validate-tenant-context.query.js';
import { CreateTenantRoleUseCase } from '../../application/commands/rbac/create-tenant-role.use-case.js';
import { UpdateRolePermissionsUseCase } from '../../application/commands/rbac/update-role-permissions.use-case.js';
import { AssignRoleToMemberUseCase } from '../../application/commands/rbac/assign-role-to-member.use-case.js';
import { ListTenantRolesQuery } from '../../application/queries/rbac/list-tenant-roles.query.js';
import { GetTenantRoleQuery } from '../../application/queries/rbac/get-tenant-role.query.js';
import { DeleteTenantRoleUseCase } from '../../application/commands/rbac/delete-tenant-role.use-case.js';
import { EvaluatePermissionQuery } from '../../application/queries/rbac/evaluate-permission.query.js';
import { PlatformPermission } from '@monolith/contracts';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';
import { extractClientContext } from '../../../../shared/presentation/auth.middleware.js';
import { tokenService } from '../../../../shared/infrastructure/token.service.js';
import { UnauthorizedError } from '../../../../shared/presentation/error-handler.middleware.js';
import { env } from '../../../../config/env.js';

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).optional(),
  type: z.enum(['ENTERPRISE', 'PROPERTY_MANAGEMENT', 'AGENCY', 'BROKERAGE', 'HOA', 'INDIVIDUAL']).optional(),
  metadata: z.record(z.any()).optional()
});

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  type: z.enum(['ENTERPRISE', 'PROPERTY_MANAGEMENT', 'AGENCY', 'BROKERAGE', 'HOA', 'INDIVIDUAL']).optional(),
  metadata: z.record(z.any()).optional()
});

const updateOrgStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED'])
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
  expiresInDays: z.number().int().positive().max(30).optional()
});

const updateMembershipSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED']).optional()
});

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
  role: z.enum(['ADMIN', 'USER', 'AUDITOR', 'OWNER', 'CARETAKER', 'TENANT', 'BUYER', 'VENDOR', 'AGENT', 'LEGAL']).optional(),
  tenantId: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
  tenantId: z.string().optional()
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const enableMfaSchema = z.object({
  code: z.string().min(6).max(10),
  secret: z.string().min(16),
  backupCodes: z.array(z.string()).optional()
});

const verifyMfaSchema = z.object({
  mfaChallengeToken: z.string().min(1),
  code: z.string().min(6).max(10)
});

const reverifyMfaSchema = z.object({
  code: z.string().min(6).max(10)
});

const disableMfaSchema = z.object({
  code: z.string().min(6).max(10),
  password: z.string().optional()
});

const ssoInitiateSchema = z.object({
  provider: z.enum(['google', 'azure-ad', 'okta', 'mock-sso']).default('mock-sso'),
  redirectUri: z.string().url().optional()
});

const ssoCallbackSchema = z.object({
  provider: z.string().min(1),
  state: z.string().min(1),
  code: z.string().optional(),
  idToken: z.string().optional(),
  mockProfile: z.object({
    email: z.string().email(),
    name: z.string(),
    subjectId: z.string().optional()
  }).optional()
});

const createProtectedRouteSchema = z.object({
  method: z.string().default('*'),
  pathPattern: z.string().min(1),
  description: z.string().optional(),
  reverificationMode: z.enum(['SESSION_24H', 'EVERY_TIME']).default('SESSION_24H')
});

const createTenantRoleSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1)
});

const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string()).min(1)
});

const assignRoleSchema = z.object({
  roleId: z.string().min(1)
});

export class IamController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly getUserByIdQuery: GetUserByIdQuery,
    private readonly setupMfaUseCase?: SetupMfaUseCase,
    private readonly enableMfaUseCase?: EnableMfaUseCase,
    private readonly verifyMfaUseCase?: VerifyMfaUseCase,
    private readonly reverifyMfaUseCase?: ReverifyMfaUseCase,
    private readonly disableMfaUseCase?: DisableMfaUseCase,
    private readonly getMfaStatusQuery?: GetMfaStatusQuery,
    private readonly ssoLoginUseCase?: SsoLoginUseCase,
    private readonly getAuditLogsQuery?: GetAuditLogsQuery,
    private readonly manageProtectedRoutesUseCase?: ManageProtectedRoutesUseCase,
    private readonly createOrgUseCase?: CreateOrganizationUseCase,
    private readonly updateOrgUseCase?: UpdateOrganizationUseCase,
    private readonly updateOrgStatusUseCase?: UpdateOrganizationStatusUseCase,
    private readonly inviteMemberUseCase?: InviteMemberUseCase,
    private readonly acceptInvitationUseCase?: AcceptInvitationUseCase,
    private readonly rejectInvitationUseCase?: RejectInvitationUseCase,
    private readonly requestMembershipUseCase?: RequestMembershipUseCase,
    private readonly updateMembershipUseCase?: UpdateMembershipUseCase,
    private readonly removeMemberUseCase?: RemoveMemberUseCase,
    private readonly getOrgQuery?: GetOrganizationQuery,
    private readonly listUserOrgsQuery?: ListUserOrganizationsQuery,
    private readonly listOrgMembersQuery?: ListOrganizationMembersQuery,
    private readonly listOrgInvitationsQuery?: ListOrganizationInvitationsQuery,
    private readonly validateTenantContextQuery?: ValidateTenantContextQuery,
    private readonly createTenantRoleUseCase?: CreateTenantRoleUseCase,
    private readonly updateRolePermissionsUseCase?: UpdateRolePermissionsUseCase,
    private readonly assignRoleToMemberUseCase?: AssignRoleToMemberUseCase,
    private readonly listTenantRolesQuery?: ListTenantRolesQuery,
    private readonly getTenantRoleQuery?: GetTenantRoleQuery,
    private readonly deleteTenantRoleUseCase?: DeleteTenantRoleUseCase,
    private readonly evaluatePermissionQuery?: EvaluatePermissionQuery
  ) { }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = registerSchema.parse(req.body);
      const canAssignRole = req.user?.role === 'ADMIN' || env.NODE_ENV !== 'production';
      const role = (canAssignRole && validated.role) ? validated.role : 'USER';
      const result = await this.registerUserUseCase.execute({ ...validated, role });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = loginSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.loginUserUseCase.execute({ ...validated, clientContext });

      if (result.isFailure) {
        return next(result.getError());
      }

      const value = result.getValue();
      const status = 'mfaRequired' in value && value.mfaRequired ? 200 : 200;

      res.status(status).json({
        success: true,
        data: value,
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = refreshSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.refreshTokenUseCase.execute({ ...validated, clientContext });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await this.getUserByIdQuery.execute({ id: userId });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  // -------------------------------------------------------------
  // MFA Feature Endpoints
  // -------------------------------------------------------------

  setupMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const clientContext = extractClientContext(req);
      const result = await this.setupMfaUseCase!.execute({ userId, clientContext });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  enableMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const validated = enableMfaSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.enableMfaUseCase!.execute({
        userId,
        code: validated.code,
        secret: validated.secret,
        backupCodes: validated.backupCodes,
        clientContext
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  verifyMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = verifyMfaSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.verifyMfaUseCase!.execute({
        mfaChallengeToken: validated.mfaChallengeToken,
        code: validated.code,
        clientContext
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  reverifyMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const validated = reverifyMfaSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.reverifyMfaUseCase!.execute({
        userId,
        code: validated.code,
        clientContext
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  disableMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const validated = disableMfaSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.disableMfaUseCase!.execute({
        userId,
        code: validated.code,
        password: validated.password,
        clientContext
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getMfaStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await this.getMfaStatusQuery!.execute({ userId });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  // -------------------------------------------------------------
  // SSO Endpoints
  // -------------------------------------------------------------

  ssoInitiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = ssoInitiateSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.ssoLoginUseCase!.initiate(validated, clientContext);

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  ssoCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = ssoCallbackSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.ssoLoginUseCase!.callback(validated, clientContext);

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  // -------------------------------------------------------------
  // Audit Logs & Protected Routes Management
  // -------------------------------------------------------------

  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, eventType, status, limit, offset } = req.query;
      const result = await this.getAuditLogsQuery!.execute({
        userId: userId as string,
        eventType: eventType as string,
        status: status as any,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  listProtectedRoutes = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.manageProtectedRoutesUseCase!.listRoutes();
      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  addProtectedRoute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createProtectedRouteSchema.parse(req.body);
      const result = await this.manageProtectedRoutesUseCase!.addRoute(validated, req.user?.id);

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  deleteProtectedRoute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.manageProtectedRoutesUseCase!.removeRoute(id, req.user?.id);

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: { id, deleted: result.getValue() },
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getJwks = async (_req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(tokenService.getJwks());
  };

  getPublicKey = async (_req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(tokenService.getPublicKeyPem());
  };

  // =========================================================================
  // Multi-Tenant Organization Management Endpoints (Sprint 03)
  // =========================================================================

  createOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const validated = createOrgSchema.parse(req.body);
      const org = await this.createOrgUseCase!.execute(req.user.id, validated);

      res.status(201).json({
        success: true,
        data: org,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const isPlatformAdmin = req.user?.role === 'ADMIN';
      const org = await this.getOrgQuery!.execute(id, req.user?.id, isPlatformAdmin);

      res.status(200).json({
        success: true,
        data: org,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  updateOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const id = req.params.id as string;
      const validated = updateOrgSchema.parse(req.body);
      const org = await this.updateOrgUseCase!.execute(req.user.id, id, validated);

      res.status(200).json({
        success: true,
        data: org,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  updateOrganizationStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const id = req.params.id as string;
      const validated = updateOrgStatusSchema.parse(req.body);
      const isPlatformAdmin = req.user.role === 'ADMIN';
      const org = await this.updateOrgStatusUseCase!.execute(req.user.id, isPlatformAdmin, id, validated);

      res.status(200).json({
        success: true,
        data: org,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listUserOrganizations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const memberships = await this.listUserOrgsQuery!.execute(req.user.id);

      res.status(200).json({
        success: true,
        data: memberships,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getOrganizationContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const id = req.params.id as string;
      const context = await this.validateTenantContextQuery!.execute(req.user.id, id);

      res.status(200).json({
        success: true,
        data: context,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listOrganizationMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const id = req.params.id as string;
      const members = await this.listOrgMembersQuery!.execute(req.user.id, id);

      res.status(200).json({
        success: true,
        data: members,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  updateMembership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const targetUserId = req.params.userId as string;
      const validated = updateMembershipSchema.parse(req.body);
      const membership = await this.updateMembershipUseCase!.execute(req.user.id, organizationId, targetUserId, validated);

      res.status(200).json({
        success: true,
        data: membership,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const targetUserId = req.params.userId as string;
      await this.removeMemberUseCase!.execute(req.user.id, organizationId, targetUserId);

      res.status(200).json({
        success: true,
        data: { removed: true, organizationId, userId: targetUserId },
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  inviteMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const validated = inviteMemberSchema.parse(req.body);
      const invitation = await this.inviteMemberUseCase!.execute(req.user.id, organizationId, validated);

      res.status(201).json({
        success: true,
        data: invitation,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const invitations = await this.listOrgInvitationsQuery!.execute(req.user.id, organizationId);

      res.status(200).json({
        success: true,
        data: invitations,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  acceptInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const token = req.params.token as string;
      const membership = await this.acceptInvitationUseCase!.execute(req.user.id, token);

      res.status(200).json({
        success: true,
        data: membership,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  rejectInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      const invitation = await this.rejectInvitationUseCase!.execute(token);

      res.status(200).json({
        success: true,
        data: invitation,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  requestMembership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const membership = await this.requestMembershipUseCase!.execute(req.user.id, organizationId);

      res.status(201).json({
        success: true,
        data: membership,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  approveJoinRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const targetUserId = req.params.userId as string;
      const membership = await this.updateMembershipUseCase!.execute(req.user.id, organizationId, targetUserId, { status: 'ACTIVE' });

      res.status(200).json({
        success: true,
        data: membership,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  rejectJoinRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const targetUserId = req.params.userId as string;
      const membership = await this.updateMembershipUseCase!.execute(req.user.id, organizationId, targetUserId, { status: 'REJECTED' });

      res.status(200).json({
        success: true,
        data: membership,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  // =========================================================================
  // Dynamic RBAC & Organization Roles (Sprint 04)
  // =========================================================================

  listTenantRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const roles = await this.listTenantRolesQuery!.execute(organizationId, req.user.id);

      res.status(200).json({
        success: true,
        data: roles,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getTenantRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const roleId = req.params.roleId as string;
      const role = await this.getTenantRoleQuery!.execute(organizationId, roleId, req.user.id);

      res.status(200).json({
        success: true,
        data: role,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  createTenantRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const validated = createTenantRoleSchema.parse(req.body);
      const organizationId = req.params.id as string;
      const role = await this.createTenantRoleUseCase!.execute({
        organizationId,
        userId: req.user.id,
        name: validated.name,
        description: validated.description,
        permissions: validated.permissions as PlatformPermission[]
      });

      res.status(201).json({
        success: true,
        data: role,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  updateRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const validated = updateRolePermissionsSchema.parse(req.body);
      const organizationId = req.params.id as string;
      const roleId = req.params.roleId as string;
      const role = await this.updateRolePermissionsUseCase!.execute({
        organizationId,
        roleId,
        userId: req.user.id,
        permissions: validated.permissions as PlatformPermission[]
      });

      res.status(200).json({
        success: true,
        data: role,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  deleteTenantRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const roleId = req.params.roleId as string;
      await this.deleteTenantRoleUseCase!.execute(organizationId, roleId, req.user.id);

      res.status(200).json({
        success: true,
        data: { message: `Role '${roleId}' successfully deleted` },
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  assignMemberRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const validated = assignRoleSchema.parse(req.body);
      const organizationId = req.params.id as string;
      const targetUserId = req.params.userId as string;
      const membership = await this.assignRoleToMemberUseCase!.execute({
        organizationId,
        userId: req.user.id,
        targetUserId,
        roleIdOrName: validated.roleId
      });

      res.status(200).json({
        success: true,
        data: membership,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getMyPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next(new UnauthorizedError('Authentication required'));
      const organizationId = req.params.id as string;
      const permissions = await this.evaluatePermissionQuery!.execute(req.user.id, organizationId);

      res.status(200).json({
        success: true,
        data: permissions,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
