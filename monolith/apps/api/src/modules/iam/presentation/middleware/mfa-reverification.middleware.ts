import { Request, Response, NextFunction } from 'express';
import { MfaRouteCache } from '../../infrastructure/cache/mfa-route.cache.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { IIamAuditRepository } from '../../infrastructure/persistence/iam-audit.repository.js';
import { TotpService } from '../../domain/services/totp.service.js';
import { authenticate, extractClientContext } from '../../../../shared/presentation/auth.middleware.js';

export function createMfaReverificationMiddleware(
  cache: MfaRouteCache,
  userRepository: IUserRepository,
  auditRepository?: IIamAuditRepository
) {
  const MFA_24H_MS = 24 * 60 * 60 * 1000;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawUrl = req.originalUrl || req.path || '/';
      const fullPath = (rawUrl.split('?')[0] || '/').replace(/\/+$/, '') || '/';
      const matchedRoute = cache.matchRoute(req.method, fullPath);

      // If route is not protected in the cache, proceed immediately
      if (!matchedRoute) {
        return next();
      }

      const activeRoute = matchedRoute;

      // Ensure request has been authenticated first
      if (!req.user) {
        authenticate(req, res, (err) => {
          if (err) return next(err);
          handleMfaCheck();
        });
      } else {
        await handleMfaCheck();
      }

      async function handleMfaCheck() {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Authentication required for sensitive resource'
          });
        }

        const user = await userRepository.findById(req.user.id);
        if (!user || !user.isActive) {
          return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'User account not found or inactive'
          });
        }

        const clientContext = extractClientContext(req);

        // 1. If user does NOT have MFA enabled, block access to sensitive resource
        if (!user.mfaEnabled || !user.mfaSecret) {
          await auditRepository?.log({
            userId: user.id,
            eventType: 'IAM_SENSITIVE_ROUTE_BLOCKED',
            ipAddress: clientContext.ip,
            userAgent: clientContext.userAgent,
            details: {
              path: fullPath,
              method: req.method,
              reason: 'User has not enabled MFA on their account'
            },
            status: 'FAILURE'
          });

          return res.status(403).json({
            success: false,
            error: 'MFA_REQUIRED',
            message: 'Access to this sensitive resource requires Multi-Factor Authentication (MFA) to be enabled on your account.',
            path: fullPath
          });
        }

        // 2. Check for on-the-fly MFA re-authentication via header or body
        const mfaHeaderCode = (req.headers['x-mfa-code'] || req.headers['x-mfa-reauth-code'] || req.body?.code) as string;
        if (mfaHeaderCode) {
          let isValid = TotpService.verifyTotp(mfaHeaderCode, user.mfaSecret);
          let method = 'totp';
          if (!isValid) {
            const hashed = TotpService.hashBackupCode(mfaHeaderCode);
            isValid = user.consumeBackupCode(hashed);
            method = 'backup_code';
          }

          if (isValid) {
            user.recordMfaVerification();
            await userRepository.save(user);
            req.user.mfaVerified = true;
            req.user.mfaVerifiedAt = Date.now();

            await auditRepository?.log({
              userId: user.id,
              eventType: 'IAM_SENSITIVE_ROUTE_MFA_REVERIFIED',
              ipAddress: clientContext.ip,
              userAgent: clientContext.userAgent,
              details: { path: fullPath, method: req.method, factor: method },
              status: 'SUCCESS'
            });

            return next();
          } else {
            await auditRepository?.log({
              userId: user.id,
              eventType: 'IAM_SENSITIVE_ROUTE_MFA_REVERIFY_FAILED',
              ipAddress: clientContext.ip,
              userAgent: clientContext.userAgent,
              details: { path: fullPath, method: req.method, reason: 'Invalid header MFA code' },
              status: 'FAILURE'
            });

            return res.status(403).json({
              success: false,
              error: 'INVALID_MFA_CODE',
              message: 'Invalid MFA verification code supplied for route access.'
            });
          }
        }

        // 3. Evaluate Reverification Mode: EVERY_TIME
        if (activeRoute.reverificationMode === 'EVERY_TIME') {
          await auditRepository?.log({
            userId: user.id,
            eventType: 'IAM_SENSITIVE_ROUTE_BLOCKED',
            ipAddress: clientContext.ip,
            userAgent: clientContext.userAgent,
            details: { path: fullPath, method: req.method, reason: 'Re-authentication with MFA required for every invocation' },
            status: 'FAILURE'
          });

          return res.status(403).json({
            success: false,
            error: 'MFA_REVERIFICATION_REQUIRED',
            message: "This route requires fresh MFA verification for every request. Pass 'x-mfa-code' header or re-verify via POST /api/iam/mfa/reverify.",
            reverificationMode: 'EVERY_TIME',
            path: fullPath
          });
        }

        // 4. Evaluate Reverification Mode: SESSION_24H
        const verifiedAt = req.user.mfaVerifiedAt || user.mfaLastVerifiedAt?.getTime();
        const mfaAge = verifiedAt ? Date.now() - verifiedAt : Infinity;
        const isMfaActive = Boolean((req.user.mfaVerified || user.mfaLastVerifiedAt) && mfaAge <= MFA_24H_MS);

        if (!isMfaActive) {
          await auditRepository?.log({
            userId: user.id,
            eventType: 'IAM_SENSITIVE_ROUTE_BLOCKED',
            ipAddress: clientContext.ip,
            userAgent: clientContext.userAgent,
            details: {
              path: fullPath,
              method: req.method,
              reason: 'MFA 24h verification timeframe has expired',
              mfaAgeHours: verifiedAt ? Math.round(mfaAge / 3600000) : null
            },
            status: 'FAILURE'
          });

          return res.status(403).json({
            success: false,
            error: 'MFA_REVERIFICATION_REQUIRED',
            message: "MFA verification has expired after 24 hours. Re-verification required via POST /api/iam/mfa/reverify or 'x-mfa-code' header.",
            reverificationMode: 'SESSION_24H',
            path: fullPath
          });
        }

        // Valid 24h MFA session
        await auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_SENSITIVE_ROUTE_ALLOWED',
          ipAddress: clientContext.ip,
          userAgent: clientContext.userAgent,
          details: { path: fullPath, method: req.method, mode: 'SESSION_24H', mfaAgeHours: Math.round(mfaAge / 3600000) },
          status: 'SUCCESS'
        });

        return next();
      }
    } catch (err) {
      next(err);
    }
  };
}
