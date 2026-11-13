import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import { RecordAuditLogUseCase, QueryAuditLogsQuery } from '../application/use-cases/audit.use-cases.js';
import { AuditSeverity } from '../domain/entities/audit-log.entity.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startAuditGrpcServer(
  recordUseCase: RecordAuditLogUseCase,
  queryUseCase: QueryAuditLogsQuery,
  port: number = 50061,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/audit.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const auditProto = protoDescriptor.audit;

  const server = new grpc.Server();

  server.addService(auditProto.AuditService.service, {
    RecordAuditLog: async (call: any, callback: any) => {
      const requestId = `grpc-audit-${Date.now()}`;
      try {
        const req = call.request;
        let details = {};
        if (req.detailsJson) {
          try { details = JSON.parse(req.detailsJson); } catch {}
        }

        const result = await recordUseCase.execute({
          actorId: req.actorId || undefined,
          actorEmail: req.actorEmail || undefined,
          action: req.action,
          resource: req.resource,
          resourceId: req.resourceId || undefined,
          severity: (req.severity as AuditSeverity) || 'INFO',
          details,
          ipAddress: req.ipAddress || undefined,
          correlationId: req.correlationId || undefined
        });

        const log = result.getValue();
        const logId = log.id;
        const timestamp = String(log.createdAt);

        callback(null, {
          status: true,
          message: 'Audit log recorded successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'audit-service', rpc: 'RecordAuditLog' },
            further_steps: []
          },
          data: { logId, timestamp },
          success: true,
          logId,
          timestamp
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    QueryAuditLogs: async (call: any, callback: any) => {
      const requestId = `grpc-audit-${Date.now()}`;
      try {
        const req = call.request;
        const result = await queryUseCase.execute({
          actorId: req.actorId || undefined,
          resource: req.resource || undefined,
          action: req.action || undefined,
          limit: req.limit || 50
        });

        const items = result.getValue().map(l => ({
          id: l.id,
          actorId: l.actorId || '',
          actorEmail: l.actorEmail || '',
          action: l.action,
          resource: l.resource,
          resourceId: l.resourceId || '',
          severity: l.severity,
          detailsJson: JSON.stringify(l.details || {}),
          ipAddress: l.ipAddress || '',
          correlationId: l.correlationId || '',
          timestamp: String(l.createdAt)
        }));

        callback(null, {
          status: true,
          message: 'Audit logs retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'audit-service', rpc: 'QueryAuditLogs' },
            pagination: {
              page: 1,
              limit: req.limit || 50,
              total: items.length,
              total_pages: 1,
              has_next: false
            },
            further_steps: []
          },
          data: { items },
          items
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'audit-service',
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
            message: 'Express dispatch app not attached to Audit gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in audit-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Audit gRPC server', err);
        return;
      }
      logger.info(`⚡ Audit gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}
