import crypto from 'node:crypto';
import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { McpToolCallResultDto, McpToolDto, ToolInvocationDto } from '../../shared/contracts/index.js';
import { McpToolDefinition } from '../../domain/entities/mcp-tool.entity.js';
import { ToolInvocationLog } from '../../domain/entities/tool-invocation.entity.js';
import { IMcpProviderRepository } from '../../domain/repositories/mcp-provider-repository.interface.js';
import { IMcpToolRepository } from '../../domain/repositories/mcp-tool-repository.interface.js';
import { IToolInvocationRepository } from '../../domain/repositories/tool-invocation-repository.interface.js';
import { ProviderExecutionContext } from '../ports/provider-adapter.port.js';
import { ProviderAdapterRegistry } from '../../infrastructure/providers/adapter-registry.js';
import { decryptCredentials } from './provider-management.use-cases.js';
import { AppError, BadGatewayError, NotFoundError } from '../../shared/domain/errors.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { McpPromptResult, McpPromptSpec, McpResourceContent, McpResourceSpec } from '../ports/mcp-client.port.js';

export class ListAvailableToolsQuery
  implements UseCase<{ tenantId: string; providerSlug?: string; search?: string }, McpToolDto[]>
{
  constructor(
    private readonly providerRepo: IMcpProviderRepository,
    private readonly toolRepo: IMcpToolRepository,
    private readonly adapterRegistry: ProviderAdapterRegistry
  ) {}

  async execute(input: {
    tenantId: string;
    providerSlug?: string;
    search?: string;
  }): Promise<Result<McpToolDto[]>> {
    const persistedTools = await this.toolRepo.list({
      tenantId: input.tenantId,
      providerSlug: input.providerSlug,
      search: input.search,
      enabledOnly: true
    });

    const providers = await this.providerRepo.list({
      tenantId: input.tenantId,
      enabledOnly: true
    });

    const allDtos: McpToolDto[] = [...persistedTools.map(t => t.toDto())];
    const existingQualified = new Set(allDtos.map(t => t.qualifiedName));

    for (const provider of providers) {
      if (input.providerSlug && provider.slug !== input.providerSlug.toLowerCase()) continue;
      if (!provider.isBuiltin) continue;

      const adapter = this.adapterRegistry.resolve(provider);
      const specs = await adapter.listTools({
        tenantId: input.tenantId,
        provider,
        credentials: decryptCredentials(provider.credentialsEncrypted)
      });

      for (const spec of specs) {
        const qualifiedName = `${provider.slug}.${spec.name}`;
        if (existingQualified.has(qualifiedName)) continue;

        if (input.search) {
          const q = input.search.toLowerCase();
          const match =
            spec.name.toLowerCase().includes(q) ||
            qualifiedName.toLowerCase().includes(q) ||
            (spec.description || '').toLowerCase().includes(q);
          if (!match) continue;
        }

        const entity = McpToolDefinition.create(
          {
            tenantId: input.tenantId,
            providerId: provider.id,
            providerSlug: provider.slug,
            toolName: spec.name,
            description: spec.description,
            inputSchema: spec.inputSchema,
            annotations: spec.annotations
          },
          `builtin-tool-${provider.slug}-${spec.name}`
        );
        allDtos.push(entity.toDto());
      }
    }

    return Result.ok(allDtos);
  }
}

export interface CallMcpToolCommand {
  tenantId: string;
  actorId?: string;
  correlationId?: string;
  providerSlug?: string;
  toolName?: string;
  qualifiedName?: string;
  arguments?: Record<string, any>;
}

export class CallMcpToolUseCase implements UseCase<CallMcpToolCommand, McpToolCallResultDto> {
  constructor(
    private readonly providerRepo: IMcpProviderRepository,
    private readonly invocationRepo: IToolInvocationRepository,
    private readonly adapterRegistry: ProviderAdapterRegistry
  ) {}

