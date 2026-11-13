import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import {
  CreateJobUseCase,
  ListJobsQuery,
  TriggerJobUseCase
} from '../application/use-cases/scheduler.use-cases.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startSchedulerGrpcServer(
  listQuery: ListJobsQuery,
  createUseCase: CreateJobUseCase,
  triggerUseCase: TriggerJobUseCase,
  port: number = 50055,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/scheduler.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const schedulerProto = protoDescriptor.scheduler;

  const server = new grpc.Server();

  server.addService(schedulerProto.SchedulerService.service, {
    ListJobs: async (_call: any, callback: any) => {
      const requestId = `grpc-sched-${Date.now()}`;
      try {
        const result = await listQuery.execute();
        const items = result.getValue().map(j => ({
          ...j,
          lastRunAt: j.lastRunAt || '',
          nextRunAt: j.nextRunAt || ''
        }));

        callback(null, {
          status: true,
          message: 'Scheduled jobs retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'scheduler-service', rpc: 'ListJobs' },
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

    CreateJob: async (call: any, callback: any) => {
      const requestId = `grpc-sched-${Date.now()}`;
      try {
        const { name, cronExpression } = call.request;
        const result = await createUseCase.execute({ name, cronExpression });
        const job = result.getValue();

        callback(null, {
          status: true,
          message: 'Scheduled job registered successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'scheduler-service', rpc: 'CreateJob' },
            further_steps: []
          },
          data: {
            ...job,
            lastRunAt: job.lastRunAt || '',
            nextRunAt: job.nextRunAt || ''
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    TriggerJob: async (call: any, callback: any) => {
      const requestId = `grpc-sched-${Date.now()}`;
      try {
        const result = await triggerUseCase.execute({ id: call.request.id });
        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'id' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'scheduler-service', rpc: 'TriggerJob' },
              further_steps: []
            },
            data: null
          });
        }

        const job = result.getValue();
        callback(null, {
          status: true,
          message: 'Scheduled job triggered successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'scheduler-service', rpc: 'TriggerJob' },
            further_steps: []
          },
          data: {
            ...job,
            lastRunAt: job.lastRunAt || '',
            nextRunAt: job.nextRunAt || ''
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'scheduler-service',
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
            message: 'Express dispatch app not attached to Scheduler gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in scheduler-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Scheduler gRPC server', err);
        return;
      }
      logger.info(`⚡ Scheduler gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}

