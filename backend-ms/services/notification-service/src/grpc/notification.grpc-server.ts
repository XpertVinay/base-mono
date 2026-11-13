import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import { SendNotificationUseCase, ListNotificationsQuery } from '../application/use-cases/notification.use-cases.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startNotificationGrpcServer(
  sendUseCase: SendNotificationUseCase,
  listQuery: ListNotificationsQuery,
  port: number = 50054,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/notification.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const notificationProto = protoDescriptor.notification;

  const server = new grpc.Server();

  server.addService(notificationProto.NotificationService.service, {
    SendNotification: async (call: any, callback: any) => {
      const requestId = `grpc-notif-${Date.now()}`;
      try {
        const { recipient, channel, subject, body } = call.request;
        const result = await sendUseCase.execute({
          recipient,
          channel: (channel || 'EMAIL') as 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK',
          subject,
          body
        });

        const data = result.getValue();
        callback(null, {
          status: true,
          message: 'Notification queued and dispatched successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'notification-service', rpc: 'SendNotification' },
            further_steps: []
          },
          data: {
            ...data,
            sentAt: data.sentAt || ''
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ListNotifications: async (call: any, callback: any) => {
      const requestId = `grpc-notif-${Date.now()}`;
      try {
        const limit = call.request.limit || 50;
        const result = await listQuery.execute({ limit });
        const items = result.getValue().map(n => ({
          ...n,
          sentAt: n.sentAt || ''
        }));

        callback(null, {
          status: true,
          message: 'Notifications retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'notification-service', rpc: 'ListNotifications' },
            pagination: {
              page: 1,
              limit,
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

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'notification-service',
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
            message: 'Express dispatch app not attached to Notification gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in notification-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Notification gRPC server', err);
        return;
      }
      logger.info(`⚡ Notification gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}