  async execute(cmd: CallMcpToolCommand): Promise<Result<McpToolCallResultDto>> {
    let providerSlug = cmd.providerSlug?.trim().toLowerCase();
    let toolName = cmd.toolName?.trim();

    if (cmd.qualifiedName && (!providerSlug || !toolName)) {
      const dotIdx = cmd.qualifiedName.indexOf('.');
      if (dotIdx <= 0 || dotIdx === cmd.qualifiedName.length - 1) {
        throw new AppError(
          `Invalid qualifiedName '${cmd.qualifiedName}'. Expected '<providerSlug>.<toolName>'`,
          400,
          'INVALID_TOOL_NAME'
        );
      }
      providerSlug = cmd.qualifiedName.slice(0, dotIdx).toLowerCase();
      toolName = cmd.qualifiedName.slice(dotIdx + 1);
    }

    if (!providerSlug || !toolName) {
      throw new AppError('Either qualifiedName or both providerSlug and toolName are required', 400, 'INVALID_TOOL_NAME');
    }

    const provider = await this.providerRepo.findBySlug(providerSlug, cmd.tenantId);
    if (!provider) {
      throw new NotFoundError(`MCP Provider '${providerSlug}'`);
    }
    if (!provider.isEnabled) {
      throw new AppError(`MCP Provider '${providerSlug}' is disabled`, 400, 'PROVIDER_DISABLED');
    }

    const adapter = this.adapterRegistry.resolve(provider);
    const ctx: ProviderExecutionContext = {
      tenantId: cmd.tenantId,
      actorId: cmd.actorId,
      correlationId: cmd.correlationId,
      provider,
      credentials: decryptCredentials(provider.credentialsEncrypted)
    };

    const started = Date.now();
    const args = cmd.arguments || {};
    const qualifiedName = `${provider.slug}.${toolName}`;

    try {
      const callResult = await adapter.callTool(ctx, toolName, args);
      const durationMs = Date.now() - started;

      const log = ToolInvocationLog.create({
        tenantId: cmd.tenantId,
        actorId: cmd.actorId,
        providerId: provider.id,
        providerSlug: provider.slug,
        toolName,
        category: provider.category,
        status: callResult.isError ? 'ERROR' : 'SUCCESS',
        arguments: args,
        resultSummary: {
          contentCount: callResult.content.length,
          isError: callResult.isError
        },
        durationMs,
        correlationId: cmd.correlationId
      });

      await this.invocationRepo.save(log);

      rabbitmq
        .publish('ai.tool.invoked', {
          id: crypto.randomUUID(),
          eventName: 'ai.tool.invoked',
          aggregateId: log.id,
          occurredAt: new Date().toISOString(),
          version: 1,
          tenantId: cmd.tenantId,
          payload: {
            invocationId: log.id,
            providerSlug: provider.slug,
            toolName,
            category: provider.category,
            isError: callResult.isError,
            durationMs
          }
        })
        .catch(() => {});

      return Result.ok({
        providerSlug: provider.slug,
        toolName,
        qualifiedName,
        isError: callResult.isError,
        content: callResult.content,
        structuredContent: callResult.structuredContent,
        durationMs,
        invocationId: log.id,
        meta: callResult.meta
      });
    } catch (err: any) {
      const durationMs = Date.now() - started;
      const log = ToolInvocationLog.create({
        tenantId: cmd.tenantId,
        actorId: cmd.actorId,
        providerId: provider.id,
        providerSlug: provider.slug,
        toolName,
        category: provider.category,
        status: 'ERROR',
        arguments: args,
        errorMessage: err.message,
        durationMs,
        correlationId: cmd.correlationId
      });

      await this.invocationRepo.save(log);

      rabbitmq
        .publish('ai.tool.failed', {
          id: crypto.randomUUID(),
          eventName: 'ai.tool.failed',
          aggregateId: log.id,
          occurredAt: new Date().toISOString(),
          version: 1,
          tenantId: cmd.tenantId,
          payload: {
            invocationId: log.id,
            providerSlug: provider.slug,
            toolName,
            error: err.message,
            durationMs
          }
        })
        .catch(() => {});

      throw new BadGatewayError(`MCP tool '${qualifiedName}' failed: ${err.message}`, {
        invocationId: log.id,
        providerSlug: provider.slug,
        toolName
      });
    }
  }
}

