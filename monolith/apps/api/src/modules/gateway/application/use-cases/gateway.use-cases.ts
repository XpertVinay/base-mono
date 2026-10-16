import { IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { ServiceHealthDto, ApiRouteInfoDto } from '@monolith/contracts';

export class GetGatewayHealthQuery implements IQuery<void, ServiceHealthDto> {
  async execute(): Promise<Result<ServiceHealthDto, Error>> {
    try {
      const dbHealth = await dbPool.checkHealth();
      const isUp = dbHealth.status === 'UP';

      const health: ServiceHealthDto = {
        status: isUp ? 'UP' : 'DEGRADED',
        version: '1.0.0',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            status: dbHealth.status,
            message: dbHealth.error || 'PostgreSQL connected and responsive',
            responseTimeMs: dbHealth.latencyMs
          },
          memory: {
            status: 'UP',
            message: `RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB, Heap: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
          }
        }
      };

      return Result.ok(health);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetGatewayRoutesQuery implements IQuery<void, ApiRouteInfoDto[]> {
  async execute(): Promise<Result<ApiRouteInfoDto[], Error>> {
    const routes: ApiRouteInfoDto[] = [
      { module: 'IAM', prefix: '/api/iam', status: 'ACTIVE' },
      { module: 'Asset', prefix: '/api/assets', status: 'ACTIVE' },
      { module: 'Config', prefix: '/api/config', status: 'ACTIVE' },
      { module: 'Notification', prefix: '/api/notifications', status: 'ACTIVE' },
      { module: 'Scheduler', prefix: '/api/scheduler', status: 'ACTIVE' },
      { module: 'Order', prefix: '/api/orders', status: 'ACTIVE' },
      { module: 'Transaction', prefix: '/api/transactions', status: 'ACTIVE' },
      { module: 'Search', prefix: '/api/search', status: 'ACTIVE' },
      { module: 'Inventory', prefix: '/api/inventory', status: 'ACTIVE' },
      { module: 'Gateway', prefix: '/api/gateway', status: 'ACTIVE' }
    ];
    return Result.ok(routes);
  }
}
