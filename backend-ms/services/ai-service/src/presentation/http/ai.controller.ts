import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CheckProviderHealthUseCase,
  DeleteMcpProviderUseCase,
  GetMcpProviderQuery,
  ListMcpProvidersQuery,
  RegisterMcpProviderUseCase,
  SyncProviderToolsUseCase,
  UpdateMcpProviderUseCase
} from '../../application/use-cases/provider-management.use-cases.js';
import {
  CallMcpToolUseCase,
  ListAvailableToolsQuery,
  ListInvocationHistoryQuery,
  OrchestrateToolsUseCase,
  ProviderResourcesAndPromptsUseCase
} from '../../application/use-cases/mcp-tool-execution.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';
import { McpProviderCategory } from '../../shared/contracts/index.js';
import { MCP_PROTOCOL_VERSION } from '../../infrastructure/mcp/mcp-jsonrpc.types.js';
import { ProviderAdapterRegistry } from '../../infrastructure/providers/adapter-registry.js';

const credentialsSchema = z
  .object({
    bearerToken: z.string().optional(),
    apiKey: z.string().optional(),
    apiKeyHeader: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    headers: z.record(z.string()).optional(),
    connectionString: z.string().optional(),
    env: z.record(z.string()).optional()
  })
  .optional();

const registerProviderSchema = z.object({
  slug: z.string().min(2).max(99),
  name: z.string().min(1).max(255),
  category: z.enum(['COMMUNICATION', 'SEARCH', 'DATABASE', 'EXTERNAL_API', 'EXTERNAL_MCP', 'CUSTOM']),
  transportType: z.enum(['INTERNAL', 'STREAMABLE_HTTP', 'SSE', 'STDIO', 'REST_API', 'POSTGRES_EXTERNAL']),
  endpointUrl: z.string().url().optional(),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  authType: z.enum(['NONE', 'BEARER', 'API_KEY', 'BASIC', 'CUSTOM_HEADERS']).optional(),
  credentials: credentialsSchema,
  config: z.record(z.any()).optional(),
  isEnabled: z.boolean().optional(),
  autoSync: z.boolean().optional()
});

const updateProviderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  endpointUrl: z.string().url().optional(),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  authType: z.enum(['NONE', 'BEARER', 'API_KEY', 'BASIC', 'CUSTOM_HEADERS']).optional(),
  credentials: credentialsSchema,
  config: z.record(z.any()).optional(),
  isEnabled: z.boolean().optional()
});

const callToolSchema = z.object({
  providerSlug: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
  qualifiedName: z.string().min(1).optional(),
  arguments: z.record(z.any()).optional()
});

const orchestrateSchema = z.object({
  mode: z.enum(['sequential', 'parallel']).optional(),
  stopOnError: z.boolean().optional(),
  steps: z
    .array(
      z.object({
        stepId: z.string().optional(),
        providerSlug: z.string().optional(),
        toolName: z.string().optional(),
        qualifiedName: z.string().optional(),
        arguments: z.record(z.any()).optional()
      })
    )
    .min(1)
});

export class AiController {
  constructor(
    private readonly registerProvider: RegisterMcpProviderUseCase,
    private readonly updateProvider: UpdateMcpProviderUseCase,
    private readonly deleteProvider: DeleteMcpProviderUseCase,
    private readonly listProviders: ListMcpProvidersQuery,
    private readonly getProvider: GetMcpProviderQuery,
    private readonly syncProviderTools: SyncProviderToolsUseCase,
    private readonly checkProviderHealth: CheckProviderHealthUseCase,
    private readonly listTools: ListAvailableToolsQuery,
    private readonly callTool: CallMcpToolUseCase,
    private readonly orchestrateTools: OrchestrateToolsUseCase,
    private readonly resourcesAndPrompts: ProviderResourcesAndPromptsUseCase,
    private readonly listInvocations: ListInvocationHistoryQuery,
    private readonly adapterRegistry: ProviderAdapterRegistry
  ) {}

  private getTenantId(req: Request): string {
    return req.user?.tenantId || req.tenant?.tenantId || req.context?.tenantId || 'default';
  }