export interface OrchestrateStepInput {
  stepId?: string;
  providerSlug?: string;
  toolName?: string;
  qualifiedName?: string;
  arguments?: Record<string, any>;
}

export interface OrchestrateToolsCommand {
  tenantId: string;
  actorId?: string;
  correlationId?: string;
  mode?: 'sequential' | 'parallel';
  stopOnError?: boolean;
  steps: OrchestrateStepInput[];
}

export interface OrchestrateStepResult {
  stepId: string;
  qualifiedName: string;
  status: 'SUCCESS' | 'ERROR';
  result?: McpToolCallResultDto;
  error?: string;
  durationMs: number;
}

function getByPath(obj: any, pathStr: string): any {
  return pathStr.split('.').reduce((acc, part) => (acc !== undefined && acc !== null ? acc[part] : undefined), obj);
}

function resolveTemplateValue(val: any, stepResults: Record<string, any>): any {
  if (typeof val === 'string') {
    const exactMatch = val.match(/^\{\{steps\.([^}]+)\}\}$/);
    if (exactMatch) {
      const resolved = getByPath(stepResults, exactMatch[1]);
      return resolved !== undefined ? resolved : val;
    }
    return val.replace(/\{\{steps\.([^}]+)\}\}/g, (_m, pathExpr) => {
      const resolved = getByPath(stepResults, pathExpr);
      if (resolved === undefined || resolved === null) return '';
      return typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
    });
  }
  if (Array.isArray(val)) {
    return val.map(item => resolveTemplateValue(item, stepResults));
  }
  if (val && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = resolveTemplateValue(v, stepResults);
    }
    return out;
  }
  return val;
}

export class OrchestrateToolsUseCase
  implements
    UseCase<
      OrchestrateToolsCommand,
      { success: boolean; mode: string; totalDurationMs: number; results: OrchestrateStepResult[] }
    >
{
  constructor(private readonly callToolUseCase: CallMcpToolUseCase) {}

  async execute(
    cmd: OrchestrateToolsCommand
  ): Promise<
    Result<{ success: boolean; mode: string; totalDurationMs: number; results: OrchestrateStepResult[] }>
  > {
    const started = Date.now();
    const mode = cmd.mode || 'sequential';
    const stopOnError = cmd.stopOnError ?? true;

    const executeOne = async (
      step: OrchestrateStepInput,
      index: number,
      contextMap: Record<string, any>
    ): Promise<OrchestrateStepResult> => {
      const stepId = step.stepId || `step_${index}`;
      const stepStart = Date.now();
      const qualifiedName =
        step.qualifiedName || `${step.providerSlug || 'unknown'}.${step.toolName || 'unknown'}`;
      const resolvedArgs = resolveTemplateValue(step.arguments || {}, contextMap);

      try {
        const res = await this.callToolUseCase.execute({
          tenantId: cmd.tenantId,
          actorId: cmd.actorId,
          correlationId: cmd.correlationId,
          providerSlug: step.providerSlug,
          toolName: step.toolName,
          qualifiedName: step.qualifiedName,
          arguments: resolvedArgs
        });
        const data = res.getValue();
        return {
          stepId,
          qualifiedName: data.qualifiedName,
          status: data.isError ? 'ERROR' : 'SUCCESS',
          result: data,
          durationMs: Date.now() - stepStart
        };
      } catch (err: any) {
        return {
          stepId,
          qualifiedName,
          status: 'ERROR',
          error: err.message,
          durationMs: Date.now() - stepStart
        };
      }
    };

    const results: OrchestrateStepResult[] = [];
    if (mode === 'parallel') {
      const parallelResults = await Promise.all(cmd.steps.map((s, idx) => executeOne(s, idx, {})));
      results.push(...parallelResults);
    } else {
      const stepContext: Record<string, any> = {};
      for (let i = 0; i < cmd.steps.length; i++) {
        const stepRes = await executeOne(cmd.steps[i], i, stepContext);
        results.push(stepRes);
        stepContext[stepRes.stepId] = stepRes.result || { error: stepRes.error };
        stepContext[String(i)] = stepContext[stepRes.stepId];
        if (stepRes.status === 'ERROR' && stopOnError) {
          break;
        }
      }
    }

    const success = results.every(r => r.status === 'SUCCESS');
    return Result.ok({
      success,
      mode,
      totalDurationMs: Date.now() - started,
      results
    });
  }
}

