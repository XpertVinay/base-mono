import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import {
  McpAuthType,
  McpProviderCategory,
  McpProviderDto,
  McpToolDto,
  McpTransportType
} from '../../shared/contracts/index.js';
import { CryptoService } from '../../shared/infrastructure/crypto.service.js';
import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';
import { McpToolDefinition } from '../../domain/entities/mcp-tool.entity.js';
import { IMcpProviderRepository } from '../../domain/repositories/mcp-provider-repository.interface.js';
import { IMcpToolRepository } from '../../domain/repositories/mcp-tool-repository.interface.js';
import { DecryptedProviderCredentials, IMcpClientManager } from '../ports/mcp-client.port.js';
import { ProviderExecutionContext } from '../ports/provider-adapter.port.js';
import { ProviderAdapterRegistry } from '../../infrastructure/providers/adapter-registry.js';
import { AppError, NotFoundError } from '../../shared/domain/errors.js';

export function decryptCredentials(encrypted?: string): DecryptedProviderCredentials | undefined {
  if (!encrypted) return undefined;
  try {
    const json = CryptoService.decrypt(encrypted);
    return JSON.parse(json) as DecryptedProviderCredentials;
  } catch {
    return undefined;
  }
}

export interface RegisterMcpProviderCommand {
  tenantId: string;
  slug: string;
  name: string;
  category: McpProviderCategory;
  transportType: McpTransportType;
  endpointUrl?: string;
  command?: string;
  args?: string[];
  authType?: McpAuthType;
  credentials?: DecryptedProviderCredentials;
  config?: Record<string, any>;
  isEnabled?: boolean;
  autoSync?: boolean;
}

export class RegisterMcpProviderUseCase implements UseCase<RegisterMcpProviderCommand, { provider: McpProviderDto; syncedTools: McpToolDto[] }> {
  constructor(
    private readonly providerRepo: IMcpProviderRepository,
    private readonly toolRepo: IMcpToolRepository,
    private readonly adapterRegistry: ProviderAdapterRegistry
  ) {}

  async execute(
    cmd: RegisterMcpProviderCommand
  ): Promise<Result<{ provider: McpProviderDto; syncedTools: McpToolDto[] }>> {
    const existing = await this.providerRepo.findBySlug(cmd.slug, cmd.tenantId);
    if (existing) {
      throw new AppError(`MCP provider with slug '${cmd.slug}' already exists for this tenant`, 409, 'CONFLICT');
    }

    const credentialsEncrypted = cmd.credentials
      ? CryptoService.encrypt(JSON.stringify(cmd.credentials))
      : undefined;

    const provider = McpProvider.create({
      tenantId: cmd.tenantId,
      slug: cmd.slug,
      name: cmd.name,
      category: cmd.category,
      transportType: cmd.transportType,
      endpointUrl: cmd.endpointUrl,
      command: cmd.command,
      args: cmd.args,
      authType: cmd.authType || 'NONE',
      credentialsEncrypted,
      config: cmd.config || {},
      isBuiltin: false,
      isEnabled: cmd.isEnabled ?? true
    });

    await this.providerRepo.save(provider);

    let syncedTools: McpToolDto[] = [];
    if (cmd.autoSync !== false && provider.isEnabled) {
      try {
        const adapter = this.adapterRegistry.resolve(provider);
        const ctx: ProviderExecutionContext = {
          tenantId: cmd.tenantId,
          provider,
          credentials: cmd.credentials
        };
        const specs = await adapter.listTools(ctx);
        const entities = specs.map(spec =>
          McpToolDefinition.create({
            tenantId: cmd.tenantId,
            providerId: provider.id,
            providerSlug: provider.slug,
            toolName: spec.name,
            description: spec.description,
            inputSchema: spec.inputSchema,
            annotations: spec.annotations
          })
        );
        await this.toolRepo.replaceProviderTools(cmd.tenantId, provider.id, entities);
        provider.markSynced({ tools: { count: entities.length } });
        await this.providerRepo.save(provider);
        syncedTools = entities.map(e => e.toDto());
      } catch (syncErr: any) {
        provider.updateHealth('DEGRADED');
        await this.providerRepo.save(provider);
      }
    }

    return Result.ok({ provider: provider.toDto(), syncedTools });
  }
}

