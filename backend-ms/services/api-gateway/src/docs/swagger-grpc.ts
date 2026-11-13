import { commonSchemas } from './swagger-schemas.js';

export const swaggerGrpcDoc = {
  openapi: '3.0.3',
  info: {
    title: 'Enterprise Microservices Platform - gRPC Services Contract',
    version: '1.0.0',
    description: `Synchronous inter-service gRPC contract documentation.

All gRPC unary RPC methods return standard response messages mirroring the unified envelope format:
\`\`\`json
{
  "status": true | false,
  "message": "Success or error message",
  "data": { ... },
  "errors": [],
  "meta_data": {
    "request_id": "req-...",
    "timestamp": "ISO-8601",
    "debug_data": { "service": "...", "rpc": "..." },
    "pagination": { "page": 1, "limit": 50, "total": 100, "total_pages": 2, "has_next": true },
    "further_steps": ["..."]
  }
}
\`\`\`

### 📡 Active gRPC Services & Ports
| Service | Package | gRPC Port | Protocol Buffer File | Key Consumers |
|---|---|---|---|---|
| **IAMService** | \`iam\` | \`:50051\` | \`iam.proto\` | API Gateway, Internal Microservices |
| **AssetService** | \`asset\` | \`:50052\` | \`asset.proto\` | API Gateway |
| **ConfigService** | \`config\` | \`:50053\` | \`config.proto\` | API Gateway, Transaction Service, Audit Service |
| **NotificationService** | \`notification\` | \`:50054\` | \`notification.proto\` | API Gateway |
| **SchedulerService** | \`scheduler\` | \`:50055\` | \`scheduler.proto\` | API Gateway |
| **OrderService** | \`order\` | \`:50056\` | \`order.proto\` | API Gateway |
| **TransactionService** | \`transaction\` | \`:50057\` | \`transaction.proto\` | API Gateway |
| **SearchService** | \`search\` | \`:50058\` | \`search.proto\` | API Gateway |
| **InventoryService** | \`inventory\` | \`:50059\` | \`inventory.proto\` | API Gateway, Order Service |
| **AIService** | \`ai\` | \`:50060\` | \`ai.proto\` | API Gateway, Internal Microservices |
| **AuditService** | \`audit\` | \`:50061\` | \`audit.proto\` | API Gateway, All Microservices |
| **OrganizationService** | \`organization\` | \`:50062\` | \`organization.proto\` | API Gateway, IAM Service |
| **RbacService** | \`rbac\` | \`:50063\` | \`rbac.proto\` | API Gateway, IAM Service, All Microservices |
`,
    contact: {
      name: 'Platform Engineering Team',
      email: 'dev@enterprise.local'
    }
  },
  servers: [
    {
      url: 'grpc://localhost:50051',
      description: 'IAM Service gRPC Endpoint (:50051)'
    },
    {
      url: 'grpc://localhost:50052',
      description: 'Asset Service gRPC Endpoint (:50052)'
    },
    {
      url: 'grpc://localhost:50053',
      description: 'Config Service gRPC Endpoint (:50053)'
    },
    {
      url: 'grpc://localhost:50054',
      description: 'Notification Service gRPC Endpoint (:50054)'
    },
    {
      url: 'grpc://localhost:50055',
      description: 'Scheduler Service gRPC Endpoint (:50055)'
    },
    {
      url: 'grpc://localhost:50056',
      description: 'Order Service gRPC Endpoint (:50056)'
    },
    {
      url: 'grpc://localhost:50057',
      description: 'Transaction Service gRPC Endpoint (:50057)'
    },
    {
      url: 'grpc://localhost:50058',
      description: 'Search Service gRPC Endpoint (:50058)'
    },
    {
      url: 'grpc://localhost:50059',
      description: 'Inventory Service gRPC Endpoint (:50059)'
    },
    {
      url: 'grpc://localhost:50060',
      description: 'AI & MCP Service gRPC Endpoint (:50060)'
    },
    {
      url: 'grpc://localhost:50061',
      description: 'Audit Service gRPC Endpoint (:50061)'
    },
    {
      url: 'grpc://localhost:50062',
      description: 'Organization Service gRPC Endpoint (:50062)'
    },
    {
      url: 'grpc://localhost:50063',
      description: 'RBAC Service gRPC Endpoint (:50063)'
    }
  ],
  tags: [
    { name: 'IAMService (gRPC :50051)', description: 'Identity, token verification, tenant resolution, and Gateway Dispatch RPCs' },
    { name: 'AssetService (gRPC :50052)', description: 'Asset registration, listing, and Gateway Dispatch RPCs' },
    { name: 'ConfigService (gRPC :50053)', description: 'Dynamic system configuration, payment gateway resolution, and Gateway Dispatch RPCs' },
    { name: 'NotificationService (gRPC :50054)', description: 'Multi-channel notification dispatch, history, and Gateway Dispatch RPCs' },
    { name: 'SchedulerService (gRPC :50055)', description: 'Scheduled job management, manual triggers, and Gateway Dispatch RPCs' },
    { name: 'OrderService (gRPC :50056)', description: 'Order lifecycle, listing, cancellation, and Gateway Dispatch RPCs' },
    { name: 'TransactionService (gRPC :50057)', description: 'Payment initiation, webhooks, lookup, and Gateway Dispatch RPCs' },
    { name: 'SearchService (gRPC :50058)', description: 'Full-text search query and Gateway Dispatch RPCs' },
    { name: 'InventoryService (gRPC :50059)', description: 'Real-time stock checking, stock reservation, and Gateway Dispatch RPCs' },
    { name: 'AIService (gRPC :50060)', description: 'MCP client, provider management, tool execution, orchestration, and Gateway Dispatch RPCs' },
    { name: 'AuditService (gRPC :50061)', description: 'Synchronous audit logging, telemetry query, and Gateway Dispatch RPCs' },
    { name: 'OrganizationService (gRPC :50062)', description: 'Multi-tenant organization CRUD, slug lookup, and Gateway Dispatch RPCs' },
    { name: 'RbacService (gRPC :50063)', description: 'Dynamic roles, permission checking, user role assignments, and Gateway Dispatch RPCs' }
  ],
  components: {
    schemas: {
      ...commonSchemas,

      // gRPC MetaData Schema
      GrpcStandardMetaData: {
        type: 'object',
        properties: {
          request_id: { type: 'string', example: 'grpc-iam-1760610600000' },
          timestamp: { type: 'string', format: 'date-time', example: '2026-10-16T10:30:00.000Z' },
          debug_data: {
            type: 'object',
            additionalProperties: { type: 'string' },
            example: { service: 'iam-service', rpc: 'VerifyToken' }
          },
          pagination: {
            type: 'object',
            nullable: true,
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 50 },
              total: { type: 'integer', example: 250 },
              total_pages: { type: 'integer', example: 5 },
              has_next: { type: 'boolean', example: true }
            }
          },
          further_steps: {
            type: 'array',
            items: { type: 'string' },
            example: ['Token is valid; proceed with authorized request']
          }
        }
      },

      // IAM gRPC Messages (iam.proto)
      VerifyTokenRequest: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Raw JWT bearer token string' },
          expectedTenantId: { type: 'string', description: 'Optional tenant ID to enforce against JWT claims' }
        }
      },
      VerifyTokenData: {
        type: 'object',
        properties: {
          valid: { type: 'boolean', example: true },
          userId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          email: { type: 'string', example: 'user@example.com' },
          role: { type: 'string', example: 'USER' },
          tenantId: { type: 'string', example: 'default' },
          tenantSlug: { type: 'string', example: 'default' },
          authMethod: { type: 'string', example: 'OIDC' },
          provider: { type: 'string', example: 'google' }
        }
      },
      VerifyTokenResponse: {
        type: 'object',
        required: ['status', 'message', 'errors', 'meta_data'],
        properties: {
          status: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Token verified successfully' },
          errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
          meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
          data: { $ref: '#/components/schemas/VerifyTokenData' },
          valid: { type: 'boolean', example: true, description: 'Direct backwards-compatibility field' },
          userId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          email: { type: 'string', example: 'user@example.com' },
          role: { type: 'string', example: 'USER' },
          error: { type: 'string', example: '', description: 'Error reason when token verification fails' }
        }
      },

      GetUserRequest: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }
        }
      },
        GrpcUserData: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'Alice Smith' },
            role: { type: 'string', example: 'USER' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        GetUserResponse: {
          type: 'object',
          required: ['status', 'message', 'errors', 'meta_data'],
          properties: {
            status: { type: 'boolean', example: true },
            message: { type: 'string', example: 'User retrieved successfully' },
            errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
            meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
            data: { $ref: '#/components/schemas/GrpcUserData' },
            id: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'Alice Smith' },
            role: { type: 'string', example: 'USER' },
          isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },

        // Config gRPC Messages (config.proto)
        GetConfigRequest: {
          type: 'object',
          required: ['key'],
          properties: {
            key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
            defaultValue: { type: 'string', example: 'STRIPE' }
          }
        },
          GrpcConfigData: {
            type: 'object',
            nullable: true,
            properties: {
              key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
              value: { type: 'string', example: 'STRIPE' },
              isEncrypted: { type: 'boolean', example: false }
            }
          },
          GetConfigResponse: {
            type: 'object',
            required: ['status', 'message', 'errors', 'meta_data'],
            properties: {
              status: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Config retrieved successfully' },
              errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
              meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
              data: { $ref: '#/components/schemas/GrpcConfigData' },
              key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
              value: { type: 'string', example: 'STRIPE' },
              isEncrypted: { type: 'boolean', example: false }
            }
          },

          GetActiveGatewayRequest: {
            type: 'object',
            description: 'Empty request message'
          },
            GrpcGatewayData: {
              type: 'object',
              properties: {
                provider: { type: 'string', enum: ['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK'], example: 'STRIPE' }
              }
            },
            GetActiveGatewayResponse: {
              type: 'object',
              required: ['status', 'message', 'errors', 'meta_data'],
              properties: {
                status: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Active payment gateway resolved' },
                errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
                meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
                data: { $ref: '#/components/schemas/GrpcGatewayData' },
                provider: { type: 'string', example: 'STRIPE' }
              }
            },

            // Inventory gRPC Messages (inventory.proto)
            CheckStockRequest: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string', example: 'prod-1' },
                quantity: { type: 'integer', example: 2 }
              }
            },
              GrpcStockCheckData: {
                type: 'object',
                properties: {
                  available: { type: 'boolean', example: true },
          availableQuantity: { type: 'integer', example: 100 }
                }
              },
              CheckStockResponse: {
                type: 'object',
                required: ['status', 'message', 'errors', 'meta_data'],
                properties: {
                  status: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Stock is available' },
                  errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
                  meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
                  data: { $ref: '#/components/schemas/GrpcStockCheckData' },
                  available: { type: 'boolean', example: true },
          availableQuantity: { type: 'integer', example: 100 }
                }
              },

                GrpcReserveStockRequest: {
                  type: 'object',
                  required: ['productId', 'quantity', 'orderId'],
                  properties: {
                    productId: { type: 'string', example: 'prod-1' },
                    quantity: { type: 'integer', example: 2 },
                    orderId: { type: 'string', example: 'ord-a1b2c3d4' }
                  }
                },
                  GrpcReserveStockData: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      productId: { type: 'string', example: 'prod-1' },
                      reservedQuantity: { type: 'integer', example: 2 },
                      orderId: { type: 'string', example: 'ord-a1b2c3d4' }
                    }
                  },
                  GrpcReserveStockResponse: {
                    type: 'object',
                    required: ['status', 'message', 'errors', 'meta_data'],
                    properties: {
                      status: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Stock reserved successfully' },
                      errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
                      meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
                      data: { $ref: '#/components/schemas/GrpcReserveStockData' },
                      success: { type: 'boolean', example: true }
                    }
                  },

                  // Audit gRPC Messages (audit.proto)
                  GrpcAuditLogRequest: {
                    type: 'object',
                    required: ['action', 'resource'],
                    properties: {
                      actorId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
                      actorEmail: { type: 'string', example: 'admin@enterprise.local' },
                      action: { type: 'string', example: 'ORDER_PLACED' },
                      resource: { type: 'string', example: 'Order' },
                      resourceId: { type: 'string', example: 'ord-a1b2c3d4' },
                      severity: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'], default: 'INFO' },
                      detailsJson: { type: 'string', example: '{"totalAmount": 259.98}' },
                      ipAddress: { type: 'string', example: '10.0.0.15' },
                      correlationId: { type: 'string', example: 'req-c7f8a9e1' }
                    }
                  },
                    GrpcAuditLogData: {
                      type: 'object',
                      properties: {
                        logId: { type: 'string', example: 'audit-log-9901' },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    },
                    GrpcAuditLogResponse: {
                      type: 'object',
                      required: ['status', 'message', 'errors', 'meta_data'],
                      properties: {
                        status: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Audit log recorded successfully' },
                        errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
                        meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
                        data: { $ref: '#/components/schemas/GrpcAuditLogData' },
                        success: { type: 'boolean', example: true },
          logId: { type: 'string', example: 'audit-log-9901' },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    },

                    QueryAuditRequest: {
                      type: 'object',
                      properties: {
                        actorId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
                        resource: { type: 'string', example: 'Order' },
                        action: { type: 'string', example: 'ORDER_PLACED' },
                        limit: { type: 'integer', default: 50, example: 50 }
                      }
                    },
                    GrpcAuditItem: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        actorId: { type: 'string' },
                        actorEmail: { type: 'string' },
                        action: { type: 'string' },
                        resource: { type: 'string' },
                        resourceId: { type: 'string' },
                        severity: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'] },
                        detailsJson: { type: 'string', example: '{}' },
                        ipAddress: { type: 'string' },
                        correlationId: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    },
                    QueryAuditData: {
                      type: 'object',
                      properties: {
                        items: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/GrpcAuditItem' }
                        }
                      }
                    },
                    QueryAuditResponse: {
                      type: 'object',
                      required: ['status', 'message', 'errors', 'meta_data'],
                      properties: {
                        status: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Audit logs retrieved successfully' },
                        errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
                        meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
                        data: { $ref: '#/components/schemas/QueryAuditData' },
                        items: {
                          type: 'array',
                          description: 'Direct array for backwards compatibility',
            items: { $ref: '#/components/schemas/GrpcAuditItem' }
                        }
                      }
                    },

                    // Common Gateway Dispatch Messages
                    GatewayDispatchRequest: {
                      type: 'object',
                      required: ['method', 'path'],
                      properties: {
                        method: { type: 'string', example: 'GET' },
                        path: { type: 'string', example: '/api/v1/organizations' },
                        headers: { type: 'object', additionalProperties: { type: 'string' } },
                        body: { type: 'string', format: 'byte', description: 'Raw byte buffer payload' },
                        clientIp: { type: 'string', example: '127.0.0.1' },
                        correlationId: { type: 'string', example: 'corr-c7f8a9e1' }
                      }
                    },
                    GatewayDispatchResponse: {
                      type: 'object',
                      required: ['statusCode'],
                      properties: {
                        statusCode: { type: 'integer', example: 200 },
                        headers: { type: 'object', additionalProperties: { type: 'string' } },
                        body: { type: 'string', format: 'byte', description: 'Raw byte buffer response' }
                      }
                    },

                    // AI Service gRPC Messages (ai.proto)
                    GrpcListProvidersRequest: {
                      type: 'object',
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        category: { type: 'string', example: 'COMMUNICATION' },
                        enabledOnly: { type: 'boolean', example: true }
                      }
                    },
                    GrpcRegisterProviderRequest: {
                      type: 'object',
                      required: ['slug', 'name', 'category', 'transportType'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        slug: { type: 'string', example: 'custom-mcp' },
                        name: { type: 'string', example: 'Custom MCP Provider' },
                        category: { type: 'string', example: 'EXTERNAL_MCP' },
                        transportType: { type: 'string', example: 'STREAMABLE_HTTP' },
                        endpointUrl: { type: 'string', example: 'http://internal-mcp:8080/mcp' },
                        authType: { type: 'string', example: 'BEARER' },
                        credentialsJson: { type: 'string', example: '{"token":"secret"}' },
                        configJson: { type: 'string', example: '{}' },
                        autoSync: { type: 'boolean', example: true }
                      }
                    },
                    GrpcListToolsRequest: {
                      type: 'object',
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        providerSlug: { type: 'string', example: 'communication-tools' },
                        search: { type: 'string', example: 'email' }
                      }
                    },
                    GrpcCallToolRequest: {
                      type: 'object',
                      required: ['toolName'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        providerSlug: { type: 'string', example: 'communication-tools' },
                        toolName: { type: 'string', example: 'send_email' },
                        qualifiedName: { type: 'string', example: 'communication-tools::send_email' },
                        argumentsJson: { type: 'string', example: '{"recipient":"user@example.com","subject":"Hello"}' },
                        actorId: { type: 'string', example: 'usr-123' },
                        correlationId: { type: 'string', example: 'corr-001' }
                      }
                    },
                    GrpcOrchestrateRequest: {
                      type: 'object',
                      required: ['stepsJson'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        mode: { type: 'string', enum: ['SEQUENTIAL', 'PARALLEL'], default: 'SEQUENTIAL' },
                        stopOnError: { type: 'boolean', default: true },
                        stepsJson: { type: 'string', example: '[{"tool":"search-tools::search_orders","arguments":{}}]' },
                        actorId: { type: 'string', example: 'usr-123' },
                        correlationId: { type: 'string', example: 'corr-001' }
                      }
                    },

                    // Organization Service gRPC Messages (organization.proto)
                    GetOrganizationByIdRequest: {
                      type: 'object',
                      required: ['id'],
                      properties: {
                        id: { type: 'string', format: 'uuid', example: 'org-uuid-123' }
                      }
                    },
                    GetOrganizationBySlugRequest: {
                      type: 'object',
                      required: ['slug'],
                      properties: {
                        slug: { type: 'string', example: 'acme-corp' }
                      }
                    },
                    GrpcListOrganizationsRequest: {
                      type: 'object',
                      properties: {
                        search: { type: 'string', example: 'Acme' },
                        status: { type: 'string', example: 'ACTIVE' },
                        tier: { type: 'string', example: 'ENTERPRISE' },
                        industry: { type: 'string', example: 'Technology' },
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 20 }
                      }
                    },
                    GrpcCreateOrganizationRequest: {
                      type: 'object',
                      required: ['name', 'slug', 'contactEmail'],
                      properties: {
                        name: { type: 'string', example: 'Acme Corporation' },
                        slug: { type: 'string', example: 'acme-corp' },
                        legalName: { type: 'string', example: 'Acme Corp LLC' },
                        tier: { type: 'string', example: 'ENTERPRISE' },
                        industry: { type: 'string', example: 'Technology' },
                        taxId: { type: 'string', example: 'US-987654321' },
                        contactEmail: { type: 'string', example: 'admin@acme.corp' },
                        contactPhone: { type: 'string', example: '+1-555-0199' },
                        website: { type: 'string', example: 'https://acme.corp' },
                        maxUsers: { type: 'integer', example: 100 }
                      }
                    },
                    GrpcUpdateOrganizationRequest: {
                      type: 'object',
                      required: ['id'],
                      properties: {
                        id: { type: 'string', format: 'uuid', example: 'org-uuid-123' },
                        name: { type: 'string', example: 'Acme Corp Updated' },
                        legalName: { type: 'string', example: 'Acme International LLC' },
                        industry: { type: 'string', example: 'Software' },
                        taxId: { type: 'string', example: 'US-987654321' },
                        contactEmail: { type: 'string', example: 'admin@acme.corp' },
                        contactPhone: { type: 'string', example: '+1-555-0199' },
                        website: { type: 'string', example: 'https://acme.corp' },
                        tier: { type: 'string', example: 'ENTERPRISE' },
                        maxUsers: { type: 'integer', example: 200 }
                      }
                    },
                    DeleteOrganizationRequest: {
                      type: 'object',
                      required: ['id'],
                      properties: {
                        id: { type: 'string', format: 'uuid', example: 'org-uuid-123' }
                      }
                    },

                    // RBAC Service gRPC Messages (rbac.proto)
                    GetRoleRequest: {
                      type: 'object',
                      required: ['id'],
                      properties: {
                        id: { type: 'string', format: 'uuid', example: 'role-uuid-123' },
                        tenantId: { type: 'string', example: 'tenant-alpha' }
                      }
                    },
                    GrpcListRolesRequest: {
                      type: 'object',
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 20 },
                        search: { type: 'string', example: 'SUPPORT' }
                      }
                    },
                    GrpcCreateRoleRequest: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        name: { type: 'string', example: 'SECURITY_AUDITOR' },
                        description: { type: 'string', example: 'Audit and compliance reviewer' },
                        permissions: { type: 'array', items: { type: 'string' }, example: ['audit:read', 'telemetry:read'] }
                      }
                    },
                    GrpcUpdateRoleRequest: {
                      type: 'object',
                      required: ['id'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        id: { type: 'string', format: 'uuid', example: 'role-uuid-123' },
                        name: { type: 'string', example: 'SECURITY_AUDITOR_SENIOR' },
                        description: { type: 'string', example: 'Senior audit reviewer' },
                        permissions: { type: 'array', items: { type: 'string' }, example: ['audit:read', 'telemetry:read', 'audit:remediate'] }
                      }
                    },
                    GrpcDeleteRoleRequest: {
                      type: 'object',
                      required: ['id'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        id: { type: 'string', format: 'uuid', example: 'role-uuid-123' }
                      }
                    },
                    GrpcListPermissionsRequest: {
                      type: 'object',
                      properties: {
                        category: { type: 'string', example: 'AUDIT' }
                      }
                    },
                    GrpcAssignUserRoleRequest: {
                      type: 'object',
                      required: ['userId', 'roleId'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        userId: { type: 'string', example: 'usr-4412' },
                        roleId: { type: 'string', format: 'uuid', example: 'role-uuid-123' },
                        assignedBy: { type: 'string', example: 'usr-admin-1' }
                      }
                    },
                    GrpcRevokeUserRoleRequest: {
                      type: 'object',
                      required: ['userId', 'roleId'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        userId: { type: 'string', example: 'usr-4412' },
                        roleId: { type: 'string', format: 'uuid', example: 'role-uuid-123' }
                      }
                    },
                    GrpcGetUserRolesRequest: {
                      type: 'object',
                      required: ['userId'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        userId: { type: 'string', example: 'usr-4412' }
                      }
                    },
                    GrpcCheckPermissionRequest: {
                      type: 'object',
                      required: ['userId', 'permission'],
                      properties: {
                        tenantId: { type: 'string', example: 'tenant-alpha' },
                        userId: { type: 'string', example: 'usr-4412' },
                        permission: { type: 'string', example: 'orders:cancel' }
                      }
                    }
                  }
                },
                paths: {
                  '/iam.IAMService/VerifyToken': {
                    post: {
                      tags: ['IAMService (gRPC :50051)'],
                      summary: 'RPC VerifyToken',
                      description: 'Synchronous token validation RPC called by API Gateway and services. Port: :50051.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': {
                            schema: { $ref: '#/components/schemas/VerifyTokenRequest' }
                          },
                          'application/json': {
                            schema: { $ref: '#/components/schemas/VerifyTokenRequest' }
                          }
                        }
                      },
                      responses: {
                        '200': {
                          description: 'Token validation response with standard envelope',
                          content: {
                            'application/grpc+proto': {
                              schema: { $ref: '#/components/schemas/VerifyTokenResponse' }
                            },
                            'application/json': {
                              schema: { $ref: '#/components/schemas/VerifyTokenResponse' }
                            }
                          }
                        }
                      }
                    }
                  },
                  '/iam.IAMService/GetUserById': {
                    post: {
                      tags: ['IAMService (gRPC :50051)'],
                      summary: 'RPC GetUserById',
                      description: 'Returns identity profile and role claims for a given user ID. Port: :50051.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': {
                            schema: { $ref: '#/components/schemas/GetUserRequest' }
                          },
                          'application/json': {
                            schema: { $ref: '#/components/schemas/GetUserRequest' }
                          }
                        }
                      },
                      responses: {
                        '200': {
                          description: 'User details with standard envelope',
                          content: {
                            'application/grpc+proto': {
                              schema: { $ref: '#/components/schemas/GetUserResponse' }
                            },
                            'application/json': {
                              schema: { $ref: '#/components/schemas/GetUserResponse' }
                            }
                          }
                        }
                      }
                    }
                  },

                  '/config.ConfigService/GetConfigByKey': {
                    post: {
                      tags: ['ConfigService (gRPC :50053)'],
                      summary: 'RPC GetConfigByKey',
                      description: 'Fetches dynamic configuration value with optional fallback default. Port: :50053.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': {
                            schema: { $ref: '#/components/schemas/GetConfigRequest' }
                          },
                          'application/json': {
                            schema: { $ref: '#/components/schemas/GetConfigRequest' }
                          }
                        }
                      },
                      responses: {
                        '200': {
                          description: 'Config response with standard envelope',
                          content: {
                            'application/grpc+proto': {
                              schema: { $ref: '#/components/schemas/GetConfigResponse' }
                            },
                            'application/json': {
                              schema: { $ref: '#/components/schemas/GetConfigResponse' }
                            }
                          }
                        }
                      }
                    }
                  },
                  '/config.ConfigService/GetActivePaymentGateway': {
                    post: {
                      tags: ['ConfigService (gRPC :50053)'],
                      summary: 'RPC GetActivePaymentGateway',
                      description: 'Synchronous sub-millisecond payment gateway resolution for transaction-service. Port: :50053.',
                      requestBody: {
                        content: {
                          'application/grpc+proto': {
                            schema: { $ref: '#/components/schemas/GetActiveGatewayRequest' }
                          },
                          'application/json': {
                            schema: { $ref: '#/components/schemas/GetActiveGatewayRequest' }
                          }
                        }
                      },
                      responses: {
                        '200': {
                          description: 'Active gateway response with standard envelope',
                          content: {
                            'application/grpc+proto': {
                              schema: { $ref: '#/components/schemas/GetActiveGatewayResponse' }
                            },
                            'application/json': {
                              schema: { $ref: '#/components/schemas/GetActiveGatewayResponse' }
                            }
                          }
                        }
                      }
                    }
                  },

                  '/inventory.InventoryService/CheckStock': {
                    post: {
                      tags: ['InventoryService (gRPC :50059)'],
                      summary: 'RPC CheckStock',
                      description: 'Checks stock availability before creating an order. Port: :50059.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': {
                            schema: { $ref: '#/components/schemas/CheckStockRequest' }
                          },
                          'application/json': {
                            schema: { $ref: '#/components/schemas/CheckStockRequest' }
                          }
                        }
                      },
                      responses: {
                        '200': {
                          description: 'Stock availability response with standard envelope',
                          content: {
                            'application/grpc+proto': {
                              schema: { $ref: '#/components/schemas/CheckStockResponse' }
                            },
                            'application/json': {
                              schema: { $ref: '#/components/schemas/CheckStockResponse' }
                            }
                          }
                        }
                      }
                    }
                  },
                  '/inventory.InventoryService/ReserveStock': {
                    post: {
                      tags: ['InventoryService (gRPC :50059)'],
                      summary: 'RPC ReserveStock',
                      description: 'Atomically reserves stock for a pending customer order. Port: :50059.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': {
              schema: { $ref: '#/components/schemas/GrpcReserveStockRequest' }
                          },
                          'application/json': {
              schema: { $ref: '#/components/schemas/GrpcReserveStockRequest' }
                          }
                        }
                      },
                      responses: {
                        '200': {
                          description: 'Reservation response with standard envelope',
                          content: {
                            'application/grpc+proto': {
                schema: { $ref: '#/components/schemas/GrpcReserveStockResponse' }
                            },
                            'application/json': {
                schema: { $ref: '#/components/schemas/GrpcReserveStockResponse' }
                            }
                          }
                        }
                      }
                    }
                  },

                  '/audit.AuditService/RecordAuditLog': {
                    post: {
                      tags: ['AuditService (gRPC :50061)'],
                      summary: 'RPC RecordAuditLog',
                      description: 'High-assurance synchronous audit record persistence. Port: :50061.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': {
                            schema: { $ref: '#/components/schemas/GrpcAuditLogRequest' }
                          },
                          'application/json': {
                            schema: { $ref: '#/components/schemas/GrpcAuditLogRequest' }
                          }
                        }
                      },
                      responses: {
                        '200': {
                          description: 'Audit log response with standard envelope',
                          content: {
                            'application/grpc+proto': {
                schema: { $ref: '#/components/schemas/GrpcAuditLogResponse' }
                            },
                            'application/json': {
                schema: { $ref: '#/components/schemas/GrpcAuditLogResponse' }
                            }
                          }
                        }
                      }
                    }
                  },
                  '/audit.AuditService/QueryAuditLogs': {
                    post: {
                      tags: ['AuditService (gRPC :50061)'],
                      summary: 'RPC QueryAuditLogs',
                      description: 'Synchronous structured audit log lookup RPC. Port: :50061.',
                      requestBody: {
                        content: {
                          'application/grpc+proto': {
                            schema: { $ref: '#/components/schemas/QueryAuditRequest' }
                          },
                          'application/json': {
                            schema: { $ref: '#/components/schemas/QueryAuditRequest' }
                          }
                        }
                      },
                      responses: {
                        '200': {
                          description: 'Audit items array with standard envelope',
                          content: {
                            'application/grpc+proto': {
                              schema: { $ref: '#/components/schemas/QueryAuditResponse' }
                            },
                            'application/json': {
                              schema: { $ref: '#/components/schemas/QueryAuditResponse' }
                            }
                          }
                        }
                      }
                    }
                  },
                  '/asset.AssetService/CreateAsset': {
                    post: {
                      tags: ['AssetService (gRPC :50052)'],
                      summary: 'RPC CreateAsset',
                      description: 'Registers a media/file asset via gRPC. Port: :50052.',
                      responses: { '200': { description: 'Asset created with standard envelope' } }
                    }
                  },
                  '/asset.AssetService/ListMyAssets': {
                    post: {
                      tags: ['AssetService (gRPC :50052)'],
                      summary: 'RPC ListMyAssets',
                      description: 'Lists assets owned by a user via gRPC. Port: :50052.',
                      responses: { '200': { description: 'Assets retrieved with standard envelope' } }
                    }
                  },
                  '/notification.NotificationService/SendNotification': {
                    post: {
                      tags: ['NotificationService (gRPC :50054)'],
                      summary: 'RPC SendNotification',
                      description: 'Dispatches an EMAIL/SMS/PUSH/WEBHOOK notification via gRPC. Port: :50054.',
                      responses: { '200': { description: 'Notification dispatched with standard envelope' } }
                    }
                  },
                  '/notification.NotificationService/ListNotifications': {
                    post: {
                      tags: ['NotificationService (gRPC :50054)'],
                      summary: 'RPC ListNotifications',
                      description: 'Lists recent notifications via gRPC. Port: :50054.',
                      responses: { '200': { description: 'Notifications retrieved with standard envelope' } }
                    }
                  },
                  '/scheduler.SchedulerService/ListJobs': {
                    post: {
                      tags: ['SchedulerService (gRPC :50055)'],
                      summary: 'RPC ListJobs',
                      description: 'Lists scheduled jobs via gRPC. Port: :50055.',
                      responses: { '200': { description: 'Scheduled jobs retrieved with standard envelope' } }
                    }
                  },
                  '/scheduler.SchedulerService/CreateJob': {
                    post: {
                      tags: ['SchedulerService (gRPC :50055)'],
                      summary: 'RPC CreateJob',
                      description: 'Registers a new cron job via gRPC. Port: :50055.',
                      responses: { '200': { description: 'Scheduled job registered with standard envelope' } }
                    }
                  },
                  '/scheduler.SchedulerService/TriggerJob': {
                    post: {
                      tags: ['SchedulerService (gRPC :50055)'],
                      summary: 'RPC TriggerJob',
                      description: 'Triggers a scheduled job immediately via gRPC. Port: :50055.',
                      responses: { '200': { description: 'Scheduled job triggered with standard envelope' } }
                    }
                  },
                  '/order.OrderService/CreateOrder': {
                    post: {
                      tags: ['OrderService (gRPC :50056)'],
                      summary: 'RPC CreateOrder',
                      description: 'Creates a customer order via gRPC. Port: :50056.',
                      responses: { '200': { description: 'Order created with standard envelope' } }
                    }
                  },
                  '/order.OrderService/GetOrderById': {
                    post: {
                      tags: ['OrderService (gRPC :50056)'],
                      summary: 'RPC GetOrderById',
                      description: 'Fetches order details by ID via gRPC. Port: :50056.',
                      responses: { '200': { description: 'Order retrieved with standard envelope' } }
                    }
                  },
                  '/order.OrderService/ListMyOrders': {
                    post: {
                      tags: ['OrderService (gRPC :50056)'],
                      summary: 'RPC ListMyOrders',
                      description: 'Lists orders for a user via gRPC. Port: :50056.',
                      responses: { '200': { description: 'Orders retrieved with standard envelope' } }
                    }
                  },
                  '/order.OrderService/CancelOrder': {
                    post: {
                      tags: ['OrderService (gRPC :50056)'],
                      summary: 'RPC CancelOrder',
                      description: 'Cancels an order via gRPC. Port: :50056.',
                      responses: { '200': { description: 'Order cancelled with standard envelope' } }
                    }
                  },
                  '/transaction.TransactionService/InitiatePayment': {
                    post: {
                      tags: ['TransactionService (gRPC :50057)'],
                      summary: 'RPC InitiatePayment',
                      description: 'Initiates a payment transaction via gRPC. Port: :50057.',
                      responses: { '200': { description: 'Payment initiated with standard envelope' } }
                    }
                  },
                  '/transaction.TransactionService/HandleWebhook': {
                    post: {
                      tags: ['TransactionService (gRPC :50057)'],
                      summary: 'RPC HandleWebhook',
                      description: 'Processes payment completion webhook via gRPC. Port: :50057.',
                      responses: { '200': { description: 'Webhook processed with standard envelope' } }
                    }
                  },
                  '/transaction.TransactionService/GetTransactionById': {
                    post: {
                      tags: ['TransactionService (gRPC :50057)'],
                      summary: 'RPC GetTransactionById',
                      description: 'Retrieves transaction details by ID via gRPC. Port: :50057.',
                      responses: { '200': { description: 'Transaction retrieved with standard envelope' } }
                    }
                  },
                  '/search.SearchService/Search': {
                    post: {
                      tags: ['SearchService (gRPC :50058)'],
                      summary: 'RPC Search',
                      description: 'Executes full-text search query via gRPC. Port: :50058.',
                      responses: { '200': { description: 'Search results returned with standard envelope' } }
                    }
                  },
                  '/ai.AIService/CallTool': {
                    post: {
                      tags: ['AIService (gRPC :50060)'],
                      summary: 'RPC CallTool',
                      description: 'Invokes an MCP or external provider tool via gRPC. Port: :50060.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcCallToolRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcCallToolRequest' } }
                        }
                      },
                      responses: { '200': { description: 'MCP tool execution result returned with standard envelope' } }
                    }
                  },
                  '/ai.AIService/Orchestrate': {
                    post: {
                      tags: ['AIService (gRPC :50060)'],
                      summary: 'RPC Orchestrate',
                      description: 'Executes multi-step or parallel MCP tool orchestration via gRPC. Port: :50060.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcOrchestrateRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcOrchestrateRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Orchestration results returned with standard envelope' } }
                    }
                  },
                  '/ai.AIService/ListProviders': {
                    post: {
                      tags: ['AIService (gRPC :50060)'],
                      summary: 'RPC ListProviders',
                      description: 'Lists registered MCP & API providers via gRPC. Port: :50060.',
                      requestBody: {
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcListProvidersRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcListProvidersRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Providers list returned with standard envelope' } }
                    }
                  },
                  '/ai.AIService/RegisterProvider': {
                    post: {
                      tags: ['AIService (gRPC :50060)'],
                      summary: 'RPC RegisterProvider',
                      description: 'Registers an extensible MCP / external API provider via gRPC. Port: :50060.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcRegisterProviderRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcRegisterProviderRequest' } }
                        }
                      },
                      responses: { '201': { description: 'Provider registered with standard envelope' } }
                    }
                  },
                  '/ai.AIService/ListTools': {
                    post: {
                      tags: ['AIService (gRPC :50060)'],
                      summary: 'RPC ListTools',
                      description: 'Lists discovered MCP tools via gRPC. Port: :50060.',
                      requestBody: {
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcListToolsRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcListToolsRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Tools list returned with standard envelope' } }
                    }
                  },
                  '/ai.AIService/HealthCheck': {
                    post: {
                      tags: ['AIService (gRPC :50060)'],
                      summary: 'RPC HealthCheck',
                      description: 'Probes AI Service gRPC health status and uptime. Port: :50060.',
                      responses: { '200': { description: 'Service health check response' } }
                    }
                  },
                  '/ai.AIService/Dispatch': {
                    post: {
                      tags: ['AIService (gRPC :50060)'],
                      summary: 'RPC Dispatch (Gateway Upstream Bridge)',
                      description: 'Universal Gateway Dispatch RPC bridging HTTP REST requests to the internal microservice pipeline.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GatewayDispatchRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GatewayDispatchRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Gateway dispatch response payload' } }
                    }
                  },

                  // OrganizationService (gRPC :50062)
                  '/organization.OrganizationService/GetOrganizationById': {
                    post: {
                      tags: ['OrganizationService (gRPC :50062)'],
                      summary: 'RPC GetOrganizationById',
                      description: 'Retrieves organization profile by unique UUID via gRPC. Port: :50062.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GetOrganizationByIdRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GetOrganizationByIdRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Organization returned with standard envelope' } }
                    }
                  },
                  '/organization.OrganizationService/GetOrganizationBySlug': {
                    post: {
                      tags: ['OrganizationService (gRPC :50062)'],
                      summary: 'RPC GetOrganizationBySlug',
                      description: 'Resolves organization metadata by slug via gRPC. Port: :50062.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GetOrganizationBySlugRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GetOrganizationBySlugRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Organization returned with standard envelope' } }
                    }
                  },
                  '/organization.OrganizationService/ListOrganizations': {
                    post: {
                      tags: ['OrganizationService (gRPC :50062)'],
                      summary: 'RPC ListOrganizations',
                      description: 'Lists organizations with filtering and pagination via gRPC. Port: :50062.',
                      requestBody: {
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcListOrganizationsRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcListOrganizationsRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Organizations list returned with standard envelope' } }
                    }
                  },
                  '/organization.OrganizationService/CreateOrganization': {
                    post: {
                      tags: ['OrganizationService (gRPC :50062)'],
                      summary: 'RPC CreateOrganization',
                      description: 'Creates a new multi-tenant organization via gRPC. Port: :50062.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcCreateOrganizationRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcCreateOrganizationRequest' } }
                        }
                      },
                      responses: { '201': { description: 'Organization created with standard envelope' } }
                    }
                  },
                  '/organization.OrganizationService/UpdateOrganization': {
                    post: {
                      tags: ['OrganizationService (gRPC :50062)'],
                      summary: 'RPC UpdateOrganization',
                      description: 'Updates organization profile details via gRPC. Port: :50062.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcUpdateOrganizationRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcUpdateOrganizationRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Organization updated with standard envelope' } }
                    }
                  },
                  '/organization.OrganizationService/DeleteOrganization': {
                    post: {
                      tags: ['OrganizationService (gRPC :50062)'],
                      summary: 'RPC DeleteOrganization',
                      description: 'Soft deletes organization by ID via gRPC. Port: :50062.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/DeleteOrganizationRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/DeleteOrganizationRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Organization deleted with standard envelope' } }
                    }
                  },
                  '/organization.OrganizationService/HealthCheck': {
                    post: {
                      tags: ['OrganizationService (gRPC :50062)'],
                      summary: 'RPC HealthCheck',
                      description: 'Probes organization-service gRPC health status. Port: :50062.',
                      responses: { '200': { description: 'Health check response' } }
                    }
                  },
                  '/organization.OrganizationService/Dispatch': {
                    post: {
                      tags: ['OrganizationService (gRPC :50062)'],
                      summary: 'RPC Dispatch (Gateway Upstream Bridge)',
                      description: 'Universal Gateway Dispatch RPC bridging HTTP REST requests to the internal microservice pipeline.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GatewayDispatchRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GatewayDispatchRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Gateway dispatch response payload' } }
                    }
                  },

                  // RbacService (gRPC :50063)
                  '/rbac.RbacService/GetRole': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC GetRole',
                      description: 'Retrieves role definition and mapped permissions via gRPC. Port: :50063.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GetRoleRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GetRoleRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Role returned with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/ListRoles': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC ListRoles',
                      description: 'Lists roles defined for a tenant via gRPC. Port: :50063.',
                      requestBody: {
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcListRolesRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcListRolesRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Roles list returned with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/CreateRole': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC CreateRole',
                      description: 'Creates a custom role with permissions via gRPC. Port: :50063.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcCreateRoleRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcCreateRoleRequest' } }
                        }
                      },
                      responses: { '201': { description: 'Role created with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/UpdateRole': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC UpdateRole',
                      description: 'Updates role description and assigned permissions via gRPC. Port: :50063.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcUpdateRoleRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcUpdateRoleRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Role updated with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/DeleteRole': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC DeleteRole',
                      description: 'Deletes custom role via gRPC. Port: :50063.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcDeleteRoleRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcDeleteRoleRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Role deleted with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/ListPermissions': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC ListPermissions',
                      description: 'Lists all available platform permissions via gRPC. Port: :50063.',
                      requestBody: {
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcListPermissionsRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcListPermissionsRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Permissions list returned with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/AssignUserRole': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC AssignUserRole',
                      description: 'Assigns role to user within tenant boundary via gRPC. Port: :50063.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcAssignUserRoleRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcAssignUserRoleRequest' } }
                        }
                      },
                      responses: { '201': { description: 'Role assigned with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/RevokeUserRole': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC RevokeUserRole',
                      description: 'Revokes assigned role from user via gRPC. Port: :50063.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcRevokeUserRoleRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcRevokeUserRoleRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Role revoked with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/GetUserRoles': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC GetUserRoles',
                      description: 'Retrieves all role assignments for a user via gRPC. Port: :50063.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcGetUserRolesRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcGetUserRolesRequest' } }
                        }
                      },
                      responses: { '200': { description: 'User roles returned with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/CheckPermission': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC CheckPermission',
                      description: 'Evaluates whether a user has a specific permission in a tenant context. Port: :50063.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GrpcCheckPermissionRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GrpcCheckPermissionRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Permission evaluation returned with standard envelope' } }
                    }
                  },
                  '/rbac.RbacService/HealthCheck': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC HealthCheck',
                      description: 'Probes rbac-service gRPC health status and uptime. Port: :50063.',
                      responses: { '200': { description: 'Service health check response' } }
                    }
                  },
                  '/rbac.RbacService/Dispatch': {
                    post: {
                      tags: ['RbacService (gRPC :50063)'],
                      summary: 'RPC Dispatch (Gateway Upstream Bridge)',
                      description: 'Universal Gateway Dispatch RPC bridging HTTP REST requests to the internal microservice pipeline.',
                      requestBody: {
                        required: true,
                        content: {
                          'application/grpc+proto': { schema: { $ref: '#/components/schemas/GatewayDispatchRequest' } },
                          'application/json': { schema: { $ref: '#/components/schemas/GatewayDispatchRequest' } }
                        }
                      },
                      responses: { '200': { description: 'Gateway dispatch response payload' } }
                    }
                  }
                }
              };
