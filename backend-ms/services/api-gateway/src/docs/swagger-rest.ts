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
    },
    {
      url: 'http://localhost:4012',
      description: 'Organization Service (Direct)'
    },
    {
      url: 'http://localhost:4013',
      description: 'RBAC Service (Direct)'
    }
  ],
  tags: [
    { name: 'Gateway Health', description: 'API Gateway discovery, health probes, and downstream aggregation monitoring' },
    { name: 'Roles (RBAC)', description: 'Tenant role lifecycle, custom roles creation, updates, and permission bindings' },
    { name: 'Permissions (RBAC)', description: 'Granular permissions catalog and category management' },
    { name: 'User Role Assignments (RBAC)', description: 'Assigning, revoking, and validating user roles and real-time permission checks' },
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
    { name: 'Audit Service', description: 'Immutable audit logs, telemetry alerts, remediation, and monitoring adapters' },
    { name: 'Organization Service', description: 'Multi-tenant organization management, onboarding, profile metadata, and member assignments' }
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
              ai: '/api/v1/ai',
              audit: '/api/v1/audit',
              organizations: '/api/v1/organizations',
              rbac: '/api/v1/rbac'
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
      },

      // AI & MCP schemas
      McpCapabilitiesData: {
        type: 'object',
        properties: {
          protocolVersion: { type: 'string', example: '2024-11-05' },
          transports: { type: 'array', items: { type: 'string' }, example: ['streamable_http', 'stdio'] },
          supportedCategories: {
            type: 'array',
            items: { type: 'string' },
            example: ['COMMUNICATION', 'SEARCH', 'DATABASE', 'EXTERNAL_API', 'EXTERNAL_MCP']
          },
          registeredAdapters: { type: 'array', items: { type: 'string' }, example: ['communication', 'search', 'internal-db', 'external-api', 'external-mcp'] }
        }
      },
      McpProviderData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', example: 'tenant-alpha' },
          slug: { type: 'string', example: 'communication-tools' },
          name: { type: 'string', example: 'Communication & Messaging Tools' },
          category: { type: 'string', enum: ['COMMUNICATION', 'SEARCH', 'DATABASE', 'EXTERNAL_API', 'EXTERNAL_MCP'], example: 'COMMUNICATION' },
          transportType: { type: 'string', enum: ['STREAMABLE_HTTP', 'STDIO'], example: 'STREAMABLE_HTTP' },
          endpointUrl: { type: 'string', nullable: true, example: 'http://notification-service:4004' },
          isBuiltin: { type: 'boolean', example: true },
          isEnabled: { type: 'boolean', example: true },
          healthStatus: { type: 'string', enum: ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN'], example: 'HEALTHY' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      RegisterMcpProviderRequest: {
        type: 'object',
        required: ['slug', 'name', 'category', 'transportType'],
        properties: {
          slug: { type: 'string', minLength: 2, example: 'custom-mcp' },
          name: { type: 'string', minLength: 2, example: 'Custom Enterprise MCP' },
          category: { type: 'string', enum: ['COMMUNICATION', 'SEARCH', 'DATABASE', 'EXTERNAL_API', 'EXTERNAL_MCP'], example: 'EXTERNAL_MCP' },
          transportType: { type: 'string', enum: ['STREAMABLE_HTTP', 'STDIO'], example: 'STREAMABLE_HTTP' },
          endpointUrl: { type: 'string', example: 'http://internal-mcp:8080/mcp' },
          authType: { type: 'string', enum: ['NONE', 'BEARER', 'API_KEY', 'BASIC'], default: 'NONE' },
          credentials: { type: 'object', additionalProperties: true },
          config: { type: 'object', additionalProperties: true },
          autoSync: { type: 'boolean', default: true }
        }
      },
      UpdateMcpProviderRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          endpointUrl: { type: 'string' },
          authType: { type: 'string', enum: ['NONE', 'BEARER', 'API_KEY', 'BASIC'] },
          credentials: { type: 'object', additionalProperties: true },
          config: { type: 'object', additionalProperties: true },
          isEnabled: { type: 'boolean' }
        }
      },
      McpToolData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          providerId: { type: 'string', format: 'uuid' },
          providerSlug: { type: 'string', example: 'communication-tools' },
          toolName: { type: 'string', example: 'send_email' },
          qualifiedName: { type: 'string', example: 'communication-tools::send_email' },
          description: { type: 'string', example: 'Sends email notification to a recipient' },
          inputSchema: { type: 'object', additionalProperties: true },
          isEnabled: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      McpToolCallRequest: {
        type: 'object',
        required: ['tool'],
        properties: {
          tool: { type: 'string', example: 'communication-tools::send_email' },
          arguments: { type: 'object', additionalProperties: true, example: { recipient: 'user@example.com', subject: 'Alert', body: 'System notification' } },
          providerSlug: { type: 'string', example: 'communication-tools' },
          timeoutMs: { type: 'integer', default: 15000, example: 15000 }
        }
      },
      McpToolCallData: {
        type: 'object',
        properties: {
          invocationId: { type: 'string', format: 'uuid' },
          providerSlug: { type: 'string', example: 'communication-tools' },
          toolName: { type: 'string', example: 'send_email' },
          qualifiedName: { type: 'string', example: 'communication-tools::send_email' },
          isError: { type: 'boolean', example: false },
          content: { type: 'array', items: { type: 'object', additionalProperties: true } },
          durationMs: { type: 'number', example: 45 }
        }
      },
      McpOrchestrateRequest: {
        type: 'object',
        required: ['steps'],
        properties: {
          mode: { type: 'string', enum: ['SEQUENTIAL', 'PARALLEL'], default: 'SEQUENTIAL' },
          stopOnError: { type: 'boolean', default: true },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              required: ['tool'],
              properties: {
                stepId: { type: 'string', example: 'step-1' },
                tool: { type: 'string', example: 'search-tools::search_orders' },
                arguments: { type: 'object', additionalProperties: true }
              }
            }
          }
        }
      },
      McpOrchestrateData: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          results: { type: 'array', items: { type: 'object', additionalProperties: true } },
          totalDurationMs: { type: 'number', example: 120 }
        }
      },
      ToolInvocationData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', example: 'tenant-alpha' },
          providerSlug: { type: 'string', example: 'communication-tools' },
          toolName: { type: 'string', example: 'send_email' },
          actorId: { type: 'string', nullable: true },
          isError: { type: 'boolean', example: false },
          durationMs: { type: 'number', example: 38 },
          correlationId: { type: 'string', example: 'corr-ai-123' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },

      // Organization schemas
      OrganizationData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          slug: { type: 'string', example: 'acme-corp' },
          name: { type: 'string', example: 'Acme Corporation' },
          legalName: { type: 'string', nullable: true, example: 'Acme Corp LLC' },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'TRIAL', 'DEACTIVATED'], example: 'ACTIVE' },
          tier: { type: 'string', enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'], example: 'ENTERPRISE' },
          industry: { type: 'string', nullable: true, example: 'Technology' },
          taxId: { type: 'string', nullable: true, example: 'US-987654321' },
          contactEmail: { type: 'string', example: 'admin@acme.corp' },
          contactPhone: { type: 'string', nullable: true, example: '+1-555-0199' },
          website: { type: 'string', nullable: true, example: 'https://acme.corp' },
          maxUsers: { type: 'integer', example: 100 },
          settings: { type: 'object', additionalProperties: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      CreateOrganizationRequest: {
        type: 'object',
        required: ['name', 'slug', 'contactEmail'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 255, example: 'Acme Corporation' },
          slug: { type: 'string', minLength: 2, maxLength: 100, example: 'acme-corp' },
          legalName: { type: 'string', example: 'Acme Corp LLC' },
          tier: { type: 'string', enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'], default: 'STARTER' },
          industry: { type: 'string', example: 'Technology' },
          taxId: { type: 'string', example: 'US-987654321' },
          contactEmail: { type: 'string', format: 'email', example: 'admin@acme.corp' },
          contactPhone: { type: 'string', example: '+1-555-0199' },
          website: { type: 'string', example: 'https://acme.corp' },
          maxUsers: { type: 'integer', example: 50 },
          settings: { type: 'object', additionalProperties: true }
        }
      },
      UpdateOrganizationRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 255 },
          legalName: { type: 'string' },
          tier: { type: 'string', enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] },
          industry: { type: 'string' },
          taxId: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          website: { type: 'string' },
          maxUsers: { type: 'integer' },
          settings: { type: 'object', additionalProperties: true }
        }
      },
      UpdateOrganizationStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'TRIAL', 'DEACTIVATED'], example: 'ACTIVE' }
        }
      },
      OrganizationMemberData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          organizationId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', example: 'usr-4412' },
          email: { type: 'string', example: 'member@acme.corp' },
          name: { type: 'string', example: 'John Doe' },
          role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER', 'BILLING_ADMIN'], example: 'MEMBER' },
          status: { type: 'string', enum: ['ACTIVE', 'INVITED', 'SUSPENDED'], example: 'ACTIVE' },
          joinedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      AddOrganizationMemberRequest: {
        type: 'object',
        required: ['userId', 'email', 'name'],
        properties: {
          userId: { type: 'string', minLength: 1, example: 'usr-4412' },
          email: { type: 'string', format: 'email', example: 'member@acme.corp' },
          name: { type: 'string', minLength: 1, example: 'John Doe' },
          role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER', 'BILLING_ADMIN'], default: 'MEMBER' },
          status: { type: 'string', enum: ['ACTIVE', 'INVITED', 'SUSPENDED'], default: 'ACTIVE' }
        }
      },
      UpdateOrganizationMemberRequest: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER', 'BILLING_ADMIN'] },
          status: { type: 'string', enum: ['ACTIVE', 'INVITED', 'SUSPENDED'] }
        }
      },

      // RBAC schemas
      RoleData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', example: 'tenant-alpha' },
          name: { type: 'string', example: 'SECURITY_AUDITOR' },
          description: { type: 'string', nullable: true, example: 'Read-only access to audit logs and security policies' },
          isSystem: { type: 'boolean', example: false },
          permissions: { type: 'array', items: { type: 'string' }, example: ['audit:read', 'telemetry:read'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      CreateRoleRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100, example: 'SUPPORT_LEAD' },
          description: { type: 'string', maxLength: 500, example: 'Manages support escalations and user profiles' },
          permissions: { type: 'array', items: { type: 'string' }, example: ['users:read', 'orders:read'] }
        }
      },
      UpdateRoleRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500, nullable: true },
          permissions: { type: 'array', items: { type: 'string' } }
        }
      },
      UpdateRolePermissionsRequest: {
        type: 'object',
        required: ['permissions'],
        properties: {
          permissions: { type: 'array', items: { type: 'string' }, example: ['users:read', 'orders:read', 'orders:cancel'] }
        }
      },
      PermissionData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'audit:read' },
          category: { type: 'string', example: 'AUDIT' },
          description: { type: 'string', nullable: true, example: 'View audit event history and logs' },
          isSystem: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      CreatePermissionRequest: {
        type: 'object',
        required: ['name', 'category'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100, example: 'billing:reports:export' },
          category: { type: 'string', minLength: 1, maxLength: 64, example: 'BILLING' },
          description: { type: 'string', maxLength: 500, example: 'Export periodic billing CSV summaries' }
        }
      },
      UpdatePermissionRequest: {
        type: 'object',
        properties: {
          category: { type: 'string', maxLength: 64 },
          description: { type: 'string', maxLength: 500, nullable: true }
        }
      },
      UserRoleAssignmentData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', example: 'tenant-alpha' },
          userId: { type: 'string', example: 'usr-4412' },
          roleId: { type: 'string', format: 'uuid' },
          roleName: { type: 'string', example: 'SUPPORT_LEAD' },
          assignedBy: { type: 'string', nullable: true, example: 'usr-admin-1' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      AssignRoleRequest: {
        type: 'object',
        required: ['roleId'],
        properties: {
          roleId: { type: 'string', minLength: 1, example: 'role-uuid-1234' }
        }
      },
      CheckPermissionRequest: {
        type: 'object',
        required: ['permission'],
        properties: {
          permission: { type: 'string', minLength: 1, example: 'orders:cancel' }
        }
      },
      CheckPermissionResponseData: {
        type: 'object',
        properties: {
          userId: { type: 'string', example: 'usr-4412' },
          tenantId: { type: 'string', example: 'tenant-alpha' },
          permission: { type: 'string', example: 'orders:cancel' },
          allowed: { type: 'boolean', example: true },
          userRoles: { type: 'array', items: { type: 'string' }, example: ['SUPPORT_LEAD'] },
          permissions: { type: 'array', items: { type: 'string' }, example: ['users:read', 'orders:read', 'orders:cancel'] }
        }
      },

      // IAM Backoffice & SSO schemas
      BackofficeCreateUserRequest: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email', example: 'operator@enterprise.local' },
          password: { type: 'string', minLength: 8, example: 'Str0ngP@ssw0rd!' },
          name: { type: 'string', example: 'Operations Lead' },
          role: { type: 'string', enum: ['USER', 'ADMIN', 'SUPPORT'], default: 'USER' },
          tenantId: { type: 'string', example: 'default' }
        }
      },
      BackofficeUpdateUserRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['USER', 'ADMIN', 'SUPPORT'] }
        }
      },
      BackofficeUpdateStatusRequest: {
        type: 'object',
        required: ['isActive'],
        properties: {
          isActive: { type: 'boolean', example: false }
        }
      },
      BackofficeResetPasswordRequest: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', minLength: 8, example: 'NewStr0ngP@ss123!' }
        }
      },
      SsoHandoffRequest: {
        type: 'object',
        required: ['targetApp'],
        properties: {
          targetApp: { type: 'string', example: 'mfe-audit-monitoring' },
          targetUrl: { type: 'string', example: 'http://localhost:5174' }
        }
      },
      SsoRedeemRequest: {
        type: 'object',
        required: ['ticket'],
        properties: {
          ticket: { type: 'string', example: 'sso-tkt-c7f8a9e1' }
        }
      },
      SsoExchangeRequest: {
        type: 'object',
        required: ['targetAudience'],
        properties: {
          targetAudience: { type: 'string', example: 'ai-service' }
        }
      },
      SsoIntrospectRequest: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', example: 'eyJh...' }
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
    '/api/v1/iam/backoffice/users': {
      get: {
        tags: ['IAM Service'],
        summary: 'Backoffice: List All Users (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: { '200': { description: 'User list retrieved' }, '401': auth401Response, '403': forbidden403Response }
      },
      post: {
        tags: ['IAM Service'],
        summary: 'Backoffice: Create User (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BackofficeCreateUserRequest' } } }
        },
        responses: { '201': { description: 'User created' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/iam/backoffice/users/{id}': {
      get: {
        tags: ['IAM Service'],
        summary: 'Backoffice: Get User By ID (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'User retrieved' }, '401': auth401Response, '403': forbidden403Response }
      },
      put: {
        tags: ['IAM Service'],
        summary: 'Backoffice: Update User Profile (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BackofficeUpdateUserRequest' } } }
        },
        responses: { '200': { description: 'User updated' }, '401': auth401Response, '403': forbidden403Response }
      },
      delete: {
        tags: ['IAM Service'],
        summary: 'Backoffice: Delete User (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'User deleted' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/iam/backoffice/users/{id}/status': {
      patch: {
        tags: ['IAM Service'],
        summary: 'Backoffice: Update User Status (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BackofficeUpdateStatusRequest' } } }
        },
        responses: { '200': { description: 'User status updated' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/iam/backoffice/users/{id}/reset-password': {
      post: {
        tags: ['IAM Service'],
        summary: 'Backoffice: Reset User Password (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BackofficeResetPasswordRequest' } } }
        },
        responses: { '200': { description: 'Password reset successful' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/iam/backoffice/users/{id}/sessions': {
      get: {
        tags: ['IAM Service'],
        summary: 'Backoffice: List User Active Sessions (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'User sessions retrieved' }, '401': auth401Response, '403': forbidden403Response }
      },
      delete: {
        tags: ['IAM Service'],
        summary: 'Backoffice: Revoke All Sessions for User (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Sessions revoked' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/iam/backoffice/sessions/{sessionId}': {
      delete: {
        tags: ['IAM Service'],
        summary: 'Backoffice: Revoke Single Session (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Session revoked' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/iam/backoffice/roles': {
      get: {
        tags: ['IAM Service'],
        summary: 'Backoffice: List Available Platform Roles (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Roles retrieved' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/iam/sso/handoff': {
      post: {
        tags: ['IAM Service'],
        summary: 'SSO: Create Cross-App Authentication Handoff Ticket',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SsoHandoffRequest' } } }
        },
        responses: { '200': { description: 'Handoff ticket generated' }, '401': auth401Response }
      }
    },
    '/api/v1/iam/sso/redeem': {
      post: {
        tags: ['IAM Service'],
        summary: 'SSO: Redeem Handoff Ticket for Session Tokens',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SsoRedeemRequest' } } }
        },
        responses: { '200': { description: 'Session redeemed' }, '400': { description: 'Invalid or expired ticket' } }
      }
    },
    '/api/v1/iam/sso/exchange': {
      post: {
        tags: ['IAM Service'],
        summary: 'SSO: Exchange Token for Microservice Audience Token',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SsoExchangeRequest' } } }
        },
        responses: { '200': { description: 'Audience token issued' }, '401': auth401Response }
      }
    },
    '/api/v1/iam/sso/introspect': {
      post: {
        tags: ['IAM Service'],
        summary: 'SSO: Introspect Token Validity and Claims',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SsoIntrospectRequest' } } }
        },
        responses: { '200': { description: 'Token introspection result' } }
      }
    },
    '/api/v1/iam/sso/sessions': {
      get: {
        tags: ['IAM Service'],
        summary: 'SSO: List Current User Active SSO Sessions',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Active sessions retrieved' }, '401': auth401Response }
      }
    },
    '/api/v1/iam/sso/logout': {
      post: {
        tags: ['IAM Service'],
        summary: 'SSO: Global or Current Session Logout',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Logged out successfully' }, '401': auth401Response }
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
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/McpOrchestrateRequest' } } }
        },
        responses: { '200': { description: 'Orchestration completed' }, '401': auth401Response }
      }
    },
    '/api/v1/ai/providers/{idOrSlug}': {
      get: {
        tags: ['AI & MCP Service'],
        summary: 'Get Provider Details by ID or Slug',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Provider retrieved' }, '401': auth401Response }
      },
      put: {
        tags: ['AI & MCP Service'],
        summary: 'Update MCP / External API Provider (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateMcpProviderRequest' } } }
        },
        responses: { '200': { description: 'Provider updated' }, '401': auth401Response, '403': forbidden403Response }
      },
      delete: {
        tags: ['AI & MCP Service'],
        summary: 'Deactivate / Remove Provider (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Provider removed' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/ai/providers/{idOrSlug}/sync': {
      post: {
        tags: ['AI & MCP Service'],
        summary: 'Sync Tools from Provider (ADMIN)',
        description: 'Triggers live tool discovery against the upstream MCP endpoint and synchronizes local tool registry.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Tools synchronized successfully' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/ai/providers/{idOrSlug}/health': {
      post: {
        tags: ['AI & MCP Service'],
        summary: 'Probe Provider Health and Latency',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Health check completed' }, '401': auth401Response }
      }
    },
    '/api/v1/ai/providers/{idOrSlug}/resources': {
      get: {
        tags: ['AI & MCP Service'],
        summary: 'List MCP Resources from Provider',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Resources retrieved' }, '401': auth401Response }
      }
    },
    '/api/v1/ai/providers/{idOrSlug}/resources/read': {
      post: {
        tags: ['AI & MCP Service'],
        summary: 'Read Resource Content from Provider',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['uri'], properties: { uri: { type: 'string', example: 'postgres://schema/audit_logs' } } } } }
        },
        responses: { '200': { description: 'Resource content retrieved' }, '401': auth401Response }
      }
    },
    '/api/v1/ai/providers/{idOrSlug}/prompts': {
      get: {
        tags: ['AI & MCP Service'],
        summary: 'List Prompt Templates from Provider',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Prompts retrieved' }, '401': auth401Response }
      }
    },
    '/api/v1/ai/providers/{idOrSlug}/prompts/{promptName}/get': {
      post: {
        tags: ['AI & MCP Service'],
        summary: 'Get Rendered Prompt Template with Arguments',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'promptName', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { arguments: { type: 'object', additionalProperties: true } } } } }
        },
        responses: { '200': { description: 'Rendered prompt returned' }, '401': auth401Response }
      }
    },
    '/api/v1/ai/providers/{idOrSlug}/tools/{toolName}/call': {
      post: {
        tags: ['AI & MCP Service'],
        summary: 'Invoke Tool on Specific Provider',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'toolName', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { arguments: { type: 'object', additionalProperties: true } } } } }
        },
        responses: { '200': { description: 'Tool executed successfully' }, '401': auth401Response }
      }
    },
    '/api/v1/ai/invocations': {
      get: {
        tags: ['AI & MCP Service'],
        summary: 'List MCP Tool Invocation History (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'providerSlug', in: 'query', schema: { type: 'string' } },
          { name: 'toolName', in: 'query', schema: { type: 'string' } },
          { name: 'isError', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: { '200': { description: 'Invocations retrieved' }, '401': auth401Response, '403': forbidden403Response }
      }
    },

    // Organization Service
    '/api/v1/organizations': {
      get: {
        tags: ['Organization Service'],
        summary: 'List Organizations (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'TRIAL', 'DEACTIVATED'] } },
          { name: 'tier', in: 'query', schema: { type: 'string', enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] } },
          { name: 'industry', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: { '200': { description: 'Organizations list retrieved' }, '401': auth401Response, '403': forbidden403Response }
      },
      post: {
        tags: ['Organization Service'],
        summary: 'Create New Organization (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrganizationRequest' } } }
        },
        responses: { '201': { description: 'Organization created' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/organizations/{idOrSlug}': {
      get: {
        tags: ['Organization Service'],
        summary: 'Get Organization by ID or Slug',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Organization details retrieved' }, '401': auth401Response }
      }
    },
    '/api/v1/organizations/{id}': {
      put: {
        tags: ['Organization Service'],
        summary: 'Update Organization (ADMIN / OWNER)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateOrganizationRequest' } } }
        },
        responses: { '200': { description: 'Organization updated' }, '401': auth401Response, '403': forbidden403Response }
      },
      patch: {
        tags: ['Organization Service'],
        summary: 'Partially Update Organization (ADMIN / OWNER)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateOrganizationRequest' } } }
        },
        responses: { '200': { description: 'Organization updated' }, '401': auth401Response, '403': forbidden403Response }
      },
      delete: {
        tags: ['Organization Service'],
        summary: 'Soft Delete Organization (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Organization deleted' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/organizations/{id}/status': {
      patch: {
        tags: ['Organization Service'],
        summary: 'Update Organization Status (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateOrganizationStatusRequest' } } }
        },
        responses: { '200': { description: 'Status updated' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/organizations/{id}/members': {
      get: {
        tags: ['Organization Service'],
        summary: 'List Organization Members',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER', 'BILLING_ADMIN'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INVITED', 'SUSPENDED'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: { '200': { description: 'Members list retrieved' }, '401': auth401Response }
      },
      post: {
        tags: ['Organization Service'],
        summary: 'Add Member to Organization (ADMIN / OWNER)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AddOrganizationMemberRequest' } } }
        },
        responses: { '201': { description: 'Member added' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/organizations/{id}/members/{memberId}': {
      patch: {
        tags: ['Organization Service'],
        summary: 'Update Member Role or Status (ADMIN / OWNER)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'memberId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateOrganizationMemberRequest' } } }
        },
        responses: { '200': { description: 'Member updated' }, '401': auth401Response, '403': forbidden403Response }
      },
      delete: {
        tags: ['Organization Service'],
        summary: 'Remove Member from Organization (ADMIN / OWNER)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'memberId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Member removed' }, '401': auth401Response, '403': forbidden403Response }
      }
    },

    // RBAC Service
    '/api/v1/rbac/roles': {
      get: {
        tags: ['Roles (RBAC)'],
        summary: 'List Tenant Roles',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'isSystem', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: { '200': { description: 'Roles list retrieved' } }
      },
      post: {
        tags: ['Roles (RBAC)'],
        summary: 'Create Custom Role (ADMIN / SUPER_ADMIN / ORGANIZATION_ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateRoleRequest' } } }
        },
        responses: { '201': { description: 'Role created' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/rbac/roles/{id}': {
      get: {
        tags: ['Roles (RBAC)'],
        summary: 'Get Role by ID with Permissions',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Role details retrieved' } }
      },
      put: {
        tags: ['Roles (RBAC)'],
        summary: 'Update Role Name and Description (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateRoleRequest' } } }
        },
        responses: { '200': { description: 'Role updated' }, '401': auth401Response, '403': forbidden403Response }
      },
      delete: {
        tags: ['Roles (RBAC)'],
        summary: 'Delete Custom Role (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Role deleted' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/rbac/roles/{id}/permissions': {
      put: {
        tags: ['Roles (RBAC)'],
        summary: 'Update Role Permissions (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateRolePermissionsRequest' } } }
        },
        responses: { '200': { description: 'Role permissions updated' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/rbac/permissions': {
      get: {
        tags: ['Permissions (RBAC)'],
        summary: 'List All System & Tenant Permissions',
        parameters: [{ name: 'category', in: 'query', schema: { type: 'string' } }],
        responses: { '200': { description: 'Permissions list retrieved' } }
      },
      post: {
        tags: ['Permissions (RBAC)'],
        summary: 'Create Custom Permission (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePermissionRequest' } } }
        },
        responses: { '201': { description: 'Permission created' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/rbac/permissions/categories': {
      get: {
        tags: ['Permissions (RBAC)'],
        summary: 'List Unique Permission Categories',
        responses: { '200': { description: 'Categories retrieved' } }
      }
    },
    '/api/v1/rbac/permissions/{id}': {
      get: {
        tags: ['Permissions (RBAC)'],
        summary: 'Get Permission by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Permission retrieved' } }
      },
      put: {
        tags: ['Permissions (RBAC)'],
        summary: 'Update Permission Details (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatePermissionRequest' } } }
        },
        responses: { '200': { description: 'Permission updated' }, '401': auth401Response, '403': forbidden403Response }
      },
      delete: {
        tags: ['Permissions (RBAC)'],
        summary: 'Delete Custom Permission (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Permission deleted' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/rbac/users/{userId}/roles': {
      get: {
        tags: ['User Role Assignments (RBAC)'],
        summary: 'Get Assigned Roles for User',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'User roles retrieved' } }
      },
      post: {
        tags: ['User Role Assignments (RBAC)'],
        summary: 'Assign Role to User (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignRoleRequest' } } }
        },
        responses: { '201': { description: 'Role assigned successfully' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/rbac/users/{userId}/roles/{roleId}': {
      delete: {
        tags: ['User Role Assignments (RBAC)'],
        summary: 'Revoke Role from User (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'roleId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Role revoked successfully' }, '401': auth401Response, '403': forbidden403Response }
      }
    },
    '/api/v1/rbac/users/{userId}/permissions': {
      get: {
        tags: ['User Role Assignments (RBAC)'],
        summary: 'Get Effective Permissions for User',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Effective user permissions retrieved' } }
      }
    },
    '/api/v1/rbac/users/{userId}/check-permission': {
      get: {
        tags: ['User Role Assignments (RBAC)'],
        summary: 'Check User Permission via Query Parameter',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'permission', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Permission evaluation result' } }
      },
      post: {
        tags: ['User Role Assignments (RBAC)'],
        summary: 'Check User Permission via Request Body',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckPermissionRequest' } } }
        },
        responses: { '200': { description: 'Permission evaluation result' } }
      }
    },
    '/api/v1/rbac/roles/{id}/users': {
      get: {
        tags: ['Roles (RBAC)'],
        summary: 'List Users Assigned to Role',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Assigned users retrieved' } }
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