export interface UpdateMcpProviderCommand {
  tenantId: string;
  idOrSlug: string;
  name?: string;
  endpointUrl?: string;
  command?: string;
  args?: string[];
  authType?: McpAuthType;
  credentials?: DecryptedProviderCredentials;
  config?: Record<string, any>;
  isEnabled?: boolean;
}

export class UpdateMcpProviderUseCase implements UseCase<UpdateMcpProviderCommand, McpProviderDto> {
  constructor(
    private readonly providerRepo: IMcpProviderRepository,
    private readonly clientManager: IMcpClientManager
  ) {}

  async execute(cmd: UpdateMcpProviderCommand): Promise<Result<McpProviderDto>> {
    const provider =
      (await this.providerRepo.findById(cmd.idOrSlug, cmd.tenantId)) ||
      (await this.providerRepo.findBySlug(cmd.idOrSlug, cmd.tenantId));

    if (!provider) {
      throw new NotFoundError(`MCP Provider '${cmd.idOrSlug}'`);
    }
    if (provider.isBuiltin) {
      throw new AppError('Built-in platform MCP providers cannot be modified directly', 400, 'BUILTIN_IMMUTABLE');
    }

    const credentialsEncrypted = cmd.credentials
      ? CryptoService.encrypt(JSON.stringify(cmd.credentials))
      : undefined;

    provider.update({
      name: cmd.name,
      endpointUrl: cmd.endpointUrl,
      command: cmd.command,
      args: cmd.args,
      authType: cmd.authType,
      credentialsEncrypted,
      config: cmd.config,
      isEnabled: cmd.isEnabled
    });

    await this.providerRepo.save(provider);
    await this.clientManager.evictClient(cmd.tenantId, provider.id);

    return Result.ok(provider.toDto());
  }
}

export class DeleteMcpProviderUseCase implements UseCase<{ tenantId: string; idOrSlug: string }, { deleted: boolean }> {
  constructor(
    private readonly providerRepo: IMcpProviderRepository,
    private readonly toolRepo: IMcpToolRepository,
    private readonly clientManager: IMcpClientManager
  ) {}

  async execute(input: { tenantId: string; idOrSlug: string }): Promise<Result<{ deleted: boolean }>> {
    const provider =
      (await this.providerRepo.findById(input.idOrSlug, input.tenantId)) ||
      (await this.providerRepo.findBySlug(input.idOrSlug, input.tenantId));

    if (!provider) {
      throw new NotFoundError(`MCP Provider '${input.idOrSlug}'`);
    }
    if (provider.isBuiltin) {
      throw new AppError('Built-in platform MCP providers cannot be deleted', 400, 'BUILTIN_IMMUTABLE');
    }

    await this.clientManager.evictClient(input.tenantId, provider.id);
    await this.toolRepo.deleteByProviderId(provider.id, input.tenantId);
    const deleted = await this.providerRepo.delete(provider.id, input.tenantId);

    return Result.ok({ deleted });
  }
}

export class ListMcpProvidersQuery
  implements UseCase<{ tenantId: string; category?: McpProviderCategory; enabledOnly?: boolean }, McpProviderDto[]>
{
  constructor(private readonly providerRepo: IMcpProviderRepository) {}

  async execute(input: {
    tenantId: string;
    category?: McpProviderCategory;
    enabledOnly?: boolean;
  }): Promise<Result<McpProviderDto[]>> {
    const providers = await this.providerRepo.list({
      tenantId: input.tenantId,
      category: input.category,
      enabledOnly: input.enabledOnly
    });
    return Result.ok(providers.map(p => p.toDto()));
  }
}

export class GetMcpProviderQuery implements UseCase<{ tenantId: string; idOrSlug: string }, McpProviderDto> {
  constructor(private readonly providerRepo: IMcpProviderRepository) {}

