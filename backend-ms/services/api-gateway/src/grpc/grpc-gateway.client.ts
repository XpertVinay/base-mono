import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ServiceKey =
  | 'iam'
  | 'assets'
  | 'config'
  | 'notifications'
  | 'scheduler'
  | 'orders'
  | 'transactions'
  | 'search'
  | 'inventory'
  | 'ai'
  | 'audit'
  | 'organizations'
  | 'rbac';

export interface GrpcServiceDefinition {
  key: ServiceKey;
  serviceName: string;
  envVar: string;
  defaultTarget: string;
  protoFile: string;
  packageName: string;
  grpcServiceName: string;
  routePrefix: string;
}

export const GRPC_SERVICE_DEFINITIONS: Record<ServiceKey, GrpcServiceDefinition> = {
  iam: {
    key: 'iam',
    serviceName: 'iam-service',
    envVar: 'IAM_GRPC_URL',
    defaultTarget: 'localhost:50051',
    protoFile: 'iam.proto',
    packageName: 'iam',
    grpcServiceName: 'IAMService',
    routePrefix: '/api/v1/iam'
  },
  assets: {
    key: 'assets',
    serviceName: 'asset-service',
    envVar: 'ASSET_GRPC_URL',
    defaultTarget: 'localhost:50052',
    protoFile: 'asset.proto',
    packageName: 'asset',
    grpcServiceName: 'AssetService',
    routePrefix: '/api/v1/assets'
  },
  config: {
    key: 'config',
    serviceName: 'config-service',
    envVar: 'CONFIG_GRPC_URL',
    defaultTarget: 'localhost:50053',
    protoFile: 'config.proto',
    packageName: 'config',
    grpcServiceName: 'ConfigService',
    routePrefix: '/api/v1/config'
  },
  notifications: {
    key: 'notifications',
    serviceName: 'notification-service',
    envVar: 'NOTIFICATION_GRPC_URL',
    defaultTarget: 'localhost:50054',
    protoFile: 'notification.proto',
    packageName: 'notification',
    grpcServiceName: 'NotificationService',
    routePrefix: '/api/v1/notifications'
  },
  scheduler: {
    key: 'scheduler',
    serviceName: 'scheduler-service',
    envVar: 'SCHEDULER_GRPC_URL',
    defaultTarget: 'localhost:50055',
    protoFile: 'scheduler.proto',
    packageName: 'scheduler',
    grpcServiceName: 'SchedulerService',
    routePrefix: '/api/v1/scheduler'
  },
  orders: {
    key: 'orders',
    serviceName: 'order-service',
    envVar: 'ORDER_GRPC_URL',
    defaultTarget: 'localhost:50056',
    protoFile: 'order.proto',
    packageName: 'order',
    grpcServiceName: 'OrderService',
    routePrefix: '/api/v1/orders'
  },
  transactions: {
    key: 'transactions',
    serviceName: 'transaction-service',
    envVar: 'TRANSACTION_GRPC_URL',
    defaultTarget: 'localhost:50057',
    protoFile: 'transaction.proto',
    packageName: 'transaction',
    grpcServiceName: 'TransactionService',
    routePrefix: '/api/v1/transactions'
  },
  search: {
    key: 'search',
    serviceName: 'search-service',
    envVar: 'SEARCH_GRPC_URL',
    defaultTarget: 'localhost:50058',
    protoFile: 'search.proto',
    packageName: 'search',
    grpcServiceName: 'SearchService',
    routePrefix: '/api/v1/search'
  },
  inventory: {
    key: 'inventory',
    serviceName: 'inventory-service',
    envVar: 'INVENTORY_GRPC_URL',
    defaultTarget: 'localhost:50059',
    protoFile: 'inventory.proto',
    packageName: 'inventory',
    grpcServiceName: 'InventoryService',
    routePrefix: '/api/v1/inventory'
  },
  ai: {
    key: 'ai',
    serviceName: 'ai-service',
    envVar: 'AI_GRPC_URL',
    defaultTarget: 'localhost:50060',
    protoFile: 'ai.proto',
    packageName: 'ai',
    grpcServiceName: 'AIService',
    routePrefix: '/api/v1/ai'
  },
  audit: {
    key: 'audit',
    serviceName: 'audit-service',
    envVar: 'AUDIT_GRPC_URL',
    defaultTarget: 'localhost:50061',
    protoFile: 'audit.proto',
    packageName: 'audit',
    grpcServiceName: 'AuditService',
    routePrefix: '/api/v1/audit'
  },
  organizations: {
    key: 'organizations',
    serviceName: 'organization-service',
    envVar: 'ORGANIZATION_GRPC_URL',
    defaultTarget: 'localhost:50062',
    protoFile: 'organization.proto',
    packageName: 'organization',
    grpcServiceName: 'OrganizationService',
    routePrefix: '/api/v1/organizations'
  },
  rbac: {
    key: 'rbac',
    serviceName: 'rbac-service',
    envVar: 'RBAC_GRPC_URL',
    defaultTarget: 'localhost:50063',
    protoFile: 'rbac.proto',
    packageName: 'rbac',
    grpcServiceName: 'RbacService',
    routePrefix: '/api/v1/rbac'
  }
};

