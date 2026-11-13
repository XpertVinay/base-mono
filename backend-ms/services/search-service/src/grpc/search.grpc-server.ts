import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import { SearchQueryUseCase } from '../application/use-cases/search.use-cases.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startSearchGrpcServer(
  searchUseCase: SearchQueryUseCase,
  port: number = 50058,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/search.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const searchProto = protoDescriptor.search;

  const server = new grpc.Server();

  server.addService(searchProto.SearchService.service, {
    Search: async (call: any, callback: any) => {
      const requestId = `grpc-search-${Date.now()}`;
      try {
        const { query, type } = call.request;
        const result = await searchUseCase.execute({
          query: query || '',
          type: type || undefined
        });

        const items = result.getValue().map(hit => ({
          id: hit.id,
          type: hit.type,
          title: hit.title,
          description: hit.description || '',
          metadataJson: JSON.stringify(hit.metadata || {})
        }));

        callback(null, {
          status: true,
          message: 'Search completed successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'search-service', rpc: 'Search' },
            pagination: {
              page: 1,
              limit: items.length,
              total: items.length,
              total_pages: 1,
              has_next: false
            },
            further_steps: items.length === 0 ? ['Try broadening your search query string'] : []
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
        service: 'search-service',
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
            message: 'Express dispatch app not attached to Search gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in search-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Search gRPC server', err);
        return;
      }
      logger.info(`⚡ Search gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}

