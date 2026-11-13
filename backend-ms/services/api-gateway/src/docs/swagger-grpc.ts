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
    { name: 'AuditService (gRPC :50061)', description: 'Synchronous audit logging, telemetry query, and Gateway Dispatch RPCs' }
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
                      responses: { '200': { description: 'MCP tool execution result returned with standard envelope' } }
                    }
                  },
                  '/ai.AIService/Orchestrate': {
                    post: {
                      tags: ['AIService (gRPC :50060)'],
                      summary: 'RPC Orchestrate',
                      description: 'Executes multi-step or parallel MCP tool orchestration via gRPC. Port: :50060.',
                      responses: { '200': { description: 'Orchestration results returned with standard envelope' } }
                    }
                  }
                }
              };
