import { IExternalApiPort, INotificationGatewayPort } from '../../application/ports/internal-services.port.js';
import { McpCallResult, McpToolSpec } from '../../application/ports/mcp-client.port.js';
import { IMcpProviderAdapter, ProviderExecutionContext } from '../../application/ports/provider-adapter.port.js';
import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';
import { applyAuthHeaders } from './external-api-mcp.adapter.js';

export class CommunicationMcpAdapter implements IMcpProviderAdapter {
  readonly adapterId = 'communication-mcp-adapter';

  constructor(
    private readonly notificationGateway: INotificationGatewayPort,
    private readonly apiClient: IExternalApiPort
  ) {}

  supports(provider: McpProvider): boolean {
    return (
      provider.category === 'COMMUNICATION' &&
      (provider.transportType === 'INTERNAL' || provider.transportType === 'REST_API')
    );
  }

  async healthCheck(ctx: ProviderExecutionContext): Promise<{ healthy: boolean; details?: Record<string, any> }> {
    if (ctx.provider.transportType === 'REST_API' && ctx.provider.endpointUrl) {
      return { healthy: true, details: { endpointUrl: ctx.provider.endpointUrl, mode: 'external-comm-api' } };
    }
    try {
      await this.notificationGateway.list(1);
      return { healthy: true, details: { backend: 'notification-service:grpc' } };
    } catch (err: any) {
      return { healthy: false, details: { backend: 'notification-service:grpc', error: err.message } };
    }
  }

  async listTools(ctx: ProviderExecutionContext): Promise<McpToolSpec[]> {
    if (ctx.provider.transportType === 'REST_API') {
      return [
        {
          name: 'dispatch_message',
          description: `Send a communication message via external provider '${ctx.provider.name}'`,
          inputSchema: {
            type: 'object',
            properties: {
              recipient: { type: 'string' },
              subject: { type: 'string' },
              body: { type: 'string' },
              payload: { type: 'object', additionalProperties: true }
            },
            required: ['body']
          }
        }
      ];
    }

    return [
      {
        name: 'send_notification',
        description: 'Send a notification (EMAIL, SMS, PUSH, WEBHOOK) through platform notification-service.',
        inputSchema: {
          type: 'object',
          properties: {
            recipient: { type: 'string' },
            channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'WEBHOOK'], default: 'EMAIL' },
            subject: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['recipient', 'channel', 'subject', 'body']
        }
      },
      {
        name: 'send_multi_channel',
        description:
          'Dispatch a message across multiple communication channels (EMAIL, SMS, PUSH, WEBHOOK) and optional external webhook URLs in parallel.',
        inputSchema: {
          type: 'object',
          properties: {
            recipients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  recipient: { type: 'string' },
                  channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'WEBHOOK'] }
                },
                required: ['recipient', 'channel']
              }
            },
            subject: { type: 'string' },
            body: { type: 'string' },
            externalWebhooks: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional external Slack/Teams/Discord/custom webhook URLs'
            }
          },
          required: ['subject', 'body']
        }
      },
      {
        name: 'list_notifications',
        description: 'Retrieve recent notification dispatch logs from notification-service.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 20 }
          }
        }
      },
      {
        name: 'dispatch_webhook',
        description: 'Send a structured message payload to an external communication webhook (Slack, Teams, Discord, Twilio, SendGrid).',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            payload: { type: 'object', additionalProperties: true },
            headers: { type: 'object', additionalProperties: { type: 'string' } }
          },
          required: ['url', 'payload']
        }
      }
    ];
  }

  async callTool(ctx: ProviderExecutionContext, toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    if (ctx.provider.transportType === 'REST_API' && toolName === 'dispatch_message') {
      if (!ctx.provider.endpointUrl) {
        throw new Error(`Communication provider '${ctx.provider.slug}' requires endpointUrl`);
      }
      const headers = applyAuthHeaders(
        ctx.provider.config?.defaultHeaders || {},
        ctx.provider.authType,
        ctx.credentials
      );
      const payload = args.payload || {
        recipient: args.recipient,
        subject: args.subject,
        text: args.body,
        body: args.body
      };
      const res = await this.apiClient.request({
        url: ctx.provider.endpointUrl,
        method: (ctx.provider.config?.method || 'POST') as any,
        headers,
        body: payload
      });
      return {
        isError: !res.ok,
        content: [{ type: 'json', data: res.data }],
        structuredContent: { status: res.status, ok: res.ok, response: res.data }
      };
    }

    if (toolName === 'send_notification') {
      const sent = await this.notificationGateway.send({
        recipient: args.recipient,
        channel: (args.channel || 'EMAIL') as 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK',
        subject: args.subject,
        body: args.body
      });
      return {
        isError: false,
        content: [{ type: 'json', data: sent }],
        structuredContent: sent
      };
    }

    if (toolName === 'list_notifications') {
      const items = await this.notificationGateway.list(args.limit || 20);
      return {
        isError: false,
        content: [{ type: 'json', data: items }],
        structuredContent: { count: items.length, items }
      };
    }

    if (toolName === 'dispatch_webhook') {
      const res = await this.apiClient.request({
        url: args.url,
        method: 'POST',
        headers: args.headers || {},
        body: args.payload
      });
      return {
        isError: !res.ok,
        content: [{ type: 'json', data: res.data }],
        structuredContent: { status: res.status, ok: res.ok, response: res.data }
      };
    }

    if (toolName === 'send_multi_channel') {
      const recipients: Array<{ recipient: string; channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK' }> =
        Array.isArray(args.recipients) ? args.recipients : [];
      const webhooks: string[] = Array.isArray(args.externalWebhooks) ? args.externalWebhooks : [];

      const internalPromises = recipients.map(async target => {
        try {
          const res = await this.notificationGateway.send({
            recipient: target.recipient,
            channel: target.channel,
            subject: args.subject,
            body: args.body
          });
          return { target, status: 'SENT', result: res };
        } catch (err: any) {
          return { target, status: 'FAILED', error: err.message };
        }
      });

      const webhookPromises = webhooks.map(async url => {
        try {
          const res = await this.apiClient.request({
            url,
            method: 'POST',
            body: { subject: args.subject, text: args.body, body: args.body }
          });
          return { url, status: res.ok ? 'SENT' : 'FAILED', httpStatus: res.status };
        } catch (err: any) {
          return { url, status: 'FAILED', error: err.message };
        }
      });

      const [internalResults, webhookResults] = await Promise.all([
        Promise.all(internalPromises),
        Promise.all(webhookPromises)
      ]);

      const anyFailed =
        internalResults.some(r => r.status === 'FAILED') || webhookResults.some(r => r.status === 'FAILED');

      const summary = {
        internalDeliveries: internalResults,
        webhookDeliveries: webhookResults
      };

      return {
        isError: anyFailed && internalResults.length + webhookResults.length > 0 &&
          internalResults.every(r => r.status === 'FAILED') && webhookResults.every(r => r.status === 'FAILED'),
        content: [{ type: 'json', data: summary }],
        structuredContent: summary
      };
    }

    throw new Error(`Unknown communication tool '${toolName}'`);
  }
}

