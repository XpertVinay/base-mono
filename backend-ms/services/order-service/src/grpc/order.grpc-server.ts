import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import {
  CreateOrderUseCase,
  CancelOrderUseCase,
  GetOrderByIdQuery,
  ListMyOrdersQuery
} from '../application/commands/order.commands.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startOrderGrpcServer(
  useCases: {
    createUseCase: CreateOrderUseCase;
    cancelUseCase: CancelOrderUseCase;
    getByIdQuery: GetOrderByIdQuery;
    listMyQuery: ListMyOrdersQuery;
  },
  port: number = 50056,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/order.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const orderProto = protoDescriptor.order;

  const server = new grpc.Server();

  server.addService(orderProto.OrderService.service, {
    CreateOrder: async (call: any, callback: any) => {
      const requestId = `grpc-order-${Date.now()}`;
      try {
        const { userId, items, currency } = call.request;
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const result = await useCases.createUseCase.execute({
          userId,
          tenantId,
          items: (items || []).map((i: any) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice)
          })),
          currency: currency || undefined
        });

        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'ORDER_CREATION_FAILED', message: result.getError() }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'order-service', rpc: 'CreateOrder' },
              further_steps: []
            },
            data: null
          });
        }

        callback(null, {
          status: true,
          message: 'Order created successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'order-service', rpc: 'CreateOrder' },
            further_steps: []
          },
          data: result.getValue()
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    GetOrderById: async (call: any, callback: any) => {
      const requestId = `grpc-order-${Date.now()}`;
      try {
        const { orderId, userId, role } = call.request;
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const result = await useCases.getByIdQuery.execute({
          orderId,
          userId: userId || '',
          role: role || 'USER',
          tenantId
        });

        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'orderId' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'order-service', rpc: 'GetOrderById' },
              further_steps: []
            },
            data: null
          });
        }

        callback(null, {
          status: true,
          message: 'Order retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'order-service', rpc: 'GetOrderById' },
            further_steps: []
          },
          data: result.getValue()
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ListMyOrders: async (call: any, callback: any) => {
      const requestId = `grpc-order-${Date.now()}`;
      try {
        const result = await useCases.listMyQuery.execute({ userId: call.request.userId });
        const items = result.getValue();

        callback(null, {
          status: true,
          message: 'Orders retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'order-service', rpc: 'ListMyOrders' },
            pagination: {
              page: 1,
              limit: items.length,
              total: items.length,
              total_pages: 1,
              has_next: false
            },
            further_steps: []
          },
          data: { items }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    CancelOrder: async (call: any, callback: any) => {
      const requestId = `grpc-order-${Date.now()}`;
      try {
        const { orderId, userId, role } = call.request;
        const result = await useCases.cancelUseCase.execute({
          orderId,
          userId: userId || '',
          role: role || 'USER'
        });

        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'CANCEL_FAILED', message: result.getError() }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'order-service', rpc: 'CancelOrder' },
              further_steps: []
            },
            data: null
          });
        }

        callback(null, {
          status: true,
          message: 'Order cancelled successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'order-service', rpc: 'CancelOrder' },
            further_steps: []
          },
          data: result.getValue()
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'order-service',
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
            message: 'Express dispatch app not attached to Order gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in order-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Order gRPC server', err);
        return;
      }
      logger.info(`⚡ Order gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}

