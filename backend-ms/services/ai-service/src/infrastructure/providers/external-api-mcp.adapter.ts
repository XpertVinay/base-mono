import net from 'node:net';
import {
  ExternalHttpRequest,
  ExternalHttpResponse,
  IExternalApiPort
} from '../../application/ports/internal-services.port.js';
import { DecryptedProviderCredentials, McpCallResult, McpToolSpec } from '../../application/ports/mcp-client.port.js';
import { IMcpProviderAdapter, ProviderExecutionContext } from '../../application/ports/provider-adapter.port.js';
import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';
import { McpAuthType } from '../../shared/contracts/index.js';

function isPrivateOrLoopbackIp(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '::1' || lower.endsWith('.local')) {
    return true;
  }
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) {
    const parts = hostname.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  if (ipVersion === 6) {
    if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

export class ExternalApiClient implements IExternalApiPort {
  async request(req: ExternalHttpRequest): Promise<ExternalHttpResponse> {
    const parsedUrl = new URL(req.url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Unsupported protocol '${parsedUrl.protocol}'. Only http/https are allowed.`);
    }

    if (process.env.MCP_BLOCK_PRIVATE_IPS === 'true' && isPrivateOrLoopbackIp(parsedUrl.hostname)) {
      throw new Error(`Blocked request to private/loopback host '${parsedUrl.hostname}'`);
    }

    if (req.query) {
      for (const [k, v] of Object.entries(req.query)) {
        if (v !== undefined && v !== null) {
          parsedUrl.searchParams.set(k, String(v));
        }
      }
    }

    const method = (req.method || 'GET').toUpperCase();
    const timeoutMs = req.timeoutMs || parseInt(process.env.MCP_REQUEST_TIMEOUT_MS || '15000', 10);
    const maxRetries = Math.max(0, Math.min(req.retries ?? 1, 3));

    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      ...(req.headers || {})
    };

    let bodyStr: string | undefined;
    if (req.body !== undefined && req.body !== null && method !== 'GET' && method !== 'HEAD') {
      if (typeof req.body === 'string') {
        bodyStr = req.body;
      } else {
        bodyStr = JSON.stringify(req.body);
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(parsedUrl.toString(), {
          method,
          headers,
          body: bodyStr,
          signal: controller.signal
        });
        clearTimeout(timer);

        const durationMs = Date.now() - started;
        const respHeaders: Record<string, string> = {};
        response.headers.forEach((val, key) => {
          respHeaders[key] = val;
        });

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        let data: any;
        if (contentType.includes('application/json')) {
          data = await response.json().catch(() => null);
        } else {
          const text = await response.text().catch(() => '');
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }

        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 150 * Math.pow(2, attempt)));
          continue;
        }

        return {
          status: response.status,
          ok: response.ok,
          headers: respHeaders,
          data,
          durationMs
        };
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 150 * Math.pow(2, attempt)));
          continue;
        }
      }
    }

    throw lastError || new Error(`External API request failed for ${parsedUrl.toString()}`);
  }
}

export function applyAuthHeaders(
  baseHeaders: Record<string, string>,
  authType: McpAuthType,
  credentials?: DecryptedProviderCredentials
): Record<string, string> {
  const merged: Record<string, string> = { ...baseHeaders };
  if (!credentials) return merged;

  if (authType === 'BEARER' && credentials.bearerToken) {
    merged['Authorization'] = `Bearer ${credentials.bearerToken}`;
  } else if (authType === 'API_KEY' && credentials.apiKey) {
    merged[credentials.apiKeyHeader || 'x-api-key'] = credentials.apiKey;
  } else if (authType === 'BASIC' && credentials.username) {
    const encoded = Buffer.from(`${credentials.username}:${credentials.password || ''}`).toString('base64');
    merged['Authorization'] = `Basic ${encoded}`;
  }

  if (credentials.headers) {
    for (const [k, v] of Object.entries(credentials.headers)) {
      merged[k] = v;
    }
  }

  return merged;
}

export interface ExternalApiOperationConfig {
  name: string;
  description?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  inputSchema?: Record<string, any>;
}

export class ExternalApiMcpAdapter implements IMcpProviderAdapter {
  readonly adapterId = 'external-api-mcp-adapter';

  constructor(private readonly apiClient: IExternalApiPort) {}

  supports(provider: McpProvider): boolean {
    return (
      provider.transportType === 'REST_API' ||
      (provider.category === 'EXTERNAL_API' && provider.transportType === 'INTERNAL')
    );
  }

  async healthCheck(ctx: ProviderExecutionContext): Promise<{ healthy: boolean; details?: Record<string, any> }> {
    if (!ctx.provider.endpointUrl) {
      return { healthy: true, details: { mode: 'dynamic-url-caller' } };
    }
    const healthPath = ctx.provider.config?.healthPath || '';
    const url = healthPath ? new URL(healthPath, ctx.provider.endpointUrl).toString() : ctx.provider.endpointUrl;
    try {
      const headers = applyAuthHeaders(ctx.provider.config?.defaultHeaders || {}, ctx.provider.authType, ctx.credentials);
      const res = await this.apiClient.request({
        url,
        method: 'GET',
        headers,
        timeoutMs: 5000,
        retries: 0
      });
      return { healthy: res.status < 500, details: { status: res.status, durationMs: res.durationMs } };
    } catch (err: any) {
      return { healthy: false, details: { error: err.message } };
    }
  }

  async listTools(ctx: ProviderExecutionContext): Promise<McpToolSpec[]> {
    const tools: McpToolSpec[] = [
      {
        name: 'call_endpoint',
        description: 'Invoke an external REST/HTTP API endpoint with optional auth, query params, headers, and JSON body.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Full URL or relative path when provider endpointUrl is configured' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
            query: { type: 'object', additionalProperties: true },
            headers: { type: 'object', additionalProperties: { type: 'string' } },
            body: { description: 'JSON or string request payload' },
            timeoutMs: { type: 'number' },
            retries: { type: 'number' }
          },
          required: ['url']
        }
      },
      {
        name: 'graphql_query',
        description: 'Execute a GraphQL query or mutation against an external GraphQL API endpoint.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            query: { type: 'string' },
            variables: { type: 'object', additionalProperties: true },
            operationName: { type: 'string' },
            headers: { type: 'object', additionalProperties: { type: 'string' } }
          },
          required: ['query']
        }
      }
    ];

    const configuredOps = (ctx.provider.config?.operations || []) as ExternalApiOperationConfig[];
    for (const op of configuredOps) {
      if (!op?.name || !op?.path) continue;
      tools.push({
        name: op.name,
        description: op.description || `External API operation ${op.method || 'GET'} ${op.path}`,
        inputSchema: op.inputSchema || {
          type: 'object',
          properties: {
            pathParams: { type: 'object', additionalProperties: { type: 'string' } },
            query: { type: 'object', additionalProperties: true },
            body: {}
          }
        }
      });
    }

    return tools;
  }

  async callTool(ctx: ProviderExecutionContext, toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    const defaultHeaders = applyAuthHeaders(
      ctx.provider.config?.defaultHeaders || {},
      ctx.provider.authType,
      ctx.credentials
    );

    if (toolName === 'call_endpoint') {
      const targetUrl = this.resolveUrl(ctx.provider.endpointUrl, args.url);
      const res = await this.apiClient.request({
        url: targetUrl,
        method: args.method || 'GET',
        headers: { ...defaultHeaders, ...(args.headers || {}) },
        query: args.query,
        body: args.body,
        timeoutMs: args.timeoutMs,
        retries: args.retries
      });

      return {
        isError: !res.ok,
        content: [{ type: 'json', data: res.data }],
        structuredContent: {
          status: res.status,
          ok: res.ok,
          durationMs: res.durationMs,
          data: res.data
        }
      };
    }

    if (toolName === 'graphql_query') {
      const targetUrl = this.resolveUrl(ctx.provider.endpointUrl, args.url || '');
      const res = await this.apiClient.request({
        url: targetUrl,
        method: 'POST',
        headers: { ...defaultHeaders, ...(args.headers || {}) },
        body: {
          query: args.query,
          variables: args.variables,
          operationName: args.operationName
        }
      });

      const hasGraphqlErrors = Array.isArray(res.data?.errors) && res.data.errors.length > 0;
      return {
        isError: !res.ok || hasGraphqlErrors,
        content: [{ type: 'json', data: res.data }],
        structuredContent: res.data
      };
    }

    const configuredOps = (ctx.provider.config?.operations || []) as ExternalApiOperationConfig[];
    const matchedOp = configuredOps.find(op => op.name === toolName);
    if (!matchedOp) {
      throw new Error(`Unknown tool '${toolName}' on external API provider '${ctx.provider.slug}'`);
    }

    let resolvedPath = matchedOp.path;
    const pathParams = args.pathParams || args;
    resolvedPath = resolvedPath.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, key) => {
      const val = pathParams?.[key];
      return val !== undefined ? encodeURIComponent(String(val)) : `{${key}}`;
    });

    const targetUrl = this.resolveUrl(ctx.provider.endpointUrl, resolvedPath);
    const res = await this.apiClient.request({
      url: targetUrl,
      method: matchedOp.method || 'GET',
      headers: { ...defaultHeaders, ...(args.headers || {}) },
      query: args.query,
      body: args.body
    });

    return {
      isError: !res.ok,
      content: [{ type: 'json', data: res.data }],
      structuredContent: {
        status: res.status,
        ok: res.ok,
        durationMs: res.durationMs,
        data: res.data
      }
    };
  }

  private resolveUrl(baseUrl: string | undefined, pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }
    if (!baseUrl) {
      throw new Error('A full http/https URL is required when provider endpointUrl is not configured');
    }
    return new URL(pathOrUrl, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  }
}

