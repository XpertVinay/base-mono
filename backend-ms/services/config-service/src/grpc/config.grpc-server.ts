import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import { IConfigRepository } from '../domain/repositories/config-repository.interface.js';
import { ConfigSetting } from '../domain/entities/config.entity.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startConfigGrpcServer(
  repo: IConfigRepository,
  port: number = 50053,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/config.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const configProto = protoDescriptor.config;

  const server = new grpc.Server();

  server.addService(configProto.ConfigService.service, {
    GetConfigByKey: async (call: any, callback: any) => {
      const requestId = `grpc-config-${Date.now()}`;
      try {
        const { key, defaultValue } = call.request;
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const setting = await repo.getByKey(key, tenantId);

        if (!setting) {
          if (defaultValue !== undefined && defaultValue !== '') {
            return callback(null, {
              status: true,
              message: 'Default configuration returned',
              errors: [],
              meta_data: {
                request_id: requestId,
                timestamp: new Date().toISOString(),
                debug_data: { service: 'config-service', rpc: 'GetConfigByKey', isDefault: 'true' },
                further_steps: []
              },
              data: { key, value: defaultValue, isEncrypted: false },
              key,
              value: defaultValue,
              isEncrypted: false
            });
          }

          return callback(null, {
            status: false,
            message: `Config key ${key} not found`,
            errors: [{ code: 'NOT_FOUND', message: `Key ${key} does not exist`, field: 'key' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'config-service', rpc: 'GetConfigByKey' },
              further_steps: ['Seed or configure this key in config-service']
            },
            data: null,
            key: '',
            value: '',
            isEncrypted: false
          });
        }

        const configData = {
          key: setting.key,
          value: setting.value,
          isEncrypted: setting.isEncrypted
        };

        callback(null, {
          status: true,
          message: 'Config retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'config-service', rpc: 'GetConfigByKey' },
            further_steps: []
          },
          data: configData,
          ...configData
        });
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message
        });
      }
    },

    GetActivePaymentGateway: async (call: any, callback: any) => {
      const requestId = `grpc-config-${Date.now()}`;
      try {
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const setting = await repo.getByKey('ACTIVE_PAYMENT_GATEWAY', tenantId);
        const provider = setting ? setting.value : (process.env.ACTIVE_PAYMENT_GATEWAY || 'STRIPE');

        callback(null, {
          status: true,
          message: 'Active payment gateway resolved',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'config-service', rpc: 'GetActivePaymentGateway' },
            further_steps: ['Use resolved gateway provider for checkout execution']
          },
          data: { provider },
          provider
        });
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message
        });
      }
    },

    ListConfigs: async (call: any, callback: any) => {
      const requestId = `grpc-config-${Date.now()}`;
      try {
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const settings = await repo.getAll(tenantId);
        const items = settings.map(s => ({
          key: s.key,
          value: s.value,
          isEncrypted: s.isEncrypted
        }));
        callback(null, {
          status: true,
          message: 'Configurations retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'config-service', rpc: 'ListConfigs' },
            pagination: { page: 1, limit: items.length, total: items.length, total_pages: 1, has_next: false },
            further_steps: []
          },
          data: { items }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    SetConfig: async (call: any, callback: any) => {
      const requestId = `grpc-config-${Date.now()}`;
      try {
        const { key, value, description, isEncrypted } = call.request;
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const setting = ConfigSetting.create(key, {
          tenantId,
          value,
          description: description || undefined,
          isEncrypted: !!isEncrypted
        });
        await repo.save(setting);
        callback(null, {
          status: true,
          message: 'Configuration updated successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'config-service', rpc: 'SetConfig' },
            further_steps: []
          },
          data: { key: setting.key, value: setting.value, isEncrypted: setting.isEncrypted }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    DeleteConfig: async (call: any, callback: any) => {
      const requestId = `grpc-config-${Date.now()}`;
      try {
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const deleted = await repo.delete(call.request.key, tenantId);
        callback(null, {
          status: deleted,
          message: deleted ? 'Configuration deleted successfully' : 'Configuration setting not found',
          errors: deleted ? [] : [{ code: 'NOT_FOUND', message: `Key ${call.request.key} not found`, field: 'key' }],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'config-service', rpc: 'DeleteConfig' },
            further_steps: []
          },
          deleted
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'config-service',
        version: 'v1',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime())
      });
    },

    Dispatch: async (call: any, callback: any) => {
      try {
        if (!app) {
          return callback({
            code: grpc.status.UNIMPLEMENTED,
            message: 'Express dispatch app not attached to Config gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in config-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Config gRPC server', err);
        return;
      }
      logger.info(`⚡ Config gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}
