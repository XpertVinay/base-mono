import { Request, Response, NextFunction } from 'express';
import { ValidateTenantContextQuery } from '../../application/queries/organization/validate-tenant-context.query.js';
import { UnauthorizedError, ForbiddenError } from '../../../../shared/presentation/error-handler.middleware.js';
import { UserOrganizationContextDto } from '@monolith/contracts';

declare global {
  namespace Express {
    interface Request {
      tenantContext?: UserOrganizationContextDto;
    }
  }
}

export function createTenantContextMiddleware(validateTenantContextQuery: ValidateTenantContextQuery) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required to resolve tenant organization context'));
    }

    const orgId = (
      req.params.orgId ||
      req.params.organizationId ||
      req.headers['x-tenant-id'] ||
      req.headers['x-organization-id'] ||
      req.body?.organizationId ||
      req.body?.tenantId
    ) as string;

    if (!orgId) {
      // No tenant specified, proceed without bound context
      return next();
    }

    try {
      const context = await validateTenantContextQuery.execute(req.user.id, orgId);
      req.tenantContext = context;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireTenantMembership(validateTenantContextQuery: ValidateTenantContextQuery) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const orgId = (
      req.headers['x-tenant-id'] ||
      req.headers['x-organization-id'] ||
      req.params.orgId ||
      req.params.organizationId ||
      req.body?.organizationId ||
      req.body?.tenantId ||
      req.user?.tenantId ||
      req.params.id
    ) as string;

    if (!orgId) {
      return next(new ForbiddenError('Missing organization identifier (X-Tenant-ID header or URL param required)'));
    }

    try {
      const context = await validateTenantContextQuery.execute(req.user.id, orgId);
      req.tenantContext = context;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireOrgAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenantContext) {
    return next(new ForbiddenError('Organization context not resolved'));
  }

  if (!req.tenantContext.isAdmin) {
    return next(new ForbiddenError('Organization administrator privileges required'));
  }

  next();
}

