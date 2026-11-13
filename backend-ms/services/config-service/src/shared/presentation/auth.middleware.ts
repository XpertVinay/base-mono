import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getMultiTenancyConfig, resolveTenantContext } from './tenant.middleware.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  tenantSlug?: string;
  authMethod?: string;
  federatedProvider?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars';
  const providedSecret = req.header('x-internal-secret');
  const mtConfig = getMultiTenancyConfig();

  // Accept forwarded gateway identity headers ONLY if authenticated with the shared internal secret
  if (req.header('x-user-id') && providedSecret === internalSecret) {
    const tenantId = mtConfig.enabled
      ? ((req.header(mtConfig.tenantHeader) || mtConfig.defaultTenantId) as string)
      : mtConfig.defaultTenantId;

    req.user = {
      id: req.header('x-user-id') as string,
      email: (req.header('x-user-email') || '') as string,
      role: (req.header('x-user-role') || 'USER') as string,
      tenantId,
      tenantSlug: req.header(mtConfig.tenantSlugHeader) || undefined,
      authMethod: req.header('x-auth-method') || undefined,
      federatedProvider: req.header('x-federated-provider') || undefined
    };

    req.tenant = resolveTenantContext(req);
    if (req.context) {
      req.context.tenantId = tenantId;
      req.context.tenantSlug = req.user.tenantSlug;
      req.context.tenantVerified = true;
      req.context.authMethod = req.user.authMethod;
    }
    next();
    return;
  }

  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' }
    });
    return;
  }

  const token = authHeader.substring(7);
  const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';

  try {
    const decoded = jwt.verify(token, secret) as any;
    const tokenTenantId = mtConfig.enabled
      ? (decoded.tenantId || decoded.tid || mtConfig.defaultTenantId)
      : mtConfig.defaultTenantId;

    const headerTenantId = req.header(mtConfig.tenantHeader)?.trim();
    if (mtConfig.enabled && headerTenantId && headerTenantId !== tokenTenantId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Requested tenant header does not match authenticated JWT tenant'
        }
      });
      return;
    }

    req.user = {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      role: decoded.role || 'USER',
      tenantId: tokenTenantId,
      tenantSlug: decoded.tenantSlug,
      authMethod: decoded.authMethod || 'LOCAL',
      federatedProvider: decoded.provider
    };

    req.tenant = resolveTenantContext(req);
    if (req.context) {
      req.context.tenantId = tokenTenantId;
      req.context.tenantSlug = decoded.tenantSlug;
      req.context.tenantVerified = true;
      req.context.authMethod = req.user.authMethod;
    }

    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Provided JWT token is expired or invalid' }
    });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions for this resource' }
      });
      return;
    }

    next();
  };
}
