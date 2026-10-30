import { Request, Response, NextFunction, RequestHandler } from 'express';
import { PlatformPermission } from '@monolith/contracts';
import { EvaluatePermissionQuery } from '../../application/queries/rbac/evaluate-permission.query.js';
import { ValidateTenantContextQuery } from '../../application/queries/organization/validate-tenant-context.query.js';
import { UnauthorizedError, ForbiddenError } from '../../../../shared/presentation/error-handler.middleware.js';

export function createRequirePermissionMiddleware(
  evaluatePermissionQuery: EvaluatePermissionQuery,
  validateTenantContextQuery?: ValidateTenantContextQuery
) {
  return (...requiredPermissions: PlatformPermission[]): RequestHandler => {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      // 1. User must be authenticated
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      // 2. Global platform administrator bypasses tenant permission checks
      if (req.user.role === 'ADMIN') {
        return next();
      }

      // 3. Resolve organization ID from context, headers, URL params, or body
      const orgId = (
        req.tenantContext?.activeOrganization?.id ||
        req.params?.orgId ||
        req.params?.organizationId ||
        req.params?.id ||
        (req.headers ? (req.headers['x-tenant-id'] || req.headers['x-organization-id']) : undefined) ||
        req.body?.organizationId ||
        req.body?.tenantId
      ) as string;

      if (!orgId) {
        return next(new ForbiddenError('Missing organization identifier (X-Tenant-ID header or URL param required)'));
      }

      // 4. Resolve tenant context if not already set
      if (!req.tenantContext && validateTenantContextQuery) {
        try {
          req.tenantContext = await validateTenantContextQuery.execute(req.user.id, orgId);
        } catch (err) {
          return next(err);
        }
      }

      // 5. Suspended member check
      if (req.tenantContext?.membership?.status === 'SUSPENDED') {
        return next(new ForbiddenError('User membership is suspended in this organization'));
      }

      // 6. Owner invariant: Primary organization owner satisfies all permissions
      if (req.tenantContext?.isOwner) {
        return next();
      }

      // 7. Evaluate effective permissions
      try {
        const effective = await evaluatePermissionQuery.execute(req.user.id, orgId);

        if (effective.isOwner) {
          return next();
        }

        // Suspended or inactive memberships resolve to 0 permissions
        const userPerms = new Set(effective.permissions);
        const missing = requiredPermissions.filter(p => !userPerms.has(p));

        if (missing.length > 0) {
          return next(new ForbiddenError(`Missing required permission(s): ${missing.join(', ')}`));
        }

        next();
      } catch (err) {
        next(err);
      }
    };
  };
}

export function requirePermission(
  evaluatePermissionQuery: EvaluatePermissionQuery,
  ...permissions: PlatformPermission[]
): RequestHandler {
  return createRequirePermissionMiddleware(evaluatePermissionQuery)(...permissions);
}

export const requirePermissions = requirePermission;
