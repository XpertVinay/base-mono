import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  AssignRoleToUserUseCase,
  RevokeRoleFromUserUseCase,
  GetUserRolesQuery,
  ListRoleUsersQuery,
  CheckUserPermissionQuery
} from '../../application/use-cases/assignment.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

export const assignRoleSchema = z.object({
  roleId: z.string().min(1, 'Role ID is required')
});

export const checkPermissionSchema = z.object({
  permission: z.string().min(1, 'Permission string is required')
});

export class AssignmentController {
  constructor(
    private readonly assignRoleUseCase: AssignRoleToUserUseCase,
    private readonly revokeRoleUseCase: RevokeRoleFromUserUseCase,
    private readonly getUserRolesQuery: GetUserRolesQuery,
    private readonly listRoleUsersQuery: ListRoleUsersQuery,
    private readonly checkUserPermissionQuery: CheckUserPermissionQuery
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const userId = req.params.userId as string;
      const body = assignRoleSchema.parse(req.body);
      const assignedBy = req.user?.id || null;

      const assignment = await this.assignRoleUseCase.execute({
        tenantId,
        userId,
        roleId: body.roleId,
        assignedBy
      });

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: `Role assigned successfully to user '${userId}'`,
        data: assignment.toJSON()
      });
    } catch (err) {
      next(err);
    }
  };

  revokeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const userId = req.params.userId as string;
      const roleId = req.params.roleId as string;

      await this.revokeRoleUseCase.execute(tenantId, userId, roleId);

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: `Role '${roleId}' revoked successfully from user '${userId}'`,
        data: { userId, roleId, revoked: true }
      });
    } catch (err) {
      next(err);
    }
  };

  getUserRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const userId = req.params.userId as string;

      const assignments = await this.getUserRolesQuery.execute(tenantId, userId);

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'User roles retrieved successfully',
        data: assignments.map(a => a.toJSON())
      });
    } catch (err) {
      next(err);
    }
  };

  getUserPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const userId = req.params.userId as string;

      const result = await this.checkUserPermissionQuery.execute(tenantId, userId, '*');

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'User permissions retrieved successfully',
        data: {
          userId,
          tenantId,
          roles: result.userRoles,
          permissions: result.permissions
        }
      });
    } catch (err) {
      next(err);
    }
  };

  checkPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const userId = req.params.userId as string;
      const permission = (req.query.permission as string) || req.body?.permission;

      if (!permission) {
        ApiResponse.success(res, {
          req,
          statusCode: 400,
          message: 'Permission query parameter or body field is required'
        });
        return;
      }

      const result = await this.checkUserPermissionQuery.execute(tenantId, userId, permission);

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: result.allowed ? 'Permission granted' : 'Permission denied',
        data: result
      });
    } catch (err) {
      next(err);
    }
  };

  getRoleUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const roleId = req.params.id as string;

      const assignments = await this.listRoleUsersQuery.execute(tenantId, roleId);

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Users for role retrieved successfully',
        data: assignments.map(a => a.toJSON())
      });
    } catch (err) {
      next(err);
    }
  };
}
