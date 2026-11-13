import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { IMcpProviderRepository } from './domain/repositories/mcp-provider-repository.interface.js';
import { IMcpToolRepository } from './domain/repositories/mcp-tool-repository.interface.js';
import { IToolInvocationRepository } from './domain/repositories/tool-invocation-repository.interface.js';
import {
  IExternalApiPort,
  IInternalDatabasePort,
  INotificationGatewayPort,
  ISearchGatewayPort
} from './application/ports/internal-services.port.js';
import { IMcpProviderAdapter } from './application/ports/provider-adapter.port.js';
import { McpClientManager } from './infrastructure/mcp/mcp-client.manager.js';
import { ProviderAdapterRegistry } from './infrastructure/providers/adapter-registry.js';
import { ExternalApiClient, ExternalApiMcpAdapter } from './infrastructure/providers/external-api-mcp.adapter.js';
import { ExternalMcpServerAdapter } from './infrastructure/providers/external-mcp.adapter.js';
import { CommunicationMcpAdapter } from './infrastructure/providers/communication-mcp.adapter.js';
import { SearchMcpAdapter } from './infrastructure/providers/search-mcp.adapter.js';
import {
  InternalDatabaseMcpAdapter,
  PostgresInternalDatabaseGateway
} from './infrastructure/providers/internal-database-mcp.adapter.js';
import { ExternalDatabaseMcpAdapter } from './infrastructure/providers/external-database-mcp.adapter.js';
import {
  PostgresMcpProviderRepository,
  PostgresMcpToolRepository,
  PostgresToolInvocationRepository
} from './infrastructure/persistence/postgres-mcp.repositories.js';
import {
  InMemoryMcpProviderRepository,
  InMemoryMcpToolRepository,
  InMemoryToolInvocationRepository
} from './infrastructure/persistence/in-memory-mcp.repositories.js';
import { NotificationGrpcClient } from './grpc/notification-grpc.client.js';
import { SearchGrpcClient } from './grpc/search-grpc.client.js';
import {
  CheckProviderHealthUseCase,
  DeleteMcpProviderUseCase,
  GetMcpProviderQuery,
  ListMcpProvidersQuery,
  RegisterMcpProviderUseCase,
  SyncProviderToolsUseCase,
  UpdateMcpProviderUseCase
} from './application/use-cases/provider-management.use-cases.js';
import {
  CallMcpToolUseCase,
  ListAvailableToolsQuery,
  ListInvocationHistoryQuery,
  OrchestrateToolsUseCase,
  ProviderResourcesAndPromptsUseCase
} from './application/use-cases/mcp-tool-execution.use-cases.js';
import { AiController } from './presentation/http/ai.controller.js';
import { createAiRouter } from './presentation/http/ai.routes.js';

export interface CreateAiAppOptions {
  useInMemoryStore?: boolean;
  providerRepo?: IMcpProviderRepository;
  toolRepo?: IMcpToolRepository;
  invocationRepo?: IToolInvocationRepository;
  notificationGateway?: INotificationGatewayPort;
  searchGateway?: ISearchGatewayPort;
  internalDatabase?: IInternalDatabasePort;
  externalApiClient?: IExternalApiPort;
  customAdapters?: IMcpProviderAdapter[];
}

