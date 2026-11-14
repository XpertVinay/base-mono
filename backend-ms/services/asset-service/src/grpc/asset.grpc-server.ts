import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import { CreateAssetUseCase } from '../application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from '../application/queries/list-assets.query.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startAssetGrpcServer(
  createUseCase: CreateAssetUseCase,
  listQuery: ListAssetsQuery,
  port: number = 50052,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/asset.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const assetProto = protoDescriptor.asset;

  const server = new grpc.Server();

  server.addService(assetProto.AssetService.service, {
    CreateAsset: async (call: any, callback: any) => {
      const requestId = `grpc-asset-${Date.now()}`;
      try {
        const { name, mimeType, sizeBytes, storagePath, ownerId } = call.request;
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const result = await createUseCase.execute({
          name,
          mimeType,
          sizeBytes: Number(sizeBytes),
          storagePath,
          ownerId,
          tenantId
        });

        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'ASSET_CREATION_FAILED', message: result.getError() }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'asset-service', rpc: 'CreateAsset' },
              further_steps: []
            },
            data: null
          });
        }

        callback(null, {
          status: true,
          message: 'Asset registered successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'asset-service', rpc: 'CreateAsset' },
            further_steps: []
          },
          data: result.getValue()
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ListMyAssets: async (call: any, callback: any) => {
      const requestId = `grpc-asset-${Date.now()}`;
      try {
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const result = await listQuery.execute({ ownerId: call.request.ownerId, tenantId });
        const items = result.getValue();

        callback(null, {
          status: true,
          message: 'Assets retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'asset-service', rpc: 'ListMyAssets' },
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

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'asset-service',
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
            message: 'Express dispatch app not attached to Asset gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in asset-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Asset gRPC server', err);
        return;
      }
      logger.info(`⚡ Asset gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}