export class ProviderResourcesAndPromptsUseCase {
  constructor(
    private readonly providerRepo: IMcpProviderRepository,
    private readonly adapterRegistry: ProviderAdapterRegistry
  ) {}

  private async resolveCtx(tenantId: string, idOrSlug: string) {
    const provider =
      (await this.providerRepo.findById(idOrSlug, tenantId)) ||
      (await this.providerRepo.findBySlug(idOrSlug, tenantId));
    if (!provider) throw new NotFoundError(`MCP Provider '${idOrSlug}'`);
    const adapter = this.adapterRegistry.resolve(provider);
    const ctx: ProviderExecutionContext = {
      tenantId,
      provider,
      credentials: decryptCredentials(provider.credentialsEncrypted)
    };
    return { adapter, ctx };
  }

  async listResources(tenantId: string, idOrSlug: string): Promise<McpResourceSpec[]> {
    const { adapter, ctx } = await this.resolveCtx(tenantId, idOrSlug);
    if (!adapter.listResources) return [];
    return adapter.listResources(ctx);
  }

  async readResource(tenantId: string, idOrSlug: string, uri: string): Promise<McpResourceContent[]> {
    const { adapter, ctx } = await this.resolveCtx(tenantId, idOrSlug);
    if (!adapter.readResource) {
      throw new AppError(`Provider '${ctx.provider.slug}' does not support MCP resources`, 400, 'UNSUPPORTED_CAPABILITY');
    }
    return adapter.readResource(ctx, uri);
  }

  async listPrompts(tenantId: string, idOrSlug: string): Promise<McpPromptSpec[]> {
    const { adapter, ctx } = await this.resolveCtx(tenantId, idOrSlug);
    if (!adapter.listPrompts) return [];
    return adapter.listPrompts(ctx);
  }

  async getPrompt(tenantId: string, idOrSlug: string, name: string, args?: Record<string, string>): Promise<McpPromptResult> {
    const { adapter, ctx } = await this.resolveCtx(tenantId, idOrSlug);
    if (!adapter.getPrompt) {
      throw new AppError(`Provider '${ctx.provider.slug}' does not support MCP prompts`, 400, 'UNSUPPORTED_CAPABILITY');
    }
    return adapter.getPrompt(ctx, name, args);
  }
}

export class ListInvocationHistoryQuery
  implements
    UseCase<
      { tenantId: string; providerSlug?: string; toolName?: string; status?: 'SUCCESS' | 'ERROR'; limit?: number },
      ToolInvocationDto[]
    >
{
  constructor(private readonly invocationRepo: IToolInvocationRepository) {}

  async execute(input: {
    tenantId: string;
    providerSlug?: string;
    toolName?: string;
    status?: 'SUCCESS' | 'ERROR';
    limit?: number;
  }): Promise<Result<ToolInvocationDto[]>> {
    const items = await this.invocationRepo.list(input);
    return Result.ok(items.map(i => i.toDto()));
  }
}

