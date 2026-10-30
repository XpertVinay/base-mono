import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { securityConfig } from '../../config/security.js';
import { tokenService, ClientContext } from '../infrastructure/token.service.js';
import { UnauthorizedError, ForbiddenError } from './error-handler.middleware.js';
import { UserRole } from '@monolith/contracts';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  mfaVerified?: boolean;
  mfaVerifiedAt?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function extractClientContext(req: Request): ClientContext {
  const forwardedFor = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
  const ip = forwardedFor || req.socket.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'];
  const deviceFingerprint = (req.headers['x-device-fingerprint'] || req.headers['x-client-fingerprint']) as string;
  const tenantId = (req.headers['x-tenant-id'] || req.headers['x-tenant-slug']) as string;
  return {
    userAgent,
    ip,
    deviceFingerprint,
    tenantId: tenantId ? tenantId.trim() : undefined
  };
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    // Hardened Web Cookie extraction fallback (e.g. auth_token=... or accessToken=...)
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split('=');
      if ((name === 'auth_token' || name === 'accessToken') && val) {
        token = decodeURIComponent(val);
        break;
      }
    }
  }

  if (!token) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const clientContext = extractClientContext(req);

  try {
    // 1. Hardened Encrypted Token (AES-256-GCM with Device/Client Fingerprint Binding)
    if (token.startsWith('enc.')) {
      const verified = tokenService.verifyAccessToken(token, clientContext);
      req.user = {
        id: verified.id,
        email: verified.email,
        role: verified.role,
        tenantId: verified.tenantId || clientContext.tenantId,
        mfaVerified: verified.mfaVerified,
        mfaVerifiedAt: verified.mfaVerifiedAt
      };
      return next();
    }

    // 2. Asymmetric RS256 Token (Decoupled Multi-Tenant / Microservice / OIDC verification)
    const decodedHeader = jwt.decode(token, { complete: true }) as any;
    if (decodedHeader?.header?.alg === 'RS256') {
      const verified = tokenService.verifyAsymmetricToken(token, clientContext);
      req.user = {
        id: verified.id,
        email: verified.email,
        role: verified.role,
        tenantId: verified.tenantId || clientContext.tenantId,
        mfaVerified: verified.mfaVerified,
        mfaVerifiedAt: verified.mfaVerifiedAt
      };
      return next();
    }

    // 3. Fallback to standard signed JWT (backward compatibility for legacy services/fixtures)
    const decoded = jwt.verify(token, securityConfig.jwt.secret) as any;
    if (decoded.fgp) {
      const expectedFgp = tokenService.generateFingerprint(clientContext);
      if (decoded.fgp !== expectedFgp) {
        throw new UnauthorizedError(
          'Session hijacking detected: Token cannot be used from a different device, client, or browser session'
        );
      }
    }

    req.user = {
      id: decoded.id || decoded.sub,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenant_id || decoded.tenantId || clientContext.tenantId,
      mfaVerified: decoded.mfa_verified ?? decoded.mfaVerified ?? false,
      mfaVerifiedAt: decoded.mfa_verified_at ?? decoded.mfaVerifiedAt
    };
    next();
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      next(new UnauthorizedError('Invalid or expired authentication token'));
    }
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('User authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError(`Access restricted to roles: ${allowedRoles.join(', ')}`));
      return;
    }

    next();
  };
}
