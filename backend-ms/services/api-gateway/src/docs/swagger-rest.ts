import { commonSchemas } from './swagger-schemas.js';

const envelopedData = (schema: Record<string, any>) => ({
  allOf: [
    { $ref: '#/components/schemas/StandardResponse' },
    {
      type: 'object',
      properties: {
        data: schema
      }
    }
  ]
});

const standardErrorContent = {
  'application/json': {
    schema: { $ref: '#/components/schemas/StandardErrorResponse' }
  }
};

const middlewareErrorContent = {
  'application/json': {
    schema: { $ref: '#/components/schemas/MiddlewareErrorResponse' }
  }
};

const auth401Response = {
  description: 'Unauthorized - missing, expired, or invalid JWT bearer token',
  content: {
    'application/json': {
      schema: {
        oneOf: [
          { $ref: '#/components/schemas/MiddlewareErrorResponse' },
          { $ref: '#/components/schemas/StandardErrorResponse' }
        ]
      }
    }
  }
};

const forbidden403Response = {
  description: 'Forbidden - insufficient role permissions for this resource',
  content: middlewareErrorContent
};

const rateLimit429Response = {
  description: 'Too Many Requests - rate limit threshold exceeded (see Retry-After and X-RateLimit-* headers)',
  content: middlewareErrorContent
};

