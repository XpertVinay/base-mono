import { Request, Response, NextFunction } from 'express';
import { MultiTenancyConfig, MultiTenancyMode, TenantContext } from '../contracts/index.js';

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

const VALID_TENANT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export function getMultiTenancyConfig(): MultiTenancyConfig {
  const enabled = process.env.MULTI_TENANCY_ENABLED !== 'false';
  const rawMode = (process.env.MULTI_TENANCY_MODE || 'optional').toLowerCase();
  const mode: MultiTenancyMode = !enabled
    ? 'disabled'
    : rawMode === 'strict' || rawMode === 'disabled'
      ? (rawMode as MultiTenancyMode)
      : 'optional';

  return {
    enabled,
    mode,
    defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
    tenantHeader: (process.env.TENANT_HEADER || 'x-tenant-id').toLowerCase(),
    tenantSlugHeader: (process.env.TENANT_SLUG_HEADER || 'x-tenant-slug').toLowerCase(),
    subdomainEnabled: process.env.TENANT_SUBDOMAIN_ENABLED === 'true'
  };
}

function extractSubdomainTenant(req: Request): string | undefined {
  const host = req.hostname || req.header('host')?.split(':')[0];
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return undefined;
  }
  const parts = host.split('.');
  if (parts.length >= 3 && parts[0] && parts[0] !== 'www' && parts[0] !== 'api') {
    return parts[0];
  }
  return undefined;
}

export function resolveTenantContext(req: Request, overrideMode?: MultiTenancyMode): TenantContext {
  const cfg = getMultiTenancyConfig();
  const mode = cfg.enabled ? (overrideMode || cfg.mode) : 'disabled';

  if (mode === 'disabled') {
    return {
      tenantId: cfg.defaultTenantId,
      tenantSlug: cfg.defaultTenantId,
      source: 'default',
      isDefault: true,
      verified: true,
      multiTenancyEnabled: false,
      mode: 'disabled'
    };
  }

  const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars';
  const isTrustedGateway = req.header('x-internal-secret') === internalSecret && req.header('x-tenant-verified') === 'true';

  const headerTenantId = req.header(cfg.tenantHeader)?.trim();
  const headerTenantSlug = req.header(cfg.tenantSlugHeader)?.trim();
  const queryTenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId.trim() : undefined;
  const queryTenantSlug = typeof req.query.tenantSlug === 'string' ? req.query.tenantSlug.trim() : undefined;

  if (req.user?.tenantId) {
    return {
      tenantId: req.user.tenantId,
      tenantSlug: req.user.tenantSlug || headerTenantSlug,
      source: 'jwt',
      isDefault: req.user.tenantId === cfg.defaultTenantId,
      verified: true,
      multiTenancyEnabled: cfg.enabled,
      mode
    };
  }

  if (isTrustedGateway && headerTenantId && VALID_TENANT_ID_RE.test(headerTenantId)) {
    return {
      tenantId: headerTenantId,
      tenantSlug: headerTenantSlug,
      source: 'gateway',
      isDefault: headerTenantId === cfg.defaultTenantId,
      verified: true,
      multiTenancyEnabled: cfg.enabled,
      mode
    };
  }

  if (headerTenantId && VALID_TENANT_ID_RE.test(headerTenantId)) {
    return {
      tenantId: headerTenantId,
      tenantSlug: headerTenantSlug,
      source: 'header',
      isDefault: headerTenantId === cfg.defaultTenantId,
      verified: false,
      multiTenancyEnabled: cfg.enabled,
      mode
    };
  }

  if (queryTenantId && VALID_TENANT_ID_RE.test(queryTenantId)) {
    return {
      tenantId: queryTenantId,
      tenantSlug: queryTenantSlug || headerTenantSlug,
      source: 'query',
      isDefault: queryTenantId === cfg.defaultTenantId,
      verified: false,
      multiTenancyEnabled: cfg.enabled,
      mode
    };
  }

  if (headerTenantSlug || queryTenantSlug) {
    const slug = queryTenantSlug || headerTenantSlug;
    return {
      tenantId: cfg.defaultTenantId,
      tenantSlug: slug,
      source: headerTenantSlug ? 'header' : 'query',
      isDefault: !slug || slug === cfg.defaultTenantId,
      verified: false,
      multiTenancyEnabled: cfg.enabled,
      mode
    };
  }

  if (cfg.subdomainEnabled) {
    const sub = extractSubdomainTenant(req);
    if (sub && VALID_TENANT_ID_RE.test(sub)) {
      return {
        tenantId: cfg.defaultTenantId,
        tenantSlug: sub,
        source: 'subdomain',
        isDefault: false,
        verified: false,
        multiTenancyEnabled: cfg.enabled,
        mode
      };
    }
  }

  return {
    tenantId: cfg.defaultTenantId,
    tenantSlug: cfg.defaultTenantId,
    source: 'default',
    isDefault: true,
    verified: false,
    multiTenancyEnabled: cfg.enabled,
    mode
  };
}

export function tenantContextMiddleware(options?: { mode?: MultiTenancyMode }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const cfg = getMultiTenancyConfig();
    const headerTenantId = req.header(cfg.tenantHeader)?.trim();

    if (headerTenantId && !VALID_TENANT_ID_RE.test(headerTenantId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TENANT_HEADER',
          message: `Malformed ${cfg.tenantHeader} header`
        }
      });
      return;
    }

    const tenantCtx = resolveTenantContext(req, options?.mode);

    if (
      tenantCtx.multiTenancyEnabled &&
      req.user?.tenantId &&
      headerTenantId &&
      headerTenantId !== req.user.tenantId
    ) {
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Requested tenant header does not match authenticated tenant context'
        }
      });
      return;
    }

    req.tenant = tenantCtx;
    if (req.context) {
      req.context.tenantId = tenantCtx.tenantId;
      req.context.tenantSlug = tenantCtx.tenantSlug;
      req.context.tenantVerified = tenantCtx.verified;
    }

    res.setHeader('x-tenant-id', tenantCtx.tenantId);
    if (tenantCtx.tenantSlug) {
      res.setHeader('x-tenant-slug', tenantCtx.tenantSlug);
    }

    next();
  };
}

