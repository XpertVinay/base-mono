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
      try {
        const { key, defaultValue } = call.request;
        const setting = await repo.getByKey(key);
        if (!setting) {
          if (defaultValue !== undefined && defaultValue !== '') {
            return callback(null, { key, value: defaultValue, isEncrypted: false });
          }
          return callback({
            code: grpc.status.NOT_FOUND,
            message: `Config key ${key} not found`
          });
        }
        callback(null, {
          key: setting.key,
          value: setting.value,
          isEncrypted: setting.isEncrypted
        });
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message
        });
      }
    },

    GetActivePaymentGateway: async (_call: any, callback: any) => {
      try {
        const setting = await repo.getByKey('ACTIVE_PAYMENT_GATEWAY');
        const provider = setting ? setting.value : (process.env.ACTIVE_PAYMENT_GATEWAY || 'STRIPE');
        callback(null, { provider });
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
