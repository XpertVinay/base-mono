import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getMultiTenancyConfig, resolveTenantContext } from './tenant.middleware.js';

export interface ISsoSessionRevocationChecker {
  isRevoked(sessionId: string): Promise<boolean>;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  tenantSlug?: string;
  authMethod?: string;
  federatedProvider?: string;
  sessionId?: string;
  audience?: string;
  scope?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      federatedProvider: req.header('x-federated-provider') || undefined,
      sessionId: req.header('x-session-id') || undefined
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
    const complete = jwt.decode(token, { complete: true }) as any;
    const alg = complete?.header?.alg;

    let decoded: any;
    if (alg === 'RS256') {
      const pubKey = (process.env.JWT_PUBLIC_KEY || process.env.IAM_JWT_PUBLIC_KEY)?.replace(/\\n/g, '\n');
      if (!pubKey) {
        throw new Error('RS256 public key is not configured');
      }
      decoded = jwt.verify(token, pubKey, { algorithms: ['RS256'] });
    } else if (alg === 'HS256' || !alg) {
      decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } else {
      throw new Error(`Unsupported token algorithm: ${alg}`);
    }

    if (decoded.fgp) {
      const clientFgp = req.header('x-device-fingerprint');
      if (!clientFgp || clientFgp.trim() === '') {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Session hijacking detected: device fingerprint required'
          }
        });
        return;
      }

      const hashedClientFgp = crypto.createHash('sha256').update(clientFgp).digest('hex');
      if (decoded.fgp !== clientFgp && decoded.fgp !== hashedClientFgp) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Session hijacking detected: device fingerprint mismatch'
          }
        });
        return;
      }
    }
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

    const sessionRepo = req.app?.locals?.ssoSessionRepo as ISsoSessionRevocationChecker | undefined;
    if (decoded.sid && sessionRepo) {
      const revoked = await sessionRepo.isRevoked(String(decoded.sid));
      if (revoked) {
        res.status(401).json({
          success: false,
          error: {
            code: 'SESSION_REVOKED',
            message: 'SSO session has been logged out or revoked'
          }
        });
        return;
      }
    }

    req.user = {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      role: decoded.role || 'USER',
      tenantId: tokenTenantId,
      tenantSlug: decoded.tenantSlug,
      authMethod: decoded.authMethod || 'LOCAL',
      federatedProvider: decoded.provider,
      sessionId: decoded.sid,
      audience: decoded.aud,
      scope: decoded.scope
    };

    req.tenant = resolveTenantContext(req);
    if (req.context) {
      req.context.tenantId = tokenTenantId;
      req.context.tenantSlug = decoded.tenantSlug;
      req.context.tenantVerified = true;
      req.context.authMethod = req.user.authMethod;
    }

    next();
  } catch {
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
