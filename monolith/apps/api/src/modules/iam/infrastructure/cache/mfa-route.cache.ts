import { IMfaProtectedRouteRepository, MfaProtectedRoute } from '../persistence/mfa-protected-route.repository.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class MfaRouteCache {
  private cachedRoutes: MfaProtectedRoute[] = [];
  private isWarmedUp = false;

  constructor(private readonly repository: IMfaProtectedRouteRepository) { }

  public async warmUp(): Promise<void> {
    try {
      this.cachedRoutes = await this.repository.getAllActive();
      this.isWarmedUp = true;
      logger.info('MfaRouteCache warmed up with database routes', { count: this.cachedRoutes.length });
    } catch (err) {
      logger.error('Failed to warm up MfaRouteCache', err);
    }
  }

  public async invalidate(): Promise<void> {
    await this.warmUp();
  }

  public getRoutes(): MfaProtectedRoute[] {
    return [...this.cachedRoutes];
  }

  public matchRoute(method: string, requestPath: string): MfaProtectedRoute | null {
    if (!this.isWarmedUp && this.cachedRoutes.length === 0) {
      // Lazy warm up sync fallback if not yet initialized
      this.cachedRoutes = [
        {
          id: 'mfa-route-sensitive-op',
          method: '*',
          pathPattern: '/api/iam/mfa/sensitive-operation',
          description: 'High-security operation requiring active 24h MFA verification',
          reverificationMode: 'SESSION_24H',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'mfa-route-strict-action',
          method: '*',
          pathPattern: '/api/iam/mfa/strict-action',
          description: 'Critical administrative action requiring immediate MFA re-authentication every time',
          reverificationMode: 'EVERY_TIME',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'mfa-route-pwd',
          method: 'POST',
          pathPattern: '/api/iam/me/password',
          description: 'Credential and password alteration',
          reverificationMode: 'EVERY_TIME',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'mfa-route-mfa-disable',
          method: 'POST',
          pathPattern: '/api/iam/mfa/disable',
          description: 'MFA deactivation requires immediate re-authentication',
          reverificationMode: 'EVERY_TIME',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    }

    const upperMethod = method.toUpperCase();
    const cleanPath = (requestPath.split('?')[0] || '').replace(/\/+$/, '') || '/';

    for (const route of this.cachedRoutes) {
      if (!route.isActive) continue;

      // 1. Method check
      const routeMethod = route.method.toUpperCase();
      if (routeMethod !== '*' && routeMethod !== upperMethod) {
        continue;
      }

      // 2. Path pattern check
      const pattern = route.pathPattern.replace(/\/+$/, '') || '/';

      if (pattern === cleanPath) {
        return route;
      }

      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        if (cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)) {
          return route;
        }
      } else if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (cleanPath.startsWith(prefix)) {
          return route;
        }
      }
    }

    return null;
  }
}
