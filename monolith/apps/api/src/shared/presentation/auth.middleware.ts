import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { securityConfig } from '../../config/security.js';
import { UnauthorizedError, ForbiddenError } from './error-handler.middleware.js';
import { UserRole } from '@monolith/contracts';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, securityConfig.jwt.secret) as AuthenticatedUser;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired authentication token'));
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