export const swaggerRestDoc = {
  openapi: '3.0.3',
  info: {
    title: 'Enterprise Microservices Platform - HTTP REST API',
    version: '1.0.0',
    description: `Production-grade Domain-Driven Design (DDD) Microservices HTTP REST API.

### Routing & Versioning
- **Primary Versioned Prefix**: \`/api/v1/*\` (recommended for all clients)
- **Backwards-Compatible Unversioned Aliases**: \`/api/*\` routes are proxied identically to each downstream microservice
- **OpenAPI JSON Specs**: \`/api-docs/openapi.json\` (or \`/api/v1/openapi.json\`), \`/api-docs/rest.json\`, \`/api-docs/grpc.json\`
- **Correlation Tracing**: Pass \`x-correlation-id\` or \`x-request-id\` to trace requests across HTTP, gRPC, and RabbitMQ

### Standard Response Envelope
All controller and error-handler responses strictly conform to the unified standard envelope format:
\`\`\`json
{
  "status": true | false,
  "message": "Success or error message",
  "data": { ... },
  "errors": [],
  "meta_data": {
    "requestId": "req-...",
    "timestamp": "ISO-8601",
    "debug": { "service": "...", "env": "..." },
    "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 },
    "further_steps": ["..."]
  }
}
\`\`\`
*(Note: Middleware rejections for 401/403/429 return \`{ "success": false, "error": { "code", "message" } }\`; Prometheus \`/metrics\` returns \`text/plain\`; Grafana \`/api/v1/audit/grafana/annotations\` returns a raw JSON array.)*
`,
    contact: {
      name: 'Platform Engineering Team',
      email: 'dev@enterprise.local'
    }
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'API Gateway (Central Entry Point)'
    },
    {
      url: 'http://localhost:4001',
      description: 'IAM Service (Direct)'
    },
    {
      url: 'http://localhost:4002',
      description: 'Asset Service (Direct)'
    },
    {
      url: 'http://localhost:4003',
      description: 'Config Service (Direct)'
    },
    {
      url: 'http://localhost:4004',
      description: 'Notification Service (Direct)'
    },
    {
      url: 'http://localhost:4005',
      description: 'Scheduler Service (Direct)'
    },
    {
      url: 'http://localhost:4006',
      description: 'Order Service (Direct)'
    },
    {
      url: 'http://localhost:4007',
      description: 'Transaction Service (Direct)'
    },
    {
      url: 'http://localhost:4008',
      description: 'Search Service (Direct)'
    },
    {
      url: 'http://localhost:4009',
      description: 'Inventory Service (Direct)'
    },
    {
      url: 'http://localhost:4010',
      description: 'AI & MCP Integration Service (Direct)'
    },
    {
      url: 'http://localhost:4011',
      description: 'Audit Service (Direct)'
    }
  ],
  tags: [
    { name: 'Gateway Health', description: 'API Gateway discovery, health probes, and downstream aggregation monitoring' },
    { name: 'IAM Service', description: 'Authentication, registration, JWT issuance, and RBAC' },
    { name: 'Order Service', description: 'Order lifecycle, inventory validation via gRPC, and checkout totals' },
    { name: 'Inventory Service', description: 'Stock tracking, reservations, and inventory ingestion' },
    { name: 'Transaction Service', description: 'Payment processing, dynamic gateway resolution via gRPC, and webhooks' },
    { name: 'Config Service', description: 'Dynamic system configuration and payment provider toggles' },
    { name: 'Asset Service', description: 'Media storage paths, file registry, and asset metadata' },
    { name: 'Notification Service', description: 'Multi-channel dispatch (Email, SMS, Push, Webhooks)' },
    { name: 'Scheduler Service', description: 'Distributed cron execution and periodic jobs' },
    { name: 'Search Service', description: 'Full-text indexed search queries across projected domain entities' },
    { name: 'AI & MCP Service', description: 'MCP client, provider registry, communication/search/DB/external API tools & orchestration' },
    { name: 'Audit Service', description: 'Immutable audit logs, telemetry alerts, remediation, and monitoring adapters' }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT accessToken issued by POST /api/v1/iam/login.'
      }
    },
    schemas: {
      ...commonSchemas,

      // Gateway Discovery & Health schemas
      ApiDiscoveryData: {
        type: 'object',
        properties: {
          currentVersion: { type: 'string', example: 'v1' },
          supportedVersions: { type: 'array', items: { type: 'string' }, example: ['v1'] },
          endpoints: {
            type: 'object',
            properties: {
              v1: { type: 'string', example: '/api/v1' },
              health: { type: 'string', example: '/api/v1/health' },
              detailedHealth: { type: 'string', example: '/api/v1/health/detailed' },
              docs: { type: 'string', example: '/api-docs' }
            }
          }
        }
      },
      ApiV1DirectoryData: {
        type: 'object',
        properties: {
          version: { type: 'string', example: 'v1' },
          health: { type: 'string', example: '/api/v1/health' },
          detailedHealth: { type: 'string', example: '/api/v1/health/detailed' },
          docs: { type: 'string', example: '/api-docs' },
          services: {
            type: 'object',
            additionalProperties: { type: 'string' },
            example: {
              iam: '/api/v1/iam',
              assets: '/api/v1/assets',
              config: '/api/v1/config',
              notifications: '/api/v1/notifications',
              scheduler: '/api/v1/scheduler',
              orders: '/api/v1/orders',
              transactions: '/api/v1/transactions',
              search: '/api/v1/search',
              inventory: '/api/v1/inventory',
              audit: '/api/v1/audit'
            }
          }
        }
      },
      GatewayHealthData: {
        type: 'object',
        properties: {
          gateway: { type: 'string', example: 'api-gateway' },
          version: { type: 'string', example: 'v1' },
          status: { type: 'string', example: 'UP' },
          uptimeSeconds: { type: 'integer', example: 3600 },
          timestamp: { type: 'string', format: 'date-time', example: '2026-10-16T10:30:00.000Z' }
        }
      },
      ServiceHealthStatus: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['UP', 'DEGRADED', 'DOWN'], example: 'UP' },
          latencyMs: { type: 'number', example: 4 },
          error: { type: 'string' }
        }
      },
      DetailedHealthData: {
        type: 'object',
        properties: {
          gateway: { type: 'string', example: 'api-gateway' },
          version: { type: 'string', example: 'v1' },
          services: {
            type: 'object',
            additionalProperties: { $ref: '#/components/schemas/ServiceHealthStatus' }
          }
        }
      },

      // IAM schemas
      RegisterUserRequest: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255, example: 'user@example.com' },
          password: { type: 'string', minLength: 8, maxLength: 128, example: 'SuperSecurePassword123!' },
          name: { type: 'string', minLength: 2, maxLength: 100, example: 'Alice Smith' },
          tenantId: { type: 'string', example: 'default', description: 'Optional tenant identifier (or via x-tenant-id header)' },
          tenantSlug: { type: 'string', example: 'acme', description: 'Optional tenant slug (or via x-tenant-slug header)' },
          role: {
            type: 'string',
            enum: ['USER', 'ADMIN', 'SUPPORT'],
            default: 'USER',
            example: 'USER',
            description: 'In production, public registration forces USER unless authenticated as ADMIN'
          }
        }
      },
      LoginUserRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255, example: 'user@example.com' },
          password: { type: 'string', minLength: 1, maxLength: 128, example: 'SuperSecurePassword123!' },
          tenantId: { type: 'string', example: 'default' },
          tenantSlug: { type: 'string', example: 'acme' }
        }
      },
      IamUserData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          tenantId: { type: 'string', example: 'default' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          name: { type: 'string', example: 'Alice Smith' },
          role: { type: 'string', enum: ['USER', 'ADMIN', 'SUPPORT'], example: 'USER' },
          authMethod: { type: 'string', enum: ['LOCAL', 'OIDC', 'HYBRID'], example: 'LOCAL' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      AuthTokensData: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          expiresIn: { type: 'integer', example: 3600, description: 'Access token TTL in seconds' },
          tokenType: { type: 'string', example: 'Bearer' },
          tenantId: { type: 'string', example: 'default' },
          tenantSlug: { type: 'string', example: 'default' },
          authMethod: { type: 'string', example: 'OIDC' },
          provider: { type: 'string', example: 'google' }
        }
      },
      TenantConfigData: {
        type: 'object',
        properties: {
          allowLocalLogin: { type: 'boolean', example: true },
          allowFederatedLogin: { type: 'boolean', example: true },
          autoProvisionUsers: { type: 'boolean', example: true },
          defaultRole: { type: 'string', enum: ['USER', 'ADMIN', 'SUPPORT'], example: 'USER' },
          allowedEmailDomains: { type: 'array', items: { type: 'string' }, example: ['acme.com'] },
          sessionTtlSeconds: { type: 'integer', example: 3600 }
        }
      },
      TenantData: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'acme' },
          slug: { type: 'string', example: 'acme' },
          name: { type: 'string', example: 'Acme Corp' },
          isActive: { type: 'boolean', example: true },
          config: { $ref: '#/components/schemas/TenantConfigData' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      OidcProviderCreateRequest: {
        type: 'object',
        required: ['slug', 'providerType', 'displayName', 'issuerUrl', 'clientId', 'redirectUri'],
        properties: {
          tenantId: { type: 'string', example: 'acme' },
          slug: { type: 'string', example: 'google' },
          providerType: { type: 'string', enum: ['GENERIC_OIDC', 'GOOGLE', 'ENTRA_ID', 'OKTA', 'KEYCLOAK', 'MOCK'] },
          displayName: { type: 'string', example: 'Google Workspace SSO' },
          issuerUrl: { type: 'string', example: 'https://accounts.google.com' },
          authorizationEndpoint: { type: 'string' },
          tokenEndpoint: { type: 'string' },
          userinfoEndpoint: { type: 'string' },
          jwksUri: { type: 'string' },
          clientId: { type: 'string', example: 'client-id-123' },
          clientSecret: { type: 'string', example: 'client-secret-xyz' },
          redirectUri: { type: 'string', example: 'http://localhost:4000/api/v1/iam/oidc/google/callback' },
          scopes: { type: 'string', example: 'openid profile email' },
          usePkce: { type: 'boolean', default: true },
          autoProvision: { type: 'boolean', default: true },
          allowedDomains: { type: 'array', items: { type: 'string' }, example: ['acme.com'] },
          roleMapping: { type: 'object', additionalProperties: { type: 'string' }, example: { 'Acme-Admins': 'ADMIN' } }
        }
      },

      // Order schemas
      OrderItemInput: {
        type: 'object',
        required: ['productId', 'productName', 'quantity', 'unitPrice'],
        properties: {
          productId: { type: 'string', minLength: 1, example: 'prod-1' },
          productName: { type: 'string', minLength: 1, example: 'Mechanical Keyboard' },
          quantity: { type: 'integer', minimum: 1, example: 2 },
          unitPrice: { type: 'number', minimum: 0.01, example: 129.99 }
        }
      },
      OrderItemData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '7b9a1f10-4c6c-4a30-8c1a-1f9a2b3c4d5e' },
          productId: { type: 'string', example: 'prod-1' },
          productName: { type: 'string', example: 'Mechanical Keyboard' },
          quantity: { type: 'integer', example: 2 },
          unitPrice: { type: 'number', example: 129.99 },
          totalPrice: { type: 'number', example: 259.98 }
        }
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: { $ref: '#/components/schemas/OrderItemInput' }
          },
          currency: { type: 'string', default: 'USD', example: 'USD' }
        }
      },
      OrderResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'ord-a1b2c3d4-e5f6' },
          userId: { type: 'string', format: 'uuid', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          status: {
            type: 'string',
            enum: ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'CANCELLED'],
            example: 'PENDING'
          },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItemData' }
          },
          totalAmount: { type: 'number', example: 259.98 },
          currency: { type: 'string', example: 'USD' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },

      // Inventory schemas
      AddStockRequest: {
        type: 'object',
        required: ['productId', 'sku', 'quantity'],
        properties: {
          productId: { type: 'string', minLength: 1, example: 'prod-1' },
          sku: { type: 'string', minLength: 1, example: 'PROD-SKU-001' },
          quantity: { type: 'integer', minimum: 1, example: 50 }
        }
      },
      ReserveStockRequest: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string', minLength: 1, example: 'prod-1' },
          quantity: { type: 'integer', minimum: 1, example: 2 }
        }
      },
      InventoryItemData: {
        type: 'object',
        properties: {
          productId: { type: 'string', example: 'prod-1' },
          sku: { type: 'string', example: 'PROD-SKU-001' },
          availableQuantity: { type: 'integer', example: 98 },
          reservedQuantity: { type: 'integer', example: 2 },
          totalQuantity: { type: 'integer', example: 100 },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },

      // Transaction schemas
      InitiatePaymentRequest: {
        type: 'object',
        required: ['referenceId', 'amount'],
        properties: {
          referenceId: { type: 'string', minLength: 1, example: 'ord-a1b2c3d4-e5f6', description: 'Order ID or checkout reference' },
          amount: { type: 'number', minimum: 0.01, example: 259.98 },
          currency: { type: 'string', default: 'USD', example: 'USD' },
          paymentMethod: { type: 'string', example: 'CARD' }
        }
      },
      PaymentWebhookRequest: {
        type: 'object',
        required: ['transactionId', 'status'],
        properties: {
          transactionId: { type: 'string', minLength: 1, example: 'txn-101' },
          status: { type: 'string', enum: ['SUCCESS', 'FAILED'], example: 'SUCCESS' },
          providerTxnId: { type: 'string', example: 'ch_3N4yAb2eZvKYlo2C0Wxyz' },
          failureReason: { type: 'string', example: 'Insufficient funds' }
        }
      },
      TransactionResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'txn-a1b2c3d4-e5f6' },
          referenceId: { type: 'string', example: 'ord-a1b2c3d4-e5f6' },
          userId: { type: 'string', format: 'uuid', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          type: { type: 'string', enum: ['PAYMENT', 'REFUND', 'TRANSFER'], example: 'PAYMENT' },
          status: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'], example: 'PENDING' },
          amount: { type: 'number', example: 259.98 },
          currency: { type: 'string', example: 'USD' },
          paymentMethod: { type: 'string', example: 'CARD' },
          failureReason: { type: 'string', nullable: true },
          provider: { type: 'string', example: 'STRIPE' },
          providerSessionId: { type: 'string', example: 'cs_test_123456' },
          providerTransactionId: { type: 'string', nullable: true },
          redirectUrl: { type: 'string', format: 'uri', example: 'https://checkout.stripe.com/pay/cs_test_123456' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },

      // Config schemas
      SetConfigRequest: {
        type: 'object',
        required: ['key', 'value'],
        properties: {
          key: { type: 'string', minLength: 1, example: 'ACTIVE_PAYMENT_GATEWAY' },
          value: { type: 'string', example: 'STRIPE' },
          description: { type: 'string', example: 'Global payment gateway selector (STRIPE, PAYPAL, RAZORPAY, MOCK)' },
          isEncrypted: { type: 'boolean', default: false, example: false }
        }
      },
      ConfigSettingData: {
        type: 'object',
        properties: {
          key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
          value: { type: 'string', example: 'STRIPE' },
          description: { type: 'string', nullable: true, example: 'Active payment processor gateway' },
          isEncrypted: { type: 'boolean', example: false },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      DeleteConfigData: {
        type: 'object',
        properties: {
          deleted: { type: 'boolean', example: true },
          key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' }
        }
      },

      // Asset schemas
      CreateAssetRequest: {
        type: 'object',
        required: ['name', 'mimeType', 'sizeBytes', 'storagePath'],
        properties: {
          name: { type: 'string', minLength: 1, example: 'product-hero.webp' },
          mimeType: { type: 'string', example: 'image/webp' },
          sizeBytes: { type: 'integer', minimum: 1, example: 245100 },
          storagePath: { type: 'string', minLength: 1, example: '/assets/uploads/product-hero.webp' }
        }
      },
      AssetResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'product-hero.webp' },
          mimeType: { type: 'string', example: 'image/webp' },
          sizeBytes: { type: 'integer', example: 245100 },
          storagePath: { type: 'string', example: '/assets/uploads/product-hero.webp' },
          ownerId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },

      // Notification schemas
      SendNotificationRequest: {
        type: 'object',
        required: ['recipient', 'channel', 'subject', 'body'],
        properties: {
          recipient: { type: 'string', minLength: 1, example: 'alice@example.com' },
          channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'WEBHOOK'], example: 'EMAIL' },
          subject: { type: 'string', minLength: 1, example: 'Your Order #ord-a1b2c3d4 is Confirmed' },
          body: { type: 'string', minLength: 1, example: 'Thank you for your order! We are packing your items.' }
        }
      },
      NotificationResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          recipient: { type: 'string', example: 'alice@example.com' },
          channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'WEBHOOK'], example: 'EMAIL' },
          subject: { type: 'string', example: 'Your Order #ord-a1b2c3d4 is Confirmed' },
          body: { type: 'string', example: 'Thank you for your order! We are packing your items.' },
          status: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'], example: 'SENT' },
          sentAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },

      // Scheduler schemas
      CreateJobRequest: {
        type: 'object',
        required: ['name', 'cronExpression'],
        properties: {
          name: { type: 'string', minLength: 1, example: 'daily-reconciliation-job' },
          cronExpression: { type: 'string', minLength: 1, example: '0 0 * * *' }
        }
      },
      JobResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'job-heartbeat-1' },
          name: { type: 'string', example: 'SYSTEM_HEARTBEAT' },
          cronExpression: { type: 'string', example: '*/5 * * * *' },
          status: { type: 'string', enum: ['SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'], example: 'SCHEDULED' },
          lastRunAt: { type: 'string', format: 'date-time', nullable: true },
          nextRunAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },

      // Search schemas
      SearchResultItemData: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ord-a1b2c3d4' },
          type: { type: 'string', enum: ['ORDER', 'USER'], example: 'ORDER' },
          title: { type: 'string', example: 'Order #ord-a1b2' },
          description: { type: 'string', nullable: true, example: 'Order totaling USD 259.98' },
          metadata: { type: 'object', nullable: true, additionalProperties: true }
        }
      },

      // Audit & Telemetry schemas
      RecordAuditRequest: {
        type: 'object',
        required: ['action', 'resource'],
        properties: {
          actorId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          actorEmail: { type: 'string', example: 'admin@enterprise.local' },
          action: { type: 'string', minLength: 1, example: 'CONFIG_UPDATED' },
          resource: { type: 'string', minLength: 1, example: 'SystemConfig' },
          resourceId: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
          severity: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'], default: 'INFO' },
          details: { type: 'object', additionalProperties: true, example: { changedFrom: 'STRIPE', changedTo: 'PAYPAL' } },
          ipAddress: { type: 'string', example: '127.0.0.1' },
          correlationId: { type: 'string', example: 'req-c7f8a9e1' }
        }
      },
      AuditLogData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          actorId: { type: 'string', nullable: true },
          actorEmail: { type: 'string', nullable: true },
          action: { type: 'string', example: 'CONFIG_UPDATED' },
          resource: { type: 'string', example: 'SystemConfig' },
          resourceId: { type: 'string', nullable: true },
          severity: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'] },
          details: { type: 'object', nullable: true, additionalProperties: true },
          ipAddress: { type: 'string', nullable: true },
          correlationId: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      AuditAdapterStatus: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['CLOUDWATCH', 'PROMETHEUS', 'GRAFANA'], example: 'PROMETHEUS' },
          enabled: { type: 'boolean', example: true }
        }
      },
      AuditConfigData: {
        type: 'object',
        properties: {
          adapters: {
            type: 'array',
            items: { $ref: '#/components/schemas/AuditAdapterStatus' }
          },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      AuditAlertData: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'alt-001' },
          title: { type: 'string', example: 'Elevated Transaction Failures' },
          service: { type: 'string', example: 'transaction-service' },
          severity: { type: 'string', enum: ['INFO', 'WARN', 'CRITICAL'], example: 'WARN' },
          status: { type: 'string', enum: ['FIRING', 'RESOLVED'], example: 'FIRING' },
          customerImpact: { type: 'string', example: 'High risk: 14 checkout attempts degraded in past 10m' },
          suggestedAction: { type: 'string', example: 'RETRY_TRANSACTION' },
          triggeredAt: { type: 'string', format: 'date-time' }
        }
      },
      TelemetryMetricsSummaryData: {
        type: 'object',
        properties: {
          totalEvents: { type: 'integer', example: 148 },
          errorCount: { type: 'integer', example: 3 },
          criticalCount: { type: 'integer', example: 0 },
          riskScore: { type: 'number', example: 8 },
          remediationCount: { type: 'integer', example: 12 },
          systemHealthPct: { type: 'number', example: 98.8 }
        }
      },
      RemediationRequest: {
        type: 'object',
        required: ['actionType', 'targetResource'],
        properties: {
          alertId: { type: 'string', example: 'alt-001' },
          actionType: {
            type: 'string',
            enum: [
              'RETRY_TRANSACTION',
              'BLOCK_ACTOR_IP',
              'PAGE_ON_CALL_OPS',
              'ESCALATE_INCIDENT',
              'ACKNOWLEDGE_INCIDENT',
              'SCALE_DB_POOL',
              'FLUSH_CACHE'
            ],
            example: 'RETRY_TRANSACTION'
          },
          targetResource: { type: 'string', minLength: 1, example: 'transaction-service' },
          notes: { type: 'string', example: 'Retrying stalled Stripe checkout webhook batch' }
        }
      },
      RemediationResponseData: {
        type: 'object',
        properties: {
          action: { type: 'string', example: 'RETRY_TRANSACTION' },
          resource: { type: 'string', example: 'transaction-service' },
          status: { type: 'string', enum: ['EXECUTED'], example: 'EXECUTED' },
          executedAt: { type: 'string', format: 'date-time' }
        }
      },
      GrafanaAnnotation: {
        type: 'object',
        properties: {
          title: { type: 'string', example: '[WARN] CONFIG_UPDATED' },
          time: { type: 'integer', format: 'int64', example: 1760610600000 },
          text: { type: 'string', example: 'Resource: SystemConfig (ACTIVE_PAYMENT_GATEWAY) by admin@enterprise.local' },
          tags: { type: 'array', items: { type: 'string' }, example: ['audit', 'warn', 'SystemConfig'] }
        }
      }
    }
  },
  paths: {
    // Gateway Directory & Versioned Health (v1)
    '/api': {
      get: {
        tags: ['Gateway Health'],
        summary: 'API Discovery & Version Directory',
        description: 'Returns the current API version, supported versions, and top-level discovery links.',
        responses: {
          '200': {
            description: 'API version discovery metadata',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/ApiDiscoveryData' })
              }
            }
          }
        }
      }
    },
    '/api/v1': {
      get: {
        tags: ['Gateway Health'],
        summary: 'API v1 Directory & Endpoints Discovery',
        description: 'Returns available service routes, health check paths, and documentation links for v1.',
        responses: {
          '200': {
            description: 'API v1 directory and metadata',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/ApiV1DirectoryData' })
              }
            }
          }
        }
      }
    },
    '/api/v1/health': {
      get: {
        tags: ['Gateway Health'],
        summary: 'Gateway Liveness Probe (v1)',
        description: 'Returns the health status and uptime of the API Gateway (config-service :4003 also exposes /api/v1/health directly).',
        responses: {
          '200': {
            description: 'Gateway is healthy and operational',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/GatewayHealthData' })
              }
            }
          }
        }
      }
    },
    '/api/v1/health/detailed': {
      get: {
        tags: ['Gateway Health'],
        summary: 'Aggregated Platform Health Check (v1)',
        description: 'Probes all 10 downstream microservices and returns individual latencies and statuses.',
        responses: {
          '200': {
            description: 'All downstream microservices are healthy',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/DetailedHealthData' })
              }
            }
          },
          '503': {
            description: 'One or more downstream services are degraded or unavailable',
            content: standardErrorContent
          }
        }
      }
    },

    // Unversioned & Legacy / Container Health Probes
    '/api/health': {
      get: {
        tags: ['Gateway Health'],
        summary: 'Gateway Liveness Probe (Unversioned Alias)',
        description: 'Unversioned alias to /api/v1/health (config-service :4003 also exposes /api/health directly).',
        responses: {
          '200': {
            description: 'Gateway is healthy and operational',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/GatewayHealthData' })
              }
            }
          }
        }
      }
    },
    '/api/health/detailed': {
      get: {
        tags: ['Gateway Health'],
        summary: 'Aggregated Platform Health Check (Unversioned Alias)',
        description: 'Unversioned alias to /api/v1/health/detailed.',
        responses: {
          '200': {
            description: 'All downstream microservices are healthy',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/DetailedHealthData' })
              }
            }
          },
          '503': {
            description: 'One or more downstream services are degraded or unavailable',
            content: standardErrorContent
          }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Gateway Health'],
        summary: 'Gateway Liveness Probe (Root / Legacy)',
        description: 'Returns the health status of the API Gateway (alias to /api/v1/health; all microservices also expose /health directly).',
        responses: {
          '200': {
            description: 'Gateway is healthy and operational',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/GatewayHealthData' })
              }
            }
          }
        }
      }
    },
    '/health/detailed': {
      get: {
        tags: ['Gateway Health'],
        summary: 'Aggregated Platform Health Check (Root / Legacy)',
        description: 'Probes all 10 downstream microservices and returns individual latencies and statuses (alias to /api/v1/health/detailed).',
        responses: {
          '200': {
            description: 'All downstream microservices are healthy',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/DetailedHealthData' })
              }
            }
          },
          '503': {
            description: 'One or more downstream services are degraded or unavailable',
            content: standardErrorContent
          }
        }
      }
    },

    // IAM Service
    '/api/v1/iam/register': {
      post: {
        tags: ['IAM Service'],
        summary: 'Register New User',
        description: 'Registers a new user account with bcrypt-hashed password and publishes `iam.user_registered` to RabbitMQ. Rate-limited to 15 requests/minute.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterUserRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/IamUserData' })
              }
            }
          },
          '400': {
            description: 'Validation error or duplicate email address',
            content: standardErrorContent
          },
          '429': rateLimit429Response
        }
      }
    },
    '/api/v1/iam/login': {
      post: {
        tags: ['IAM Service'],
        summary: 'User Login & Token Issuance',
        description: 'Authenticates user credentials and issues signed JWT access and refresh tokens. Rate-limited to 15 requests/minute.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginUserRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/AuthTokensData' })
              }
            }
          },
          '400': {
            description: 'Validation error (invalid email or empty password)',
            content: standardErrorContent
          },
          '401': {
            description: 'Invalid credentials or disabled user account',
            content: standardErrorContent
          },
          '429': rateLimit429Response
        }
      }
    },
    '/api/v1/iam/profile': {
      get: {
        tags: ['IAM Service'],
        summary: 'Get Current User Profile',
        description: 'Returns the authenticated user profile extracted from the JWT token.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile retrieved successfully',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/IamUserData' })
              }
            }
          },
          '401': auth401Response,
          '404': {
            description: 'User not found',
            content: standardErrorContent
          }
        }
      }
    },
    '/api/v1/iam/users/{id}': {
      get: {
        tags: ['IAM Service'],
        summary: 'Get User By ID (ADMIN / SUPPORT)',
        description: 'Retrieves a user profile by ID within the tenant. Requires `ADMIN` or `SUPPORT` role.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'User ID (UUID)' }
        ],
        responses: {
          '200': {
            description: 'User found',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/IamUserData' })
              }
            }
          },
          '401': auth401Response,
          '403': forbidden403Response,
          '404': {
            description: 'User not found',
            content: standardErrorContent
          }
        }
      }
    },
    '/api/v1/iam/refresh': {
      post: {
        tags: ['IAM Service'],
        summary: 'Refresh Access Token',
        description: 'Issues a new tenant-scoped accessToken and refreshToken pair using a valid refresh token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Tokens refreshed', content: { 'application/json': { schema: envelopedData({ $ref: '#/components/schemas/AuthTokensData' }) } } },
          '401': auth401Response
        }
      }
    },
    '/api/v1/iam/tenants/config': {
      get: {
        tags: ['IAM Service'],
        summary: 'Get Multi-Tenancy Configuration',
        description: 'Returns active multi-tenancy configuration flags and the resolved tenant context for the current request.',
        responses: { '200': { description: 'Multi-tenancy status retrieved' } }
      }
    },
    '/api/v1/iam/tenants': {
      get: {
        tags: ['IAM Service'],
        summary: 'List All Tenants (ADMIN)',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Tenants list retrieved' }, '401': auth401Response, '403': forbidden403Response }
      },
      post: {
        tags: ['IAM Service'],
        summary: 'Create Tenant (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TenantData' } } } },
        responses: { '201': { description: 'Tenant created' }, '400': { description: 'Validation error', content: standardErrorContent } }
      }
    },
    '/api/v1/iam/oidc/providers': {
      get: {
        tags: ['IAM Service'],
        summary: 'List Enabled OIDC Providers for Tenant',
        description: 'Returns public metadata and authorize URLs for enabled OIDC providers configured for the target tenant (`x-tenant-id` or `?tenantSlug=`).',
        parameters: [
          { name: 'x-tenant-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'tenantSlug', in: 'query', required: false, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Enabled providers retrieved' } }
      }
    },
    '/api/v1/iam/oidc/{provider}/authorize': {
      get: {
        tags: ['IAM Service'],
        summary: 'Initiate OIDC Federated Login',
        description: 'Generates PKCE S256 challenge, CSRF state, and nonce, returning the IdP authorizationUrl (or 302 redirecting if `?redirect=true`).',
        parameters: [
          { name: 'provider', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'x-tenant-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'redirect', in: 'query', required: false, schema: { type: 'boolean' } }
        ],
        responses: { '200': { description: 'Authorization URL generated' } }
      }
    },
    '/api/v1/iam/oidc/{provider}/callback': {
      get: {
        tags: ['IAM Service'],
        summary: 'Handle OIDC Provider Callback',
        description: 'Validates single-use state, exchanges authorization code + PKCE verifier, verifies ID token JWKS signature & nonce, JIT-provisions or links user, and issues tenant-scoped JWTs.',
        parameters: [
          { name: 'provider', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'state', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Federated authentication successful', content: { 'application/json': { schema: envelopedData({ $ref: '#/components/schemas/AuthTokensData' }) } } } }
      }
    },
    '/api/v1/iam/oidc/token-exchange': {
      post: {
        tags: ['IAM Service'],
        summary: 'Exchange External OIDC ID Token',
        description: 'Verifies an IdP-issued id_token against the tenant OIDC configuration and issues platform tenant-scoped JWTs.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['provider', 'idToken'],
                properties: {
                  provider: { type: 'string', example: 'google' },
                  idToken: { type: 'string' },
                  tenantId: { type: 'string' },
                  tenantSlug: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'Platform tokens issued' }, '401': auth401Response }
      }
    },
    '/api/v1/iam/oidc/admin/providers': {
      get: {
        tags: ['IAM Service'],
        summary: 'List Tenant OIDC Providers (ADMIN)',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Providers retrieved' } }
      },
      post: {
        tags: ['IAM Service'],
        summary: 'Configure OIDC Provider for Tenant (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OidcProviderCreateRequest' } } } },
        responses: { '201': { description: 'OIDC provider configured' } }
      }
    },
    '/api/v1/iam/federated-identities': {
      get: {
        tags: ['IAM Service'],
        summary: 'List Linked Federated Identities',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Linked identities retrieved' }, '401': auth401Response }
      }
    },

    // Order Service
    '/api/v1/orders': {
      post: {
        tags: ['Order Service'],
        summary: 'Create New Order',
        description: 'Creates a basket order. Validates and reserves stock via synchronous gRPC calls (`CheckStock` + `ReserveStock`) to `inventory-service`, and publishes `orders.order_created` to RabbitMQ.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrderRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Order created successfully',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/OrderResponseData' })
              }
            }
          },
          '400': {
            description: 'Insufficient stock or validation failure',
            content: standardErrorContent
          },
          '401': auth401Response
        }
      }
    },
    '/api/v1/orders/my': {
      get: {
        tags: ['Order Service'],
        summary: 'List Authenticated User Orders',
        description: 'Returns all orders belonging to the authenticated user.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Orders retrieved successfully',
            content: {
              'application/json': {
                schema: envelopedData({
                  type: 'array',
                  items: { $ref: '#/components/schemas/OrderResponseData' }
                })
              }
            }
          },
          '401': auth401Response
        }
      }
    },
    '/api/v1/orders/{id}': {
      get: {
        tags: ['Order Service'],
        summary: 'Get Order by ID',
        description: 'Retrieves an order by ID. Accessible only to the order owner or `ADMIN` role.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Order ID' }
        ],
        responses: {
          '200': {
            description: 'Order found',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/OrderResponseData' })
              }
            }
          },
          '401': auth401Response,
          '404': {
            description: 'Order not found or not owned by requester',
            content: standardErrorContent
          }
        }
      }
    },
    '/api/v1/orders/{id}/cancel': {
      post: {
        tags: ['Order Service'],
        summary: 'Cancel Order',
        description: 'Cancels a non-shipped order. Accessible only to the order owner or `ADMIN` role.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Order ID' }
        ],
        responses: {
          '200': {
            description: 'Order cancelled successfully',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/OrderResponseData' })
              }
            }
          },
          '400': {
            description: 'Order not found, forbidden, or already shipped',
            content: standardErrorContent
          },
          '401': auth401Response
        }
      }
    },

    // Inventory Service
    '/api/v1/inventory/{productId}': {
      get: {
        tags: ['Inventory Service'],
        summary: 'Get Stock Level',
        description: 'Retrieves available, reserved, and total inventory quantities for a product.',
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' }, description: 'Product ID' }
        ],
        responses: {
          '200': {
            description: 'Stock details returned',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/InventoryItemData' })
              }
            }
          },
          '404': {
            description: 'Product not found in inventory',
            content: standardErrorContent
          }
        }
      }
    },
    '/api/v1/inventory/reserve': {
      post: {
        tags: ['Inventory Service'],
        summary: 'Reserve Stock Quantity',
        description: 'Reserves a quantity of product stock for an authenticated user or service.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReserveStockRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Stock reserved',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/InventoryItemData' })
              }
            }
          },
          '400': {
            description: 'Validation error, product not found, or insufficient stock',
            content: standardErrorContent
          },
          '401': auth401Response
        }
      }
    },
    '/api/v1/inventory/stock': {
      post: {
        tags: ['Inventory Service'],
        summary: 'Add Stock Quantity (ADMIN)',
        description: 'Adds stock to an existing SKU or creates a new inventory record. Requires `ADMIN` role.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddStockRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Stock added',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/InventoryItemData' })
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: standardErrorContent
          },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Transaction Service
    '/api/v1/transactions/initiate': {
      post: {
        tags: ['Transaction Service'],
        summary: 'Initiate Payment Transaction',
        description: 'Resolves active payment gateway (`STRIPE`, `PAYPAL`, `RAZORPAY`, `MOCK`) dynamically via gRPC to `config-service` and creates a hosted checkout session.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InitiatePaymentRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Payment transaction initialized',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/TransactionResponseData' })
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: standardErrorContent
          },
          '401': auth401Response
        }
      }
    },
    '/api/v1/transactions/webhook': {
      post: {
        tags: ['Transaction Service'],
        summary: 'Handle Payment Gateway Webhook',
        description: 'Processes payment completion callback, updates transaction status, and publishes `transactions.transaction_completed` to RabbitMQ.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentWebhookRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Webhook processed',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/TransactionResponseData' })
              }
            }
          },
          '400': {
            description: 'Validation error or transaction not found',
            content: standardErrorContent
          }
        }
      }
    },
    '/api/v1/transactions/{id}': {
      get: {
        tags: ['Transaction Service'],
        summary: 'Get Transaction by ID',
        description: 'Retrieves payment transaction details by ID.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Transaction ID' }
        ],
        responses: {
          '200': {
            description: 'Transaction details returned',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/TransactionResponseData' })
              }
            }
          },
          '401': auth401Response,
          '404': {
            description: 'Transaction not found',
            content: standardErrorContent
          }
        }
      }
    },

    // Config Service
    '/api/v1/config': {
      get: {
        tags: ['Config Service'],
        summary: 'List All Dynamic Configs',
        description: 'Returns all stored dynamic system configuration settings ordered by key.',
        responses: {
          '200': {
            description: 'List of configurations',
            content: {
              'application/json': {
                schema: envelopedData({
                  type: 'array',
                  items: { $ref: '#/components/schemas/ConfigSettingData' }
                })
              }
            }
          }
        }
      },
      post: {
        tags: ['Config Service'],
        summary: 'Set Dynamic Configuration Key (ADMIN)',
        description: 'Creates or updates a dynamic configuration key/value pair. Requires `ADMIN` role.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SetConfigRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Configuration saved',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/ConfigSettingData' })
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: standardErrorContent
          },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/config/{key}': {
      get: {
        tags: ['Config Service'],
        summary: 'Get Config by Key',
        description: 'Retrieves a configuration setting by key, optionally falling back to a default query value.',
        parameters: [
          { name: 'key', in: 'path', required: true, schema: { type: 'string' }, description: 'Configuration key (e.g. ACTIVE_PAYMENT_GATEWAY)' },
          { name: 'default', in: 'query', required: false, schema: { type: 'string' }, description: 'Optional fallback value returned if key is not configured' }
        ],
        responses: {
          '200': {
            description: 'Config key value',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/ConfigSettingData' })
              }
            }
          },
          '404': {
            description: 'Configuration key not found and no default query parameter provided',
            content: standardErrorContent
          }
        }
      },
      put: {
        tags: ['Config Service'],
        summary: 'Upsert Config Key (ADMIN)',
        description: 'Updates or creates a configuration setting via PUT. Requires `ADMIN` role.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'key', in: 'path', required: true, schema: { type: 'string' }, description: 'Configuration key' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SetConfigRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Configuration updated successfully',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/ConfigSettingData' })
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: standardErrorContent
          },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Config Service'],
        summary: 'Delete Config Key (ADMIN)',
        description: 'Deletes a configuration setting by key. Requires `ADMIN` role.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'key', in: 'path', required: true, schema: { type: 'string' }, description: 'Configuration key' }
        ],
        responses: {
          '200': {
            description: 'Config key deleted',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/DeleteConfigData' })
              }
            }
          },
          '401': auth401Response,
          '403': forbidden403Response,
          '404': {
            description: 'Configuration setting not found',
            content: standardErrorContent
          }
        }
      }
    },

    // Asset Service
    '/api/v1/assets': {
      post: {
        tags: ['Asset Service'],
        summary: 'Register Media Asset',
        description: 'Registers file/media metadata owned by the authenticated user.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateAssetRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Asset registered',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/AssetResponseData' })
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: standardErrorContent
          },
          '401': auth401Response
        }
      }
    },
    '/api/v1/assets/my': {
      get: {
        tags: ['Asset Service'],
        summary: 'List Assets Owned by User',
        description: 'Returns all media assets registered by the authenticated user.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'User assets returned',
            content: {
              'application/json': {
                schema: envelopedData({
                  type: 'array',
                  items: { $ref: '#/components/schemas/AssetResponseData' }
                })
              }
            }
          },
          '401': auth401Response
        }
      }
    },

    // Notification Service
    '/api/v1/notifications': {
      post: {
        tags: ['Notification Service'],
        summary: 'Send Multi-Channel Notification',
        description: 'Queues and dispatches an EMAIL, SMS, PUSH, or WEBHOOK notification.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SendNotificationRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Notification dispatched',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/NotificationResponseData' })
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: standardErrorContent
          },
          '401': auth401Response
        }
      },
      get: {
        tags: ['Notification Service'],
        summary: 'List Recent Notifications (ADMIN / SUPPORT)',
        description: 'Lists recent notification records. Requires `ADMIN` or `SUPPORT` role.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 }, description: 'Maximum notifications to return' }
        ],
        responses: {
          '200': {
            description: 'Notifications list',
            content: {
              'application/json': {
                schema: envelopedData({
                  type: 'array',
                  items: { $ref: '#/components/schemas/NotificationResponseData' }
                })
              }
            }
          },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Scheduler Service
    '/api/v1/scheduler/jobs': {
      get: {
        tags: ['Scheduler Service'],
        summary: 'List Cron Jobs (ADMIN / SUPPORT)',
        description: 'Lists all registered scheduled jobs. Requires `ADMIN` or `SUPPORT` role.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of registered jobs',
            content: {
              'application/json': {
                schema: envelopedData({
                  type: 'array',
                  items: { $ref: '#/components/schemas/JobResponseData' }
                })
              }
            }
          },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Scheduler Service'],
        summary: 'Register Scheduled Job (ADMIN)',
        description: 'Registers a new cron job. Requires `ADMIN` role.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateJobRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Job registered',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/JobResponseData' })
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: standardErrorContent
          },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/scheduler/jobs/{id}/trigger': {
      post: {
        tags: ['Scheduler Service'],
        summary: 'Trigger Job Manually (ADMIN)',
        description: 'Executes a registered job immediately by ID. Requires `ADMIN` role.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Scheduled job ID' }
        ],
        responses: {
          '200': {
            description: 'Job execution completed',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/JobResponseData' })
              }
            }
          },
          '401': auth401Response,
          '403': forbidden403Response,
          '404': {
            description: 'Job not found',
            content: standardErrorContent
          }
        }
      }
    },

    // Search Service
    '/api/v1/search': {
      get: {
        tags: ['Search Service'],
        summary: 'Full-Text Search Query',
        description: 'Searches indexed projections (`ORDER`, `USER`) using case-insensitive pattern matching on title and description.',
        parameters: [
          { name: 'q', in: 'query', required: false, schema: { type: 'string', default: '' }, description: 'Search keywords (defaults to empty string, returning latest documents)' },
          { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['ORDER', 'USER'] }, description: 'Optional entity document type filter (case-insensitive; omit to search all types)' }
        ],
        responses: {
          '200': {
            description: 'Search results returned',
            content: {
              'application/json': {
                schema: envelopedData({
                  type: 'array',
                  items: { $ref: '#/components/schemas/SearchResultItemData' }
                })
              }
            }
          }
        }
      }
    },

    // Audit Service
    '/api/v1/audit/logs': {
      post: {
        tags: ['Audit Service'],
        summary: 'Record Audit Log',
        description: 'Persists an immutable audit entry and broadcasts it to enabled monitoring adapters (CloudWatch, Prometheus, Grafana).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RecordAuditRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Audit log recorded',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/AuditLogData' })
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: standardErrorContent
          }
        }
      },
      get: {
        tags: ['Audit Service'],
        summary: 'Query Audit Logs',
        description: 'Queries audit logs with optional filters. Requires `ADMIN` or `SUPPORT` role in production; open for dashboard inspection in non-production environments.',
        security: [{}, { BearerAuth: [] }],
        parameters: [
          { name: 'actorId', in: 'query', schema: { type: 'string' }, description: 'Filter by actor user ID' },
          { name: 'resource', in: 'query', schema: { type: 'string' }, description: 'Filter by resource name' },
          { name: 'action', in: 'query', schema: { type: 'string' }, description: 'Filter by action name' },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'] }, description: 'Filter by severity level' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 }, description: 'Max records to return (capped at 100)' }
        ],
        responses: {
          '200': {
            description: 'Audit logs returned',
            content: {
              'application/json': {
                schema: envelopedData({
                  type: 'array',
                  items: { $ref: '#/components/schemas/AuditLogData' }
                })
              }
            }
          },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/audit/config': {
      get: {
        tags: ['Audit Service'],
        summary: 'Get Active Monitoring Adapters',
        description: 'Returns activation state of flag-based monitoring adapters (CloudWatch, Prometheus, Grafana).',
        responses: {
          '200': {
            description: 'Active monitoring configuration',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/AuditConfigData' })
              }
            }
          }
        }
      }
    },
    '/api/v1/audit/alerts': {
      get: {
        tags: ['Audit Service'],
        summary: 'List Active Monitoring Alerts',
        description: 'Returns operational monitoring alerts derived from live Prometheus risk telemetry and service health thresholds.',
        responses: {
          '200': {
            description: 'Active monitoring alerts retrieved successfully',
            content: {
              'application/json': {
                schema: envelopedData({
                  type: 'array',
                  items: { $ref: '#/components/schemas/AuditAlertData' }
                })
              }
            }
          }
        }
      }
    },
    '/api/v1/audit/metrics/summary': {
      get: {
        tags: ['Audit Service'],
        summary: 'Get Telemetry Metrics Summary',
        description: 'Returns aggregated Prometheus audit counters, dynamic customer-impact risk score, remediation count, and system health percentage.',
        responses: {
          '200': {
            description: 'Telemetry metrics summary retrieved successfully',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/TelemetryMetricsSummaryData' })
              }
            }
          }
        }
      }
    },
    '/api/v1/audit/remediate': {
      post: {
        tags: ['Audit Service'],
        summary: 'Execute Operational Remediation Action',
        description: 'Dispatches an operator remediation action, increments `remediation_actions_total` in Prometheus, and persists an immutable audit log entry.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RemediationRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Remediation action dispatched successfully',
            content: {
              'application/json': {
                schema: envelopedData({ $ref: '#/components/schemas/RemediationResponseData' })
              }
            }
          },
          '400': {
            description: 'Validation error (invalid actionType or missing targetResource)',
            content: standardErrorContent
          }
        }
      }
    },
    '/api/v1/audit/grafana/annotations': {
      get: {
        tags: ['Audit Service'],
        summary: 'Grafana Dashboard Annotations',
        description: 'Returns recent WARN/ERROR/CRITICAL audit event annotations in raw Grafana SimpleJSON array format.',
        responses: {
          '200': {
            description: 'Grafana annotations array',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/GrafanaAnnotation' }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/ai/capabilities': {
      get: {
        tags: ['AI & MCP Service'],
        summary: 'Get AI & MCP Service Capabilities',
        description: 'Returns supported MCP protocol version, transports, categories, and registered adapters.',
        responses: { '200': { description: 'Capabilities retrieved' } }
      }
    },
    '/api/v1/ai/providers': {
      get: {
        tags: ['AI & MCP Service'],
        summary: 'List MCP & External API Providers',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Providers retrieved' }, '401': auth401Response }
      },
      post: {
        tags: ['AI & MCP Service'],
        summary: 'Register Extensible MCP / API / DB Provider',
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Provider registered' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/ai/tools': {
      get: {
        tags: ['AI & MCP Service'],
        summary: 'List Unified MCP Tools',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Tools retrieved' }, '401': auth401Response }
      }
    },
    '/api/v1/ai/tools/call': {
      post: {
        tags: ['AI & MCP Service'],
        summary: 'Invoke an MCP Tool (Communication, Search, DB, External API, or External MCP)',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Tool executed' }, '401': auth401Response }
      }
    },
    '/api/v1/ai/orchestrate': {
      post: {
        tags: ['AI & MCP Service'],
        summary: 'Orchestrate Multi-Step or Parallel MCP Tool Calls',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Orchestration completed' }, '401': auth401Response }
      }
    },
    '/metrics': {
      get: {
        tags: ['Audit Service'],
        summary: 'Prometheus Metrics Exposition (Direct on :4011)',
        description: 'Exposes Prometheus metrics (`audit_events_total`, `audit_errors_total`, `http_requests_total`, `remediation_actions_total`, `customer_impact_risk_score`) directly on `audit-service` port 4011.',
        servers: [
          {
            url: 'http://localhost:4011',
            description: 'Audit Service (Direct Metrics Endpoint)'
          }
        ],
        responses: {
          '200': {
            description: 'Prometheus text exposition format metrics',
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  example: '# HELP audit_events_total Total number of audit events processed\n# TYPE audit_events_total counter\naudit_events_total 0\n'
                }
              }
            }
          }
        }
      }
    }
  }
};
