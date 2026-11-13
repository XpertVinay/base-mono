import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateTenantUseCase,
  GetTenantQuery,
  ListTenantsQuery,
  OnboardTenantUseCase,
  UpdateTenantUseCase
} from '../../application/commands/tenant.use-cases.js';
import { DeleteTenantUseCase } from '../../application/commands/backoffice-user.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';
import { getMultiTenancyConfig } from '../../shared/presentation/tenant.middleware.js';

const tenantConfigSchema = z.object({
  allowLocalLogin: z.boolean().optional(),
  allowFederatedLogin: z.boolean().optional(),
  autoProvisionUsers: z.boolean().optional(),
  defaultRole: z.enum(['USER', 'ADMIN', 'SUPPORT']).optional(),
  allowedEmailDomains: z.array(z.string().min(1)).optional(),
  sessionTtlSeconds: z.number().int().min(60).max(86400).optional()
});

const createTenantSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/).optional(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,99}$/),
  name: z.string().min(2).max(255),
  isActive: z.boolean().optional(),
  config: tenantConfigSchema.optional()
});

const onboardTenantSchema = createTenantSchema.extend({
  adminUser: z
    .object({
      email: z.string().email().max(255),
      password: z.string().min(8).max(128),
      name: z.string().min(2).max(100)
    })
    .optional()
});

const updateTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  isActive: z.boolean().optional(),
  config: tenantConfigSchema.optional()
});

export class TenantController {
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly updateTenantUseCase: UpdateTenantUseCase,
    private readonly getTenantQuery: GetTenantQuery,
    private readonly listTenantsQuery: ListTenantsQuery,
    private readonly onboardTenantUseCase?: OnboardTenantUseCase,
    private readonly deleteTenantUseCase?: DeleteTenantUseCase
  ) {}

  private isPlatformAdmin(req: Request): boolean {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    return req.user?.role === 'ADMIN' && (!req.user.tenantId || req.user.tenantId === defaultTenantId);
  }

  getMultiTenancyStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = getMultiTenancyConfig();
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Multi-tenancy configuration retrieved',
        data: {
          ...config,
          resolvedTenant: req.tenant
        }
      });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listTenantsQuery.execute();
      const allTenants = result.getValue();
      const filtered = this.isPlatformAdmin(req)
        ? allTenants
        : allTenants.filter((t) => t.id === req.user?.tenantId);

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Tenants retrieved successfully',
        data: filtered
      });
    } catch (err) {
      next(err);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idOrSlug = req.params.idOrSlug as string;
      const result = await this.getTenantQuery.execute({ idOrSlug });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'TENANT_NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      const tenant = result.getValue();
      if (!this.isPlatformAdmin(req) && req.user?.tenantId !== tenant.id) {
        ApiResponse.error(res, {
          req,
          statusCode: 403,
          message: 'Access denied for requested tenant',
          errors: [{ code: 'FORBIDDEN', message: 'Cannot inspect a different tenant' }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Tenant retrieved successfully',
        data: tenant
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.isPlatformAdmin(req)) {
        ApiResponse.error(res, {
          req,
          statusCode: 403,
          message: 'Only platform administrators can create tenants',
          errors: [{ code: 'FORBIDDEN', message: 'Platform admin privileges required' }]
        });
        return;
      }

      const validated = createTenantSchema.parse(req.body);
      const result = await this.createTenantUseCase.execute(validated);
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'TENANT_CREATION_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Tenant created successfully',
        data: result.getValue(),
        meta: {
          further_steps: [
            `Configure OIDC providers for this tenant via POST /api/v1/iam/oidc/admin/providers with x-tenant-id: ${result.getValue().id}`
          ]
        }
      });
    } catch (err) {
      next(err);
    }
  };

  onboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.isPlatformAdmin(req)) {
        ApiResponse.error(res, {
          req,
          statusCode: 403,
          message: 'Only platform administrators can onboard tenants',
          errors: [{ code: 'FORBIDDEN', message: 'Platform admin privileges required' }]
        });
        return;
      }
      if (!this.onboardTenantUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Tenant onboarding use case not configured',
          errors: [{ code: 'NOT_IMPLEMENTED', message: 'Onboarding not configured' }]
        });
        return;
      }

      const validated = onboardTenantSchema.parse(req.body);
      const result = await this.onboardTenantUseCase.execute(validated);
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'TENANT_ONBOARDING_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Tenant onboarded successfully with inherited system federation defaults',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idOrSlug = req.params.idOrSlug as string;
      if (!this.isPlatformAdmin(req)) {
        const current = await this.getTenantQuery.execute({ idOrSlug });
        if (current.isSuccess && current.getValue().id !== req.user?.tenantId) {
          ApiResponse.error(res, {
            req,
            statusCode: 403,
            message: 'Access denied for requested tenant',
            errors: [{ code: 'FORBIDDEN', message: 'Cannot update a different tenant' }]
          });
          return;
        }
      }

      const validated = updateTenantSchema.parse(req.body);
      const result = await this.updateTenantUseCase.execute({ idOrSlug, ...validated });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'TENANT_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Tenant updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.deleteTenantUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Tenant deletion not supported in this runtime configuration'
        });
        return;
      }

      if (!this.isPlatformAdmin(req)) {
        ApiResponse.error(res, {
          req,
          statusCode: 403,
          message: 'Only platform administrators can delete tenants',
          errors: [{ code: 'FORBIDDEN', message: 'Platform administrator privileges required' }]
        });
        return;
      }

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
