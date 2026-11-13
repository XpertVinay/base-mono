import { McpAuthType, McpContentBlock, McpTransportType } from '../../shared/contracts/index.js';

export interface McpServerCapabilities {
  tools?: Record<string, any>;
  resources?: Record<string, any>;
  prompts?: Record<string, any>;
  logging?: Record<string, any>;
  [key: string]: any;
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
  instructions?: string;
}

export interface McpToolSpec {
  name: string;
  description?: string;
  inputSchema: Record<string, any>;
  annotations?: Record<string, any>;
}

export interface McpCallResult {
  isError: boolean;
  content: McpContentBlock[];
  structuredContent?: any;
  meta?: Record<string, any>;
}

export interface McpResourceSpec {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface McpPromptSpec {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface McpPromptResult {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: McpContentBlock;
  }>;
}

export interface DecryptedProviderCredentials {
  bearerToken?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
  connectionString?: string;
  env?: Record<string, string>;
}

export interface McpConnectionConfig {
  providerId: string;
  providerSlug: string;
  tenantId: string;
  transportType: McpTransportType;
  endpointUrl?: string;
  command?: string;
  args?: string[];
  authType: McpAuthType;
  credentials?: DecryptedProviderCredentials;
  config?: Record<string, any>;
  timeoutMs?: number;
  updatedAt?: string;
}

export interface IMcpClient {
  readonly serverInfo?: { name: string; version: string };
  readonly capabilities?: McpServerCapabilities;
  connect(): Promise<McpInitializeResult>;
  ping(): Promise<boolean>;
  listTools(): Promise<McpToolSpec[]>;
  callTool(name: string, args: Record<string, any>): Promise<McpCallResult>;
  listResources(): Promise<McpResourceSpec[]>;
  readResource(uri: string): Promise<McpResourceContent[]>;
  listPrompts(): Promise<McpPromptSpec[]>;
  getPrompt(name: string, args?: Record<string, string>): Promise<McpPromptResult>;
  close(): Promise<void>;
}

export interface IMcpClientManager {
  getClient(config: McpConnectionConfig): Promise<IMcpClient>;
  evictClient(tenantId: string, providerId: string): Promise<void>;
  closeAll(): Promise<void>;
}

