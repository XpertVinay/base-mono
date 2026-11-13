import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';
import { DecryptedProviderCredentials, McpCallResult, McpPromptResult, McpPromptSpec, McpResourceContent, McpResourceSpec, McpToolSpec } from './mcp-client.port.js';

export interface ProviderExecutionContext {
  tenantId: string;
  actorId?: string;
  correlationId?: string;
  provider: McpProvider;
  credentials?: DecryptedProviderCredentials;
}

/**
 * Extensible Provider Adapter contract.
 * Implement and register new adapters to support additional provider protocols,
 * external APIs, database engines, or specialized MCP services without modifying use cases.
 */
export interface IMcpProviderAdapter {
  readonly adapterId: string;
  supports(provider: McpProvider): boolean;
  healthCheck(ctx: ProviderExecutionContext): Promise<{ healthy: boolean; details?: Record<string, any> }>;
  listTools(ctx: ProviderExecutionContext): Promise<McpToolSpec[]>;
  callTool(ctx: ProviderExecutionContext, toolName: string, args: Record<string, any>): Promise<McpCallResult>;
  listResources?(ctx: ProviderExecutionContext): Promise<McpResourceSpec[]>;
  readResource?(ctx: ProviderExecutionContext, uri: string): Promise<McpResourceContent[]>;
  listPrompts?(ctx: ProviderExecutionContext): Promise<McpPromptSpec[]>;
  getPrompt?(ctx: ProviderExecutionContext, name: string, args?: Record<string, string>): Promise<McpPromptResult>;
}

