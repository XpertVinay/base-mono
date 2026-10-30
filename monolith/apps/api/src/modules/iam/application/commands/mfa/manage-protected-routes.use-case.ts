import { v4 as uuidv4 } from 'uuid';
import { Result } from '../../../../../shared/domain/result.js';
import { IMfaProtectedRouteRepository, MfaProtectedRoute } from '../../../infrastructure/persistence/mfa-protected-route.repository.js';
import { MfaRouteCache } from '../../../infrastructure/cache/mfa-route.cache.js';
import { MfaProtectedRouteDto, CreateMfaProtectedRouteDto } from '@monolith/contracts';
import { IIamAuditRepository } from '../../../infrastructure/persistence/iam-audit.repository.js';

export class ManageProtectedRoutesUseCase {
  constructor(
    private readonly repository: IMfaProtectedRouteRepository,
    private readonly cache: MfaRouteCache,
    private readonly auditRepository?: IIamAuditRepository
  ) {}

  async listRoutes(): Promise<Result<MfaProtectedRouteDto[], Error>> {
    try {
      const routes = await this.repository.getAll();
      return Result.ok(
        routes.map(r => ({
          id: r.id,
          method: r.method,
          pathPattern: r.pathPattern,
          description: r.description,
          reverificationMode: r.reverificationMode,
          isActive: r.isActive,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString()
        }))
      );
    } catch (err: any) {
      return Result.fail(err);
    }
  }

  async addRoute(
    dto: CreateMfaProtectedRouteDto,
    adminUserId?: string
  ): Promise<Result<MfaProtectedRouteDto, Error>> {
    try {
      const route: MfaProtectedRoute = {
        id: uuidv4(),
        method: dto.method.toUpperCase(),
        pathPattern: dto.pathPattern,
        description: dto.description,
        reverificationMode: dto.reverificationMode || 'SESSION_24H',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.repository.save(route);
      await this.cache.invalidate();

      await this.auditRepository?.log({
        userId: adminUserId,
        eventType: 'IAM_MFA_PROTECTED_ROUTE_CREATED',
        details: { method: route.method, pathPattern: route.pathPattern, reverificationMode: route.reverificationMode },
        status: 'SUCCESS'
      });

      return Result.ok({
        id: route.id,
        method: route.method,
        pathPattern: route.pathPattern,
        description: route.description,
        reverificationMode: route.reverificationMode,
        isActive: route.isActive,
        createdAt: route.createdAt.toISOString(),
        updatedAt: route.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }

  async removeRoute(id: string, adminUserId?: string): Promise<Result<boolean, Error>> {
    try {
      const success = await this.repository.delete(id);
      await this.cache.invalidate();

      await this.auditRepository?.log({
        userId: adminUserId,
        eventType: 'IAM_MFA_PROTECTED_ROUTE_DELETED',
        details: { routeId: id },
        status: 'SUCCESS'
      });

      return Result.ok(success);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

