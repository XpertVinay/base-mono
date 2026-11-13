import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import { IInventoryRepository } from '../domain/repositories/inventory-repository.interface.js';
import { InventoryItem } from '../domain/entities/inventory.entity.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startInventoryGrpcServer(
  repo: IInventoryRepository,
  port: number = 50059,
  app?: Express
): grpc.Server {
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
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || 'default';
        const reserved = await repo.reserveAtomic(productId, quantity, tenantId);

        if (!reserved) {
          const item = await repo.findByProductId(productId, tenantId);
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
    },

    GetStock: async (call: any, callback: any) => {
      const requestId = `grpc-inv-${Date.now()}`;
      try {
        const { productId } = call.request;
        const item = await repo.findByProductId(productId);
        if (!item) {
          return callback(null, {
            status: false,
            message: 'Product not found in inventory',
            errors: [{ code: 'NOT_FOUND', message: `Product ${productId} not found`, field: 'productId' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'inventory-service', rpc: 'GetStock' },
              further_steps: []
            },
            data: null
          });
        }

        callback(null, {
          status: true,
          message: 'Stock retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'inventory-service', rpc: 'GetStock' },
            further_steps: []
          },
          data: {
            productId: item.productId,
            sku: item.sku,
            availableQuantity: item.availableQuantity,
            reservedQuantity: item.reservedQuantity,
            totalQuantity: item.totalQuantity,
            updatedAt: item.updatedAt.toISOString()
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    AddStock: async (call: any, callback: any) => {
      const requestId = `grpc-inv-${Date.now()}`;
      try {
        const { productId, sku, quantity } = call.request;
        let item = await repo.findByProductId(productId);
        if (item) {
          item.addStock(quantity);
          await repo.update(item);
        } else {
          item = InventoryItem.create(productId, {
            sku,
            availableQuantity: quantity,
            reservedQuantity: 0,
            totalQuantity: quantity
          });
          await repo.save(item);
        }

        callback(null, {
          status: true,
          message: 'Stock added successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'inventory-service', rpc: 'AddStock' },
            further_steps: []
          },
          data: {
            productId: item.productId,
            sku: item.sku,
            availableQuantity: item.availableQuantity,
            reservedQuantity: item.reservedQuantity,
            totalQuantity: item.totalQuantity,
            updatedAt: item.updatedAt.toISOString()
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'inventory-service',
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
            message: 'Express dispatch app not attached to Inventory gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in inventory-service'
        });
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