  async execute(input: { tenantId: string; idOrSlug: string }): Promise<Result<McpProviderDto>> {
    const provider =
      (await this.providerRepo.findById(input.idOrSlug, input.tenantId)) ||
      (await this.providerRepo.findBySlug(input.idOrSlug, input.tenantId));

    if (!provider) {
      throw new NotFoundError(`MCP Provider '${input.idOrSlug}'`);
    }
    return Result.ok(provider.toDto());
  }
}

export class SyncProviderToolsUseCase
  implements UseCase<{ tenantId: string; idOrSlug: string }, { provider: McpProviderDto; tools: McpToolDto[] }>
{
  constructor(
    private readonly providerRepo: IMcpProviderRepository,
    private readonly toolRepo: IMcpToolRepository,
    private readonly adapterRegistry: ProviderAdapterRegistry
  ) {}

  async execute(input: {
    tenantId: string;
    idOrSlug: string;
  }): Promise<Result<{ provider: McpProviderDto; tools: McpToolDto[] }>> {
    const provider =
      (await this.providerRepo.findById(input.idOrSlug, input.tenantId)) ||
      (await this.providerRepo.findBySlug(input.idOrSlug, input.tenantId));

    if (!provider) {
      throw new NotFoundError(`MCP Provider '${input.idOrSlug}'`);
    }

    const adapter = this.adapterRegistry.resolve(provider);
    const ctx: ProviderExecutionContext = {
      tenantId: input.tenantId,
      provider,
      credentials: decryptCredentials(provider.credentialsEncrypted)
    };

    try {
      const specs = await adapter.listTools(ctx);
      const entities = specs.map(spec =>
        McpToolDefinition.create({
          tenantId: input.tenantId,
          providerId: provider.id,
          providerSlug: provider.slug,
          toolName: spec.name,
          description: spec.description,
          inputSchema: spec.inputSchema,
          annotations: spec.annotations
        })
      );

      if (!provider.isBuiltin) {
        await this.toolRepo.replaceProviderTools(input.tenantId, provider.id, entities);
        provider.markSynced({ tools: { count: entities.length } });
        await this.providerRepo.save(provider);
      }

      return Result.ok({
        provider: provider.toDto(),
        tools: entities.map(t => t.toDto())
      });
    } catch (err: any) {
      if (!provider.isBuiltin) {
        provider.updateHealth('UNHEALTHY');
        await this.providerRepo.save(provider);
      }
      throw new AppError(`Failed to sync tools from provider '${provider.slug}': ${err.message}`, 502, 'MCP_SYNC_FAILED');
    }
  }
}

export class CheckProviderHealthUseCase
  implements UseCase<{ tenantId: string; idOrSlug: string }, { providerSlug: string; healthy: boolean; details?: Record<string, any> }>
{
  constructor(
    private readonly providerRepo: IMcpProviderRepository,
    private readonly adapterRegistry: ProviderAdapterRegistry
  ) {}

  async execute(input: {
    tenantId: string;
    idOrSlug: string;
  }): Promise<Result<{ providerSlug: string; healthy: boolean; details?: Record<string, any> }>> {
    const provider =
      (await this.providerRepo.findById(input.idOrSlug, input.tenantId)) ||
      (await this.providerRepo.findBySlug(input.idOrSlug, input.tenantId));

    if (!provider) {
      throw new NotFoundError(`MCP Provider '${input.idOrSlug}'`);
    }

    const ctx: ProviderExecutionContext = {
      tenantId: input.tenantId,
      provider,
      credentials: decryptCredentials(provider.credentialsEncrypted)
    };

    const health = await this.adapterRegistry.checkHealth(ctx);
    if (!provider.isBuiltin) {
      provider.updateHealth(health.healthy ? 'HEALTHY' : 'UNHEALTHY');
      await this.providerRepo.save(provider);
    }

    return Result.ok({
      providerSlug: provider.slug,
      healthy: health.healthy,
      details: health.details
    });
  }
}