export interface DispatchRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Buffer;
  clientIp: string;
  correlationId: string;
}

export interface DispatchResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
}

export interface GrpcHealthResult {
  status: 'UP' | 'DEGRADED' | 'DOWN';
  latencyMs: number;
  protocol: 'grpc';
  target: string;
  service?: string;
  uptimeSeconds?: number;
  error?: string;
}

const CHANNEL_OPTIONS: grpc.ChannelOptions = {
  'grpc.keepalive_time_ms': 10000,
  'grpc.keepalive_timeout_ms': 5000,
  'grpc.keepalive_permit_without_calls': 1,
  'grpc.http2.max_pings_without_data': 0,
  'grpc.max_receive_message_length': 16 * 1024 * 1024,
  'grpc.max_send_message_length': 16 * 1024 * 1024
};

export class GrpcGatewayClientManager {
  private readonly clients = new Map<ServiceKey, any>();
  private readonly targets = new Map<ServiceKey, string>();
  private readonly protoDir: string;

  constructor(targetOverrides?: Partial<Record<ServiceKey, string>>) {
    this.protoDir = path.resolve(__dirname, '../proto');

    for (const def of Object.values(GRPC_SERVICE_DEFINITIONS)) {
      let target = targetOverrides?.[def.key] || process.env[def.envVar];
      if (!target) {
        // Fallback: If HTTP service URL is defined (e.g. IAM_SERVICE_URL="http://iam-service:4001"), extract container hostname
        const legacyServiceUrl = process.env[`${def.key.toUpperCase()}_SERVICE_URL`];
        if (legacyServiceUrl) {
          try {
            const urlObj = new URL(legacyServiceUrl);
            if (urlObj.hostname && urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
              const defaultPort = def.defaultTarget.split(':')[1] || '50051';
              target = `${urlObj.hostname}:${defaultPort}`;
            }
          } catch {
            // ignore invalid URL string
          }
        }
      }
      if (!target) {
        target = def.defaultTarget;
      }
      this.targets.set(def.key, target);

      const protoPath = path.join(this.protoDir, def.protoFile);
      const packageDef = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
      const descriptor = grpc.loadPackageDefinition(packageDef) as any;
      const ServiceCtor = descriptor[def.packageName][def.grpcServiceName];
      const client = new ServiceCtor(target, grpc.credentials.createInsecure(), CHANNEL_OPTIONS);
      this.clients.set(def.key, client);
    }
  }

  getTarget(key: ServiceKey): string {
    return this.targets.get(key) || GRPC_SERVICE_DEFINITIONS[key].defaultTarget;
  }

  getServiceMap(): Record<ServiceKey, { service: string; grpcTarget: string; routePrefix: string; grpcService: string }> {
    const result = {} as Record<ServiceKey, { service: string; grpcTarget: string; routePrefix: string; grpcService: string }>;
    for (const def of Object.values(GRPC_SERVICE_DEFINITIONS)) {
      result[def.key] = {
        service: def.serviceName,
        grpcTarget: this.getTarget(def.key),
        routePrefix: def.routePrefix,
        grpcService: `${def.packageName}.${def.grpcServiceName}`
      };
    }
    return result;
  }