export function createApp(options: CreateAiAppOptions = {}): {
  app: Express;
  listProviders: ListMcpProvidersQuery;
  registerProvider: RegisterMcpProviderUseCase;
  listTools: ListAvailableToolsQuery;
  callTool: CallMcpToolUseCase;
  orchestrateTools: OrchestrateToolsUseCase;
  adapterRegistry: ProviderAdapterRegistry;
  clientManager: McpClientManager;
  closeResources: () => Promise<void>;
} {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(correlationIdMiddleware);
  app.use(tenantContextMiddleware());
  app.use(rateLimiter());

  const useMemory = options.useInMemoryStore ?? process.env.AI_IN_MEMORY_STORE === 'true';

  const providerRepo =
    options.providerRepo ||
    (useMemory ? new InMemoryMcpProviderRepository() : new PostgresMcpProviderRepository());
  const toolRepo =
    options.toolRepo || (useMemory ? new InMemoryMcpToolRepository() : new PostgresMcpToolRepository());
  const invocationRepo =
    options.invocationRepo ||
    (useMemory ? new InMemoryToolInvocationRepository() : new PostgresToolInvocationRepository());

  const ownedNotificationClient = options.notificationGateway ? undefined : new NotificationGrpcClient();
  const ownedSearchClient = options.searchGateway ? undefined : new SearchGrpcClient();

  const notificationGateway = options.notificationGateway || ownedNotificationClient!;
  const searchGateway = options.searchGateway || ownedSearchClient!;
  const internalDatabase = options.internalDatabase || new PostgresInternalDatabaseGateway();
  const apiClient = options.externalApiClient || new ExternalApiClient();

  const clientManager = new McpClientManager();
  const externalDbAdapter = new ExternalDatabaseMcpAdapter(apiClient);
  const adapterRegistry = new ProviderAdapterRegistry();

  // Register custom/extensible adapters first so they take priority when matching
  if (options.customAdapters) {
    for (const custom of options.customAdapters) {
      adapterRegistry.register(custom);
    }
  }

  adapterRegistry
    .register(new ExternalMcpServerAdapter(clientManager))
    .register(new CommunicationMcpAdapter(notificationGateway, apiClient))
    .register(new SearchMcpAdapter(searchGateway, apiClient))
    .register(new InternalDatabaseMcpAdapter(internalDatabase))
    .register(externalDbAdapter)
    .register(new ExternalApiMcpAdapter(apiClient));

  const registerProvider = new RegisterMcpProviderUseCase(providerRepo, toolRepo, adapterRegistry);
  const updateProvider = new UpdateMcpProviderUseCase(providerRepo, clientManager);
  const deleteProvider = new DeleteMcpProviderUseCase(providerRepo, toolRepo, clientManager);
  const listProviders = new ListMcpProvidersQuery(providerRepo);
  const getProvider = new GetMcpProviderQuery(providerRepo);
  const syncProviderTools = new SyncProviderToolsUseCase(providerRepo, toolRepo, adapterRegistry);
  const checkProviderHealth = new CheckProviderHealthUseCase(providerRepo, adapterRegistry);

  const listTools = new ListAvailableToolsQuery(providerRepo, toolRepo, adapterRegistry);
  const callTool = new CallMcpToolUseCase(providerRepo, invocationRepo, adapterRegistry);
  const orchestrateTools = new OrchestrateToolsUseCase(callTool);
  const resourcesAndPrompts = new ProviderResourcesAndPromptsUseCase(providerRepo, adapterRegistry);
  const listInvocations = new ListInvocationHistoryQuery(invocationRepo);

  const controller = new AiController(
    registerProvider,
    updateProvider,
    deleteProvider,
    listProviders,
    getProvider,
    syncProviderTools,
    checkProviderHealth,
    listTools,
    callTool,
    orchestrateTools,
    resourcesAndPrompts,
    listInvocations,
    adapterRegistry
  );

  const router = createAiRouter(controller);

  app.get('/health', (_req, res) =>
    res.json({
      status: 'UP',
      service: 'ai-service',
      adapters: adapterRegistry.listAdapterIds(),
      timestamp: new Date().toISOString()
    })
  );

  app.use('/api/v1/ai', router);
  app.use('/api/ai', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  const closeResources = async () => {
    await clientManager.closeAll();
    await externalDbAdapter.closeAll();
    ownedNotificationClient?.close();
    ownedSearchClient?.close();
  };

  return {
    app,
    listProviders,
    registerProvider,
    listTools,
    callTool,
    orchestrateTools,
    adapterRegistry,
    clientManager,
    closeResources
  };
}

