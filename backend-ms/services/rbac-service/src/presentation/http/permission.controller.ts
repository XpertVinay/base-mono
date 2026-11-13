import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ListPermissionsQuery,
  ListPermissionCategoriesQuery,
  GetPermissionByIdQuery,
  CreatePermissionUseCase,
  UpdatePermissionUseCase,
  DeletePermissionUseCase
} from '../../application/use-cases/permission.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

export const createPermissionSchema = z.object({
  name: z.string().min(1, 'Permission name is required').max(100),
  category: z.string().min(1, 'Category is required').max(64),
  description: z.string().max(500).optional()
});

export const updatePermissionSchema = z.object({
  category: z.string().min(1).max(64).optional(),
  description: z.string().max(500).nullable().optional()
});

export class PermissionController {
  constructor(
    private readonly listPermissionsQuery: ListPermissionsQuery,
    private readonly listPermissionCategoriesQuery: ListPermissionCategoriesQuery,
    private readonly getPermissionByIdQuery: GetPermissionByIdQuery,
    private readonly createPermissionUseCase: CreatePermissionUseCase,
    private readonly updatePermissionUseCase: UpdatePermissionUseCase,
    private readonly deletePermissionUseCase: DeletePermissionUseCase
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = req.query.category as string | undefined;
      const items = await this.listPermissionsQuery.execute(category);

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Permissions retrieved successfully',
        data: items.map(p => p.toJSON()),
        meta: {
          total: items.length
        }
      });
    } catch (err) {
      next(err);
    }
  };

  categories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.listPermissionCategoriesQuery.execute();
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Permission categories retrieved successfully',
        data: categories
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const permission = await this.getPermissionByIdQuery.execute(id);
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Permission retrieved successfully',
        data: permission.toJSON()
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createPermissionSchema.parse(req.body);
      const perm = await this.createPermissionUseCase.execute({
        name: body.name,
        category: body.category,
        description: body.description
      });

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: `Permission '${perm.name}' created successfully`,
        data: perm.toJSON()
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const body = updatePermissionSchema.parse(req.body);
      const perm = await this.updatePermissionUseCase.execute({
        id,
        category: body.category,
        description: body.description
      });

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: `Permission '${perm.name}' updated successfully`,
        data: perm.toJSON()
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.deletePermissionUseCase.execute(id);
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: `Permission '${id}' deleted successfully`,
        data: { id, deleted: true }
      });
    } catch (err) {
      next(err);
    }
  };
}
