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
      const requestId = `grpc-inv-${Date.now()}`;
      try {
        const { productId, quantity } = call.request;
        const item = await repo.findByProductId(productId);

        if (!item) {
          return callback(null, {
            status: false,
            message: `Product ${productId} not found in inventory`,
            errors: [{ code: 'PRODUCT_NOT_FOUND', message: `Product ${productId} does not exist`, field: 'productId' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'inventory-service', rpc: 'CheckStock' },
              further_steps: ['Add stock for this product via POST /api/v1/inventory/stock']
            },
            data: { available: false, availableQuantity: 0 },
            available: false,
            availableQuantity: 0
          });
        }

        const isAvailable = item.availableQuantity >= quantity;
        callback(null, {
          status: isAvailable,
          message: isAvailable ? 'Stock is available' : 'Insufficient stock',
          errors: isAvailable ? [] : [{ code: 'INSUFFICIENT_STOCK', message: `Requested ${quantity}, available: ${item.availableQuantity}` }],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'inventory-service', rpc: 'CheckStock' },
            further_steps: isAvailable ? ['Proceed with stock reservation'] : ['Reduce quantity or replenish inventory']
          },
          data: { available: isAvailable, availableQuantity: item.availableQuantity },
          available: isAvailable,
          availableQuantity: item.availableQuantity
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ReserveStock: async (call: any, callback: any) => {
      const requestId = `grpc-inv-${Date.now()}`;
      try {
        const { productId, quantity, orderId } = call.request;
        const item = await repo.findByProductId(productId);

        if (!item) {
          return callback(null, {
            status: false,
            message: `Product ${productId} not found in inventory`,
            errors: [{ code: 'NOT_FOUND', message: `Product ${productId} not found`, field: 'productId' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'inventory-service', rpc: 'ReserveStock' },
              further_steps: []
            },
            data: null,
            success: false
          });
        }

        const reserved = item.reserve(quantity);
        if (!reserved) {
          return callback(null, {
            status: false,
            message: `Insufficient stock. Available: ${item.availableQuantity}, Requested: ${quantity}`,
            errors: [{ code: 'STOCK_DEPLETED', message: `Available: ${item.availableQuantity}` }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'inventory-service', rpc: 'ReserveStock' },
              further_steps: ['Replenish inventory stock']
            },
            data: null,
            success: false
          });
        }

        await repo.update(item);

        callback(null, {
          status: true,
          message: 'Stock reserved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'inventory-service', rpc: 'ReserveStock' },
            further_steps: ['Proceed to order creation and payment authorization']
          },
          data: { productId, reservedQuantity: quantity, orderId },
          success: true
        });
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
