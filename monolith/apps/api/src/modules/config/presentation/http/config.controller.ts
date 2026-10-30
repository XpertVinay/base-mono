import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  GetConfigQuery,
  ListConfigsQuery,
  GetClientConfigsQuery,
  SetConfigUseCase,
  GetConfigCacheStatsQuery,
  InvalidateConfigCacheUseCase,
  GetSectionConfigQuery,
  UpdateSectionConfigUseCase,
  ListSectionsSummaryQuery
} from '../../application/use-cases/config.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';
import { ConfigTarget } from '../../domain/entities/config.entity.js';
import { ConfigSection } from '@monolith/contracts';
import { ValidationError, ForbiddenError } from '../../../../shared/presentation/error-handler.middleware.js';

const setConfigSchema = z.object({
  key: z.string().min(2),
  value: z.string(),
  description: z.string().optional(),
  isEncrypted: z.boolean().optional(),
  target: z.enum(['BACKEND', 'FRONTEND', 'ALL']).optional()
});

const invalidateCacheSchema = z.object({
  key: z.string().optional()
});

import { piiCryptoService } from '../../infrastructure/security/pii-crypto.service.js';

const tenantUuidSchema = z.string().uuid({
  message: 'Tenant ID must be a valid RFC 4122 UUID'
});

function extractAndValidateTenantId(req: Request): string | undefined {
  // 1. Check for encrypted PII tenant context on the fly (header or query parameter)
  const encryptedContext = (req.headers['x-tenant-context'] as string) ||
    (req.headers['x-encrypted-context'] as string) ||
    (req.query.tenantContext as string);

  if (encryptedContext) {
    const decrypted = piiCryptoService.decryptPiiContext(encryptedContext);
    (req as any).tenantContext = decrypted;

    // Cross-tenant boundary check: enforce that non-admin authenticated users match their decrypted tenant
    if (req.user && req.user.role !== 'ADMIN') {
      const userTenantId = (req.user as any).tenantId;
      if (userTenantId && userTenantId !== decrypted.tenantId) {
        throw new ForbiddenError('Cross-tenant violation: Access restricted to authorized tenant');
      }
    }

    return decrypted.tenantId;
  }

  // 2. Fallback to direct tenant identifier (query param or header)
  const rawTenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string);
  if (!rawTenantId) return undefined;

  const validation = tenantUuidSchema.safeParse(rawTenantId);
  if (!validation.success) {
    throw new ValidationError('Invalid tenant identifier: Tenant ID must be a valid RFC 4122 UUID', validation.error.errors);
  }

  // Enforce cross-tenant boundary isolation:
  if (req.user && req.user.role !== 'ADMIN') {
    const userTenantId = (req.user as any).tenantId;
    if (userTenantId && userTenantId !== rawTenantId) {
      throw new ForbiddenError('Cross-tenant violation: Access restricted to authorized tenant');
    }
  }

  return rawTenantId;
}

export class ConfigController {
  constructor(
    private readonly getConfigQuery: GetConfigQuery,
    private readonly listConfigsQuery: ListConfigsQuery,
    private readonly getClientConfigsQuery: GetClientConfigsQuery,
    private readonly setConfigUseCase: SetConfigUseCase,
    private readonly getCacheStatsQuery: GetConfigCacheStatsQuery,
    private readonly invalidateCacheUseCase: InvalidateConfigCacheUseCase,
    private readonly getSectionConfigQuery: GetSectionConfigQuery,
    private readonly updateSectionConfigUseCase: UpdateSectionConfigUseCase,
    private readonly listSectionsSummaryQuery: ListSectionsSummaryQuery
  ) {}

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const target = req.query.target as ConfigTarget | undefined;
      const result = await this.listConfigsQuery.execute(target ? { target } : undefined);
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getClientConfigs = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getClientConfigsQuery.execute();
      if (result.isFailure) return next(result.getError());

      // Set HTTP caching headers for client browsers and CDN proxies
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getCacheStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getCacheStatsQuery.execute();
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  invalidateCache = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = invalidateCacheSchema.parse(req.body || {});
      const result = await this.invalidateCacheUseCase.execute(validated);
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getSectionsSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = extractAndValidateTenantId(req);
      const result = await this.listSectionsSummaryQuery.execute(tenantId ? { tenantId } : undefined);
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getSection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const section = req.params.section as ConfigSection;
      const tenantId = extractAndValidateTenantId(req);
      const result = await this.getSectionConfigQuery.execute({ section, tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  updateSection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const section = req.params.section as ConfigSection;
      const tenantId = extractAndValidateTenantId(req);
      const payload = req.body;
      const result = await this.updateSectionConfigUseCase.execute({ section, payload, tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getByKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.params.key);
      const result = await this.getConfigQuery.execute({ key });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  set = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = setConfigSchema.parse(req.body);
      const result = await this.setConfigUseCase.execute(validated);
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  createContextToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const tenantId = (req.body?.tenantId as string) || (user as any)?.tenantId || '00000000-0000-0000-0000-000000000001';

      // Non-admin can only generate encrypted token for their own tenant
      if (user && user.role !== 'ADMIN' && (user as any).tenantId && (user as any).tenantId !== tenantId) {
        throw new ForbiddenError('Unauthorized: Cannot generate context token for another tenant');
      }

      tenantUuidSchema.parse(tenantId);

      const token = piiCryptoService.encryptPiiContext({
        tenantId,
        userId: user?.id,
        email: user?.email,
        orgId: req.body?.orgId || tenantId,
        roles: user ? [user.role] : ['USER'],
        ttlMs: req.body?.ttlMs
      });

      res.status(200).json({
        success: true,
        data: {
          contextToken: token,
          tenantId,
          expiresInSeconds: 86400
        },
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
