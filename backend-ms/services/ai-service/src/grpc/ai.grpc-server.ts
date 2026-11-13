import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import {
  ListMcpProvidersQuery,
  RegisterMcpProviderUseCase
} from '../application/use-cases/provider-management.use-cases.js';
import {
  CallMcpToolUseCase,
  ListAvailableToolsQuery,
  OrchestrateToolsUseCase
} from '../application/use-cases/mcp-tool-execution.use-cases.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AiGrpcServerDeps {
  listProviders: ListMcpProvidersQuery;
  registerProvider: RegisterMcpProviderUseCase;
  listTools: ListAvailableToolsQuery;
  callTool: CallMcpToolUseCase;
  orchestrateTools: OrchestrateToolsUseCase;
}

export function startAiGrpcServer(
  deps: AiGrpcServerDeps,
  port: number = 50060,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/ai.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const aiProto = protoDescriptor.ai;

  const server = new grpc.Server();

  server.addService(aiProto.AIService.service, {
    ListProviders: async (call: any, callback: any) => {
      const requestId = `grpc-ai-${Date.now()}`;
      try {
        const tenantId = call.request.tenantId || 'default';
        const result = await deps.listProviders.execute({
          tenantId,
          category: call.request.category || undefined,
          enabledOnly: Boolean(call.request.enabledOnly)
        });
        const items = result.getValue().map(p => ({
          id: p.id,
          tenantId: p.tenantId,
          slug: p.slug,
          name: p.name,
          category: p.category,
          transportType: p.transportType,
          endpointUrl: p.endpointUrl || '',
          isBuiltin: p.isBuiltin,
          isEnabled: p.isEnabled,
          healthStatus: p.healthStatus,
          updatedAt: p.updatedAt
        }));
        callback(null, {
          status: true,
          message: 'MCP providers retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'ai-service', rpc: 'ListProviders' },
            further_steps: []
          },
          data: { items }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    RegisterProvider: async (call: any, callback: any) => {
      const requestId = `grpc-ai-${Date.now()}`;
      try {
        const r = call.request;
        const result = await deps.registerProvider.execute({
          tenantId: r.tenantId || 'default',
          slug: r.slug,
          name: r.name,
          category: r.category,
          transportType: r.transportType,
          endpointUrl: r.endpointUrl || undefined,
          authType: r.authType || 'NONE',
          credentials: r.credentialsJson ? JSON.parse(r.credentialsJson) : undefined,
          config: r.configJson ? JSON.parse(r.configJson) : undefined,
          autoSync: r.autoSync !== false
        });
        const p = result.getValue().provider;
        callback(null, {
          status: true,
          message: 'MCP provider registered successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'ai-service', rpc: 'RegisterProvider' },
            further_steps: []
          },
          data: {
            id: p.id,
            tenantId: p.tenantId,
            slug: p.slug,
            name: p.name,
            category: p.category,
            transportType: p.transportType,
            endpointUrl: p.endpointUrl || '',
            isBuiltin: p.isBuiltin,
            isEnabled: p.isEnabled,
            healthStatus: p.healthStatus,
            updatedAt: p.updatedAt
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INVALID_ARGUMENT, message: err.message });
      }
    },

    ListTools: async (call: any, callback: any) => {
      const requestId = `grpc-ai-${Date.now()}`;
      try {
        const result = await deps.listTools.execute({
          tenantId: call.request.tenantId || 'default',
          providerSlug: call.request.providerSlug || undefined,
          search: call.request.search || undefined
        });
        const items = result.getValue().map(t => ({
          id: t.id,
          providerSlug: t.providerSlug,
          toolName: t.toolName,
          qualifiedName: t.qualifiedName,
          description: t.description || '',
          inputSchemaJson: JSON.stringify(t.inputSchema || {}),
          isEnabled: t.isEnabled
        }));
        callback(null, {
          status: true,
          message: 'Available MCP tools retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'ai-service', rpc: 'ListTools' },
            further_steps: []
          },
          data: { items }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    CallTool: async (call: any, callback: any) => {
      const requestId = `grpc-ai-${Date.now()}`;
      try {
        const r = call.request;
        const args = r.argumentsJson ? JSON.parse(r.argumentsJson) : {};
        const result = await deps.callTool.execute({
          tenantId: r.tenantId || 'default',
          providerSlug: r.providerSlug || undefined,
          toolName: r.toolName || undefined,
          qualifiedName: r.qualifiedName || undefined,
          arguments: args,
          actorId: r.actorId || undefined,
          correlationId: r.correlationId || requestId
        });
        const data = result.getValue();
        callback(null, {
          status: true,
          message: 'MCP tool executed successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'ai-service', rpc: 'CallTool' },
            further_steps: []
          },
          data: {
            invocationId: data.invocationId,
            providerSlug: data.providerSlug,
            toolName: data.toolName,
            qualifiedName: data.qualifiedName,
            isError: data.isError,
            contentJson: JSON.stringify(data.content || []),
            structuredContentJson: data.structuredContent ? JSON.stringify(data.structuredContent) : '',
            durationMs: data.durationMs
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    Orchestrate: async (call: any, callback: any) => {
      const requestId = `grpc-ai-${Date.now()}`;
      try {
        const r = call.request;
        const steps = r.stepsJson ? JSON.parse(r.stepsJson) : [];
        const result = await deps.orchestrateTools.execute({
          tenantId: r.tenantId || 'default',
          mode: (r.mode || 'sequential') as 'sequential' | 'parallel',
          stopOnError: r.stopOnError !== false,
          steps,
          actorId: r.actorId || undefined,
          correlationId: r.correlationId || requestId
        });
        const data = result.getValue();
        callback(null, {
          status: true,
          message: 'MCP tool orchestration completed',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'ai-service', rpc: 'Orchestrate' },
            further_steps: []
          },
          data: {
            success: data.success,
            resultsJson: JSON.stringify(data.results),
            totalDurationMs: data.totalDurationMs
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'ai-service',
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
            message: 'Express dispatch app not attached to AI gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in ai-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind AI gRPC server', err);
        return;
      }
      logger.info(`⚡ AI & MCP gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}