  capabilities = (req: Request, res: Response): void => {
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'AI & MCP Integration capabilities retrieved',
      data: {
        service: 'ai-service',
        mcpProtocolVersion: MCP_PROTOCOL_VERSION,
        supportedTransports: ['INTERNAL', 'STREAMABLE_HTTP', 'SSE', 'STDIO', 'REST_API', 'POSTGRES_EXTERNAL'],
        supportedCategories: ['COMMUNICATION', 'SEARCH', 'DATABASE', 'EXTERNAL_API', 'EXTERNAL_MCP', 'CUSTOM'],
        registeredAdapters: this.adapterRegistry.listAdapterIds()
      }
    });
  };

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = registerProviderSchema.parse(req.body);
      const result = await this.registerProvider.execute({
        tenantId: this.getTenantId(req),
        ...body
      });
      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'MCP provider registered successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  listAllProviders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = req.query.category as McpProviderCategory | undefined;
      const enabledOnly = req.query.enabledOnly === 'true';
      const result = await this.listProviders.execute({
        tenantId: this.getTenantId(req),
        category,
        enabledOnly
      });
      const items = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP providers retrieved successfully',
        data: items,
        meta: {
          pagination: { total: items.length, limit: items.length, page: 1, totalPages: 1 }
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getOneProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getProvider.execute({
        tenantId: this.getTenantId(req),
        idOrSlug: String(req.params.idOrSlug)
      });
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP provider retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = updateProviderSchema.parse(req.body);
      const result = await this.updateProvider.execute({
        tenantId: this.getTenantId(req),
        idOrSlug: String(req.params.idOrSlug),
        ...body
      });
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP provider updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deleteProvider.execute({
        tenantId: this.getTenantId(req),
        idOrSlug: String(req.params.idOrSlug)
      });
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP provider deleted successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  syncTools = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.syncProviderTools.execute({
        tenantId: this.getTenantId(req),
        idOrSlug: String(req.params.idOrSlug)
      });
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP provider tools synced successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  healthCheckProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.checkProviderHealth.execute({
        tenantId: this.getTenantId(req),
        idOrSlug: String(req.params.idOrSlug)
      });
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP provider health check completed',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  listAllTools = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const providerSlug = typeof req.query.provider === 'string' ? req.query.provider : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const result = await this.listTools.execute({
        tenantId: this.getTenantId(req),
        providerSlug,
        search
      });
      const items = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Available MCP tools retrieved successfully',
        data: items,
        meta: {
          pagination: { total: items.length, limit: items.length, page: 1, totalPages: 1 }
        }
      });
    } catch (err) {
      next(err);
    }
  };

  invokeTool = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = callToolSchema.parse(req.body);
      const result = await this.callTool.execute({
        tenantId: this.getTenantId(req),
        actorId: req.user?.id,
        correlationId: req.context?.correlationId,
        providerSlug: body.providerSlug,
        toolName: body.toolName,
        qualifiedName: body.qualifiedName,
        arguments: body.arguments
      });
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP tool executed successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  invokeProviderTool = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const args = z.record(z.any()).optional().parse(req.body?.arguments ?? req.body);
      const result = await this.callTool.execute({
        tenantId: this.getTenantId(req),
        actorId: req.user?.id,
        correlationId: req.context?.correlationId,
        providerSlug: String(req.params.idOrSlug),
        toolName: String(req.params.toolName),
        arguments: args || {}
      });
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP tool executed successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  orchestrate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = orchestrateSchema.parse(req.body);
      const result = await this.orchestrateTools.execute({
        tenantId: this.getTenantId(req),
        actorId: req.user?.id,
        correlationId: req.context?.correlationId,
        ...body
      });
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP tool orchestration completed',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  listProviderResources = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.resourcesAndPrompts.listResources(
        this.getTenantId(req),
        String(req.params.idOrSlug)
      );
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP resources retrieved successfully',
        data: items
      });
    } catch (err) {
      next(err);
    }
  };

  readProviderResource = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uri } = z.object({ uri: z.string().min(1) }).parse(req.body);
      const contents = await this.resourcesAndPrompts.readResource(
        this.getTenantId(req),
        String(req.params.idOrSlug),
        uri
      );
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP resource read successfully',
        data: contents
      });
    } catch (err) {
      next(err);
    }
  };

  listProviderPrompts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.resourcesAndPrompts.listPrompts(
        this.getTenantId(req),
        String(req.params.idOrSlug)
      );
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP prompts retrieved successfully',
        data: items
      });
    } catch (err) {
      next(err);
    }
  };

  getProviderPrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const args = z.record(z.string()).optional().parse(req.body?.arguments);
      const prompt = await this.resourcesAndPrompts.getPrompt(
        this.getTenantId(req),
        String(req.params.idOrSlug),
        String(req.params.promptName),
        args
      );
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP prompt retrieved successfully',
        data: prompt
      });
    } catch (err) {
      next(err);
    }
  };

  invocations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const providerSlug = typeof req.query.provider === 'string' ? req.query.provider : undefined;
      const toolName = typeof req.query.tool === 'string' ? req.query.tool : undefined;
      const status =
        req.query.status === 'SUCCESS' || req.query.status === 'ERROR' ? req.query.status : undefined;

      const result = await this.listInvocations.execute({
        tenantId: this.getTenantId(req),
        providerSlug,
        toolName,
        status,
        limit
      });
      const items = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'MCP invocation history retrieved successfully',
        data: items,
        meta: {
          pagination: { total: items.length, limit, page: 1, totalPages: 1 }
        }
      });
    } catch (err) {
      next(err);
    }
  };
}