  dispatch(
    key: ServiceKey,
    request: DispatchRequest,
    metadataEntries?: Record<string, string>,
    timeoutMs: number = parseInt(process.env.GRPC_REQUEST_TIMEOUT_MS || '15000', 10)
  ): Promise<DispatchResponse> {
    const client = this.clients.get(key);
    if (!client) {
      return Promise.reject(new Error(`gRPC client for service '${key}' is not registered`));
    }

    const metadata = new grpc.Metadata();
    for (const [k, v] of Object.entries(metadataEntries || {})) {
      if (v !== undefined && v !== '') {
        metadata.set(k.toLowerCase(), String(v));
      }
    }

    const deadline = new Date(Date.now() + timeoutMs);

    return new Promise((resolve, reject) => {
      client.Dispatch(request, metadata, { deadline }, (err: grpc.ServiceError | null, response: any) => {
        if (err) {
          return reject(err);
        }
        const rawBody = response?.body;
        const bodyBuffer = Buffer.isBuffer(rawBody)
          ? rawBody
          : rawBody instanceof Uint8Array
            ? Buffer.from(rawBody)
            : typeof rawBody === 'string'
              ? Buffer.from(rawBody, 'utf8')
              : Buffer.alloc(0);

        resolve({
          statusCode: Number(response?.statusCode || 200),
          headers: (response?.headers || {}) as Record<string, string>,
          body: bodyBuffer
        });
      });
    });
  }

  healthCheck(key: ServiceKey, timeoutMs: number = 2000): Promise<GrpcHealthResult> {
    const client = this.clients.get(key);
    const target = this.getTarget(key);
    const start = Date.now();

    if (!client) {
      return Promise.resolve({
        status: 'DOWN',
        latencyMs: Date.now() - start,
        protocol: 'grpc',
        target,
        error: `No gRPC client registered for '${key}'`
      });
    }

    const deadline = new Date(Date.now() + timeoutMs);

    return new Promise((resolve) => {
      client.HealthCheck({}, { deadline }, (err: grpc.ServiceError | null, response: any) => {
        const latencyMs = Date.now() - start;
        if (err) {
          return resolve({
            status: 'DOWN',
            latencyMs,
            protocol: 'grpc',
            target,
            error: err.details || err.message
          });
        }
        if (response?.status) {
          return resolve({
            status: 'UP',
            latencyMs,
            protocol: 'grpc',
            target,
            service: response.service,
            uptimeSeconds: Number(response.uptimeSeconds || 0)
          });
        }
        return resolve({
          status: 'DEGRADED',
          latencyMs,
          protocol: 'grpc',
          target,
          service: response?.service,
          error: 'Service reported unhealthy status'
        });
      });
    });
  }

  verifyToken(token: string, expectedTenantId?: string, timeoutMs: number = 3000): Promise<any> {
    const client = this.clients.get('iam');
    if (!client) {
      return Promise.reject(new Error('IAM gRPC client not initialized'));
    }
    const deadline = new Date(Date.now() + timeoutMs);
    return new Promise((resolve, reject) => {
      client.VerifyToken(
        { token, expectedTenantId: expectedTenantId || '' },
        { deadline },
        (err: grpc.ServiceError | null, response: any) => {
          if (err) return reject(err);
          resolve(response);
        }
      );
    });
  }

  invokeRpc(
    key: ServiceKey,
    methodName: string,
    payload: Record<string, any> = {},
    metadataEntries?: Record<string, string>,
    timeoutMs: number = parseInt(process.env.GRPC_REQUEST_TIMEOUT_MS || '15000', 10)
  ): Promise<any> {
    const client = this.clients.get(key);
    if (!client || typeof client[methodName] !== 'function') {
      return Promise.reject(new Error(`gRPC method '${key}.${methodName}' not found`));
    }

    const metadata = new grpc.Metadata();
    for (const [k, v] of Object.entries(metadataEntries || {})) {
      if (v !== undefined && v !== '') {
        metadata.set(k.toLowerCase(), String(v));
      }
    }

    const deadline = new Date(Date.now() + timeoutMs);
    return new Promise((resolve, reject) => {
      client[methodName](payload, metadata, { deadline }, (err: grpc.ServiceError | null, response: any) => {
        if (err) return reject(err);
        resolve(response);
      });
    });
  }

  closeAll(): void {
    for (const client of this.clients.values()) {
      try {
        client.close();
      } catch {
        // Ignore close errors during shutdown
      }
    }
    this.clients.clear();
  }
}

