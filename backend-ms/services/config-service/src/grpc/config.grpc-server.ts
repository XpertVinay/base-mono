import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { IConfigRepository } from '../domain/repositories/config-repository.interface.js';
import { logger } from '../shared/infrastructure/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startConfigGrpcServer(repo: IConfigRepository, port: number = 50053): grpc.Server {
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
        const setting = await repo.getByKey(key);

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

    GetActivePaymentGateway: async (_call: any, callback: any) => {
      const requestId = `grpc-config-${Date.now()}`;
      try {
        const setting = await repo.getByKey('ACTIVE_PAYMENT_GATEWAY');
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
