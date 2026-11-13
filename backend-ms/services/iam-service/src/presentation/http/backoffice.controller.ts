import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ListBackOfficeUsersQuery,
  GetBackOfficeUserDetailQuery,
  CreateBackOfficeUserUseCase,
  UpdateBackOfficeUserUseCase,
  UpdateBackOfficeUserStatusUseCase,
  ResetBackOfficeUserPasswordUseCase,
  DeleteBackOfficeUserUseCase,
  ListUserSessionsQuery,
  RevokeUserSessionsUseCase,
  GetBackOfficeRolesQuery,
  DeleteTenantUseCase
} from '../../application/commands/backoffice-user.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

// Query schemas
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  role: z.string().trim().optional(),
  status: z.enum(['active', 'inactive', 'true', 'false', 'all']).optional(),
  isActive: z.coerce.boolean().optional(),
  authMethod: z.string().trim().optional(),
  tenantId: z.string().trim().optional(),
  tenantSlug: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'email', 'name', 'role']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional().default('desc')
});

// Request body schemas
const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(128).optional(),
  role: z.string().trim().min(1).max(50).optional().default('USER'),
  tenantId: z.string().trim().min(1).max(64).optional(),
  tenantSlug: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional().default(true)
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
  role: z.string().trim().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  tenantId: z.string().trim().min(1).max(64).optional()
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(255).optional()
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128).optional(),
  generateRandom: z.boolean().optional().default(false)
});

const revokeSessionsSchema = z.object({
  sessionId: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  reason: z.string().trim().max(255).optional()
});

export class BackOfficeController {
  constructor(
    private readonly listUsersQuery: ListBackOfficeUsersQuery,
    private readonly getUserDetailQuery: GetBackOfficeUserDetailQuery,
    private readonly createUserUseCase: CreateBackOfficeUserUseCase,
    private readonly updateUserUseCase: UpdateBackOfficeUserUseCase,
    private readonly updateStatusUseCase: UpdateBackOfficeUserStatusUseCase,
    private readonly resetPasswordUseCase: ResetBackOfficeUserPasswordUseCase,
    private readonly deleteUserUseCase: DeleteBackOfficeUserUseCase,
    private readonly listSessionsQuery: ListUserSessionsQuery,
    private readonly revokeSessionsUseCase: RevokeUserSessionsUseCase,
    private readonly getRolesQuery: GetBackOfficeRolesQuery,
    private readonly deleteTenantUseCase: DeleteTenantUseCase
  ) {}

  /**
   * Helper to check if requester can access multi-tenant resources across boundaries
   */
  private getEffectiveTenantId(req: Request, queryTenantId?: string): string | undefined {
    // If caller is an ADMIN of the default tenant, they can specify any tenantId or query globally
    const isGlobalAdmin = req.user?.role === 'ADMIN' && req.user?.tenantId === 'default';
    if (isGlobalAdmin) {
      return queryTenantId || undefined;
    }
    // Otherwise scope strictly to the caller's tenant
    return req.user?.tenantId || 'default';
  }

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = listUsersQuerySchema.parse(req.query);

      let isActiveFilter: boolean | undefined = validated.isActive;
      if (validated.status) {
        if (validated.status === 'active' || validated.status === 'true') {
          isActiveFilter = true;
        } else if (validated.status === 'inactive' || validated.status === 'false') {
          isActiveFilter = false;
        }
      }

      const tenantId = this.getEffectiveTenantId(req, validated.tenantId);

      const result = await this.listUsersQuery.execute({
        page: validated.page,
        limit: validated.limit,
        search: validated.search,
        role: validated.role,
        isActive: isActiveFilter,
        authMethod: validated.authMethod,
        tenantId,
        tenantSlug: validated.tenantSlug,
        sortBy: validated.sortBy,
        sortOrder: validated.sortOrder.toUpperCase() as 'ASC' | 'DESC'
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError()
        });
        return;
      }

      const { items, pagination } = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Users retrieved successfully',
        data: items,
        meta: {
          pagination
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tenantId = this.getEffectiveTenantId(req);

      const result = await this.getUserDetailQuery.execute({
        userId: id,
        tenantId
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'USER_NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'User details retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createUserSchema.parse(req.body);
      const tenantId = this.getEffectiveTenantId(req, validated.tenantId) || req.user?.tenantId || 'default';

      const result = await this.createUserUseCase.execute({
        ...validated,
        tenantId
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'USER_CREATION_FAILED', message: result.getError() }]
        });
        return;
      }

      const created = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'User created successfully by back-office administrator',
        data: created
      });
    } catch (err) {
      next(err);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const validated = updateUserSchema.parse(req.body);
      const scopedTenantId = this.getEffectiveTenantId(req);

      const result = await this.updateUserUseCase.execute({
        userId: id,
        scopedTenantId,
        ...validated
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'USER_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'User updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const validated = updateStatusSchema.parse(req.body);
      const scopedTenantId = this.getEffectiveTenantId(req);

      const result = await this.updateStatusUseCase.execute({
        userId: id,
        scopedTenantId,
        isActive: validated.isActive,
        reason: validated.reason,
        callerUserId: req.user?.id
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'STATUS_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: `User ${validated.isActive ? 'activated' : 'suspended'} successfully`,
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const validated = resetPasswordSchema.parse(req.body);
      const scopedTenantId = this.getEffectiveTenantId(req);

      const result = await this.resetPasswordUseCase.execute({
        userId: id,
        scopedTenantId,
        newPassword: validated.newPassword,
        generateRandom: validated.generateRandom
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'PASSWORD_RESET_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Password reset successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const scopedTenantId = this.getEffectiveTenantId(req);

      const result = await this.deleteUserUseCase.execute({
        userId: id,
        scopedTenantId,
        callerUserId: req.user?.id
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'USER_DELETION_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'User deleted successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  listUserSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const scopedTenantId = this.getEffectiveTenantId(req);

      const result = await this.listSessionsQuery.execute({
        userId: id,
        scopedTenantId
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError()
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Active sessions retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  revokeUserSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.id as string;
      const tenantId = this.getEffectiveTenantId(req);
      const validated = revokeSessionsSchema.optional().parse(req.body);
      const reason = validated?.reason || 'All sessions revoked by back-office administrator';

      const result = await this.revokeSessionsUseCase.execute({
        userId,
        tenantId,
        reason
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError()
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Sessions revoked successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  revokeSingleSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params.sessionId as string;
      const validated = revokeSessionsSchema.optional().parse(req.body);
      const reason = validated?.reason || 'Session revoked by back-office administrator';

      const result = await this.revokeSessionsUseCase.execute({
        sessionId,
        reason
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError()
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Session revoked successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  getRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getRolesQuery.execute();
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Role definitions retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  deleteTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idOrSlug = req.params.idOrSlug as string;
      const result = await this.deleteTenantUseCase.execute({ idOrSlug });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'TENANT_DELETION_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Tenant deleted successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
