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
    "requestId": "req-...",
    "timestamp": "ISO-8601",
    "debug": { "service": "...", "env": "..." },
    "pagination": { "page": 1, "limit": 20, "total": 100 },
    "further_steps": ["..."]
  }
}
\`\`\`

### 📡 Active gRPC Services & Ports
| Service | Package | gRPC Port | Protocol Buffer File | Key Consumers |
|---|---|---|---|---|
| **IAMService** | \`iam\` | \`:50051\` | \`iam.proto\` | API Gateway, Internal Microservices |
| **ConfigService** | \`config\` | \`:50053\` | \`config.proto\` | Transaction Service, Audit Service |
| **InventoryService** | \`inventory\` | \`:50059\` | \`inventory.proto\` | Order Service |
| **AuditService** | \`audit\` | \`:50061\` | \`audit.proto\` | All Microservices (Synchronous Audits) |
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
      url: 'grpc://localhost:50053',
      description: 'Config Service gRPC Endpoint (:50053)'
    },
    {
      url: 'grpc://localhost:50059',
      description: 'Inventory Service gRPC Endpoint (:50059)'
    },
    {
      url: 'grpc://localhost:50061',
      description: 'Audit Service gRPC Endpoint (:50061)'
    }
  ],
  tags: [
    { name: 'IAMService (gRPC :50051)', description: 'Identity, token verification, and user lookup RPCs' },
    { name: 'ConfigService (gRPC :50053)', description: 'Dynamic system configuration & payment gateway resolution RPCs' },
    { name: 'InventoryService (gRPC :50059)', description: 'Real-time stock checking & stock reservation RPCs' },
    { name: 'AuditService (gRPC :50061)', description: 'Synchronous audit logging & telemetry query RPCs' }
  ],
  components: {
    schemas: {
      ...commonSchemas,

      // gRPC MetaData Schema
      GrpcStandardMetaData: {
        type: 'object',
        properties: {
          request_id: { type: 'string', example: 'req-grpc-c7f8a9e1' },
          timestamp: { type: 'string', format: 'date-time', example: '2026-10-16T10:30:00.000Z' },
          debug_data: {
            type: 'object',
            additionalProperties: { type: 'string' },
            example: { service: 'iam-service', env: 'development', latencyMs: '4' }
          },
          pagination: {
            type: 'object',
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
            example: ['Attach verified user headers downstream']
          }
        }
      },

      // IAM gRPC Messages
      VerifyTokenRequest: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Raw JWT bearer token string' }
        }
      },
      VerifyTokenData: {
        type: 'object',
        properties: {
          valid: { type: 'boolean', example: true },
          userId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          email: { type: 'string', example: 'user@example.com' },
          role: { type: 'string', example: 'USER' }
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
          valid: { type: 'boolean', example: true, description: 'Direct accessor for backwards compatibility' },
          userId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          email: { type: 'string', example: 'user@example.com' },
          role: { type: 'string', example: 'USER' }
        }
      },

      GetUserRequest: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }
        }
      },
      UserData: {
        type: 'object',
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
          data: { $ref: '#/components/schemas/UserData' },
          id: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          email: { type: 'string', example: 'user@example.com' },
          name: { type: 'string', example: 'Alice Smith' },
          role: { type: 'string', example: 'USER' },
          isActive: { type: 'boolean', example: true }
        }
      },

      // Config gRPC Messages
      GetConfigRequest: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
          defaultValue: { type: 'string', example: 'STRIPE' }
        }
      },
      ConfigData: {
        type: 'object',
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
          message: { type: 'string', example: 'Config resolved successfully' },
          errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
          meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
          data: { $ref: '#/components/schemas/ConfigData' },
          key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
          value: { type: 'string', example: 'STRIPE' },
          isEncrypted: { type: 'boolean', example: false }
        }
      },

      GetActiveGatewayRequest: {
        type: 'object',
        description: 'Empty request message'
      },
      GatewayData: {
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
          data: { $ref: '#/components/schemas/GatewayData' },
          provider: { type: 'string', example: 'STRIPE' }
        }
      },

      // Inventory gRPC Messages
      CheckStockRequest: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string', example: 'prod-101' },
          quantity: { type: 'integer', example: 2 }
        }
      },
      StockCheckData: {
        type: 'object',
        properties: {
          available: { type: 'boolean', example: true },
          availableQuantity: { type: 'integer', example: 45 }
        }
      },
      CheckStockResponse: {
        type: 'object',
        required: ['status', 'message', 'errors', 'meta_data'],
        properties: {
          status: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Stock availability verified' },
          errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
          meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
          data: { $ref: '#/components/schemas/StockCheckData' },
          available: { type: 'boolean', example: true },
          availableQuantity: { type: 'integer', example: 45 }
        }
      },

      ReserveStockRequest: {
        type: 'object',
        required: ['productId', 'quantity', 'orderId'],
        properties: {
          productId: { type: 'string', example: 'prod-101' },
          quantity: { type: 'integer', example: 2 },
          orderId: { type: 'string', example: 'ord-a1b2c3d4' }
        }
      },
      ReserveStockResponse: {
        type: 'object',
        required: ['status', 'message', 'errors', 'meta_data'],
        properties: {
          status: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Stock reserved successfully' },
          errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
          meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
          data: {
            type: 'object',
            properties: {
              productId: { type: 'string', example: 'prod-101' },
              reservedQuantity: { type: 'integer', example: 2 }
            }
          },
          success: { type: 'boolean', example: true }
        }
      },

      // Audit gRPC Messages
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
      AuditLogResponse: {
        type: 'object',
        required: ['status', 'message', 'errors', 'meta_data'],
        properties: {
          status: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Audit record persisted synchronously' },
          errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
          meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
          data: {
            type: 'object',
            properties: {
              logId: { type: 'string', example: 'audit-log-9901' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          },
          success: { type: 'boolean', example: true },
          logId: { type: 'string', example: 'audit-log-9901' }
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
      QueryAuditResponse: {
        type: 'object',
        required: ['status', 'message', 'errors', 'meta_data'],
        properties: {
          status: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Audit query executed' },
          errors: { type: 'array', items: { $ref: '#/components/schemas/ErrorDetail' }, example: [] },
          meta_data: { $ref: '#/components/schemas/GrpcStandardMetaData' },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    actorId: { type: 'string' },
                    action: { type: 'string' },
                    resource: { type: 'string' },
                    severity: { type: 'string' },
                    timestamp: { type: 'string' }
                  }
                }
              }
            }
          },
          items: {
            type: 'array',
            description: 'Direct array for backwards compatibility',
            items: { type: 'object' }
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
              schema: { $ref: '#/components/schemas/ReserveStockRequest' }
            },
            'application/json': {
              schema: { $ref: '#/components/schemas/ReserveStockRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Reservation response with standard envelope',
            content: {
              'application/grpc+proto': {
                schema: { $ref: '#/components/schemas/ReserveStockResponse' }
              },
              'application/json': {
                schema: { $ref: '#/components/schemas/ReserveStockResponse' }
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
                schema: { $ref: '#/components/schemas/AuditLogResponse' }
              },
              'application/json': {
                schema: { $ref: '#/components/schemas/AuditLogResponse' }
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
    }
  }
};
