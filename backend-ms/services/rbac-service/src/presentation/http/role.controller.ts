import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateRoleUseCase,
  GetRoleByIdQuery,
  ListRolesQuery,
  UpdateRoleUseCase,
  DeleteRoleUseCase
} from '../../application/use-cases/role.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional()
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  permissions: z.array(z.string()).optional()
});

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string())
});

export class RoleController {
  constructor(
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly getRoleByIdQuery: GetRoleByIdQuery,
    private readonly listRolesQuery: ListRolesQuery,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const isSystem = req.query.isSystem !== undefined ? req.query.isSystem === 'true' : undefined;

      const result = await this.listRolesQuery.execute(tenantId, {
        page,
        limit,
        search,
        isSystem
      });

      const totalPages = Math.ceil(result.total / limit) || 1;

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Roles retrieved successfully',
        data: result.items.map(r => r.toJSON()),
        meta: {
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const role = await this.getRoleByIdQuery.execute(tenantId, id);
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Role retrieved successfully',
        data: role.toJSON()
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const body = createRoleSchema.parse(req.body);

      const role = await this.createRoleUseCase.execute({
        tenantId,
        name: body.name,
        description: body.description,
        permissions: body.permissions
      });

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: `Role '${role.name}' created successfully`,
        data: role.toJSON()
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const body = updateRoleSchema.parse(req.body);

      const role = await this.updateRoleUseCase.execute({
        tenantId,
        id,
        name: body.name,
        description: body.description,
        permissions: body.permissions
      });

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: `Role '${role.name}' updated successfully`,
        data: role.toJSON()
      });
    } catch (err) {
      next(err);
    }
  };

  updatePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const body = updateRolePermissionsSchema.parse(req.body);

      const role = await this.updateRoleUseCase.execute({
        tenantId,
        id,
        permissions: body.permissions
      });

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: `Permissions for role '${role.name}' updated successfully`,
        data: role.toJSON()
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      await this.deleteRoleUseCase.execute(tenantId, id);

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: `Role '${id}' deleted successfully`,
        data: { id, deleted: true }
      });
    } catch (err) {
      next(err);
    }
  };
}
