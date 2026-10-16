import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { IInventoryRepository } from '../domain/repositories/inventory-repository.interface.js';
import { logger } from '../shared/infrastructure/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startInventoryGrpcServer(repo: IInventoryRepository, port: number = 50059): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/inventory.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const inventoryProto = protoDescriptor.inventory;

  const server = new grpc.Server();

  server.addService(inventoryProto.InventoryService.service, {
    CheckStock: async (call: any, callback: any) => {
      try {
        const { productId, quantity } = call.request;
        const item = await repo.findByProductId(productId);
        if (!item) {
          return callback(null, { available: false, availableQuantity: 0 });
        }
        callback(null, {
          available: item.availableQuantity >= quantity,
          availableQuantity: item.availableQuantity
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ReserveStock: async (call: any, callback: any) => {
      try {
        const { productId, quantity } = call.request;
        const item = await repo.findByProductId(productId);
        if (!item) {
          return callback(null, { success: false, message: 'Product not found in inventory' });
        }
        const reserved = item.reserve(quantity);
        if (!reserved) {
          return callback(null, {
            success: false,
            message: `Insufficient stock. Available: ${item.availableQuantity}, Requested: ${quantity}`
          });
        }
        await repo.update(item);
        callback(null, { success: true, message: 'Stock reserved successfully' });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Inventory gRPC server', err);
        return;
      }
      logger.info(`⚡ Inventory gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}
