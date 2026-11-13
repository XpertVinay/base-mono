import { Router, Request, Response, NextFunction } from 'express';
import { AuditController } from './audit.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';
import { rateLimiter, RateLimitViolationInfo } from '../../shared/presentation/rate-limiter.middleware.js';
import { RecordAuditLogUseCase } from '../../application/use-cases/audit.use-cases.js';
import { logger } from '../../shared/infrastructure/logger.js';

export function createAuditRouter(
  controller: AuditController,
  recordUseCase?: RecordAuditLogUseCase
): Router {
  const router = Router();

  const reportDdosAttack = (req: Request, info: RateLimitViolationInfo) => {
    if (!info.firstViolationInWindow) {
      return;
    }

    const attackDetails = {
      method: req.method,
      path: req.originalUrl || req.path,
      requestCount: info.count,
      limit: info.max,
      windowMs: info.windowMs,
      userAgent: req.header('user-agent') || 'unknown'
    };

    logger.warn('DDoS / Rate-limit breach detected on audit endpoint', {
      ip: info.ip,
      ...attackDetails
    });

    if (recordUseCase) {
      void recordUseCase
        .execute({
          actorEmail: req.user?.email || 'security-monitor@system.internal',
          action: 'DDOS_RATE_LIMIT_BREACH',
          resource: 'AuditServiceGateway',
          severity: 'CRITICAL',
          ipAddress: info.ip,
          correlationId: req.header('x-correlation-id') || req.context?.correlationId,
          details: attackDetails
        })
        .catch((err) => {
          logger.error('Failed to persist DDoS audit incident', err);
        });
    }
  };

  // Dedicated DDoS & burst protection for telemetry reads and event ingestion
  const auditReadRateLimiter = rateLimiter({
    windowMs: 60000,
    max: parseInt(process.env.AUDIT_READ_RATE_LIMIT_MAX || '90', 10),
    message: 'Too many audit telemetry queries detected. Request throttled and reported to security monitor.',
    onLimitExceeded: reportDdosAttack
  });

  const auditIngestRateLimiter = rateLimiter({
    windowMs: 60000,
    max: parseInt(process.env.AUDIT_INGEST_RATE_LIMIT_MAX || '180', 10),
    message: 'Audit ingestion rate limit exceeded. Incident reported to security monitor.',
    onLimitExceeded: reportDdosAttack
  });

  // Security: Audit logs can ONLY be read by authenticated ADMIN/SUPPORT users or internal backend services with shared secret/key
  const requireAuditReadAuth = (req: Request, res: Response, next: NextFunction) => {
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars';
    const providedSecret = req.header('x-internal-secret') || req.header('x-service-key');
    if (providedSecret && providedSecret === internalSecret) {
      return next();
    }
    return requireAuth(req, res, () => requireRole(['ADMIN', 'SUPPORT'])(req, res, next));
  };

  // Security: Remediation actions strictly require ADMIN role (no bypass via standard user headers)
  const requireRemediationAdmin = (req: Request, res: Response, next: NextFunction) => {
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars';
    const providedSecret = req.header('x-internal-secret');
    if (providedSecret && providedSecret === internalSecret && req.header('x-user-role') === 'ADMIN') {
      return next();
    }
    return requireAuth(req, res, () => requireRole(['ADMIN'])(req, res, next));
  };

  // Ingestion: accepts telemetry logs with DDoS throttling
  router.post('/logs', auditIngestRateLimiter, controller.record);

  // Read: Protected by authentication & service keys with DDoS rate limiting
  router.get('/logs', auditReadRateLimiter, requireAuditReadAuth, controller.query);
  router.get('/config', auditReadRateLimiter, controller.getConfig);
  router.get('/alerts', auditReadRateLimiter, requireAuditReadAuth, controller.getAlerts);
  router.get('/metrics/summary', auditReadRateLimiter, controller.getMetricsSummary);
  router.get('/grafana/annotations', auditReadRateLimiter, controller.getAnnotations);

  // Mutating remediation actions strictly require ADMIN
  router.post('/remediate', auditReadRateLimiter, requireRemediationAdmin, controller.executeRemediation);

  return router;
}
