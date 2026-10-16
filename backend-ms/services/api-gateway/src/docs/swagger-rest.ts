import { commonSchemas } from './swagger-schemas.js';

export const swaggerRestDoc = {
  openapi: '3.0.3',
  info: {
    title: 'Enterprise Microservices Platform - HTTP REST API',
    version: '1.0.0',
    description: `Production-grade Domain-Driven Design (DDD) Microservices HTTP REST API.
    
All responses strictly conform to the unified standard envelope format:
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
      url: 'http://localhost:4011',
      description: 'Audit Service (Direct)'
    }
  ],
  tags: [
    { name: 'Gateway Health', description: 'API Gateway health and aggregation monitoring' },
    { name: 'IAM Service', description: 'Authentication, registration, JWT issuance, and RBAC' },
    { name: 'Order Service', description: 'Order lifecycle, inventory validation, and checkout totals' },
    { name: 'Inventory Service', description: 'Stock tracking, reservations, and inventory ingestion' },
    { name: 'Transaction Service', description: 'Payment processing, multi-provider gateways, and webhooks' },
    { name: 'Config Service', description: 'Dynamic system configuration and payment provider toggles' },
    { name: 'Asset Service', description: 'Media storage paths, file registry, and asset metadata' },
    { name: 'Notification Service', description: 'Multi-channel dispatch (Email, SMS, Push, Webhooks)' },
    { name: 'Scheduler Service', description: 'Distributed cron execution and periodic jobs' },
    { name: 'Search Service', description: 'Full-text indexed search queries' },
    { name: 'Audit Service', description: 'Immutable audit logs and telemetry adapters' }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT bearer token issued by the IAM service.'
      }
    },
    schemas: {
      ...commonSchemas,

      // IAM schemas
      RegisterUserRequest: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 8, example: 'SuperSecurePassword123!' },
          name: { type: 'string', minLength: 2, example: 'Alice Smith' },
          role: { type: 'string', enum: ['USER', 'ADMIN', 'SUPPORT'], default: 'USER', example: 'USER' }
        }
      },
      LoginUserRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', example: 'SuperSecurePassword123!' }
        }
      },
      AuthResponseData: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
              email: { type: 'string', example: 'user@example.com' },
              name: { type: 'string', example: 'Alice Smith' },
              role: { type: 'string', example: 'USER' }
            }
          }
        }
      },

      // Order schemas
      OrderItemInput: {
        type: 'object',
        required: ['productId', 'productName', 'quantity', 'unitPrice'],
        properties: {
          productId: { type: 'string', example: 'prod-101' },
          productName: { type: 'string', example: 'Mechanical Keyboard' },
          quantity: { type: 'integer', minimum: 1, example: 2 },
          unitPrice: { type: 'number', minimum: 0.01, example: 129.99 }
        }
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItemInput' }
          },
          currency: { type: 'string', default: 'USD', example: 'USD' }
        }
      },
      OrderResponseData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'ord-a1b2c3d4-e5f6' },
          userId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          status: { type: 'string', enum: ['PENDING', 'PAID', 'CANCELLED'], example: 'PENDING' },
          totalAmount: { type: 'number', example: 259.98 },
          currency: { type: 'string', example: 'USD' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItemInput' }
          },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },

      // Inventory schemas
      AddStockRequest: {
        type: 'object',
        required: ['productId', 'sku', 'quantity'],
        properties: {
          productId: { type: 'string', example: 'prod-101' },
          sku: { type: 'string', example: 'SKU-KB-RGB-01' },
          quantity: { type: 'integer', minimum: 1, example: 50 }
        }
      },
      ReserveStockRequest: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string', example: 'prod-101' },
          quantity: { type: 'integer', minimum: 1, example: 2 }
        }
      },

      // Transaction schemas
      InitiatePaymentRequest: {
        type: 'object',
        required: ['referenceId', 'amount'],
        properties: {
          referenceId: { type: 'string', example: 'ord-a1b2c3d4-e5f6', description: 'Order ID or checkout reference' },
          amount: { type: 'number', minimum: 0.01, example: 259.98 },
          currency: { type: 'string', default: 'USD', example: 'USD' },
          paymentMethod: { type: 'string', example: 'CARD' }
        }
      },
      PaymentWebhookRequest: {
        type: 'object',
        required: ['transactionId', 'status'],
        properties: {
          transactionId: { type: 'string', example: 'txn-101' },
          status: { type: 'string', enum: ['SUCCESS', 'FAILED'], example: 'SUCCESS' },
          providerTxnId: { type: 'string', example: 'ch_3N4yAb2eZvKYlo2C0Wxyz' },
          failureReason: { type: 'string' }
        }
      },

      // Config schemas
      SetConfigRequest: {
        type: 'object',
        required: ['key', 'value'],
        properties: {
          key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
          value: { type: 'string', example: 'STRIPE' },
          description: { type: 'string', example: 'Global payment gateway selector' },
          isEncrypted: { type: 'boolean', default: false, example: false }
        }
      },

      // Asset schemas
      CreateAssetRequest: {
        type: 'object',
        required: ['name', 'mimeType', 'sizeBytes', 'storagePath'],
        properties: {
          name: { type: 'string', example: 'product-hero.webp' },
          mimeType: { type: 'string', example: 'image/webp' },
          sizeBytes: { type: 'integer', example: 245100 },
          storagePath: { type: 'string', example: '/assets/uploads/product-hero.webp' }
        }
      },

      // Notification schemas
      SendNotificationRequest: {
        type: 'object',
        required: ['recipient', 'channel', 'subject', 'body'],
        properties: {
          recipient: { type: 'string', example: 'alice@example.com' },
          channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'WEBHOOK'], example: 'EMAIL' },
          subject: { type: 'string', example: 'Your Order #ord-a1b2c3d4 is Confirmed' },
          body: { type: 'string', example: 'Thank you for your order! We are packing your items.' }
        }
      },

      // Scheduler schemas
      CreateJobRequest: {
        type: 'object',
        required: ['name', 'cronExpression'],
        properties: {
          name: { type: 'string', example: 'daily-reconciliation-job' },
          cronExpression: { type: 'string', example: '0 0 * * *' }
        }
      },

      // Audit schemas
      RecordAuditRequest: {
        type: 'object',
        required: ['action', 'resource'],
        properties: {
          actorId: { type: 'string', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
          actorEmail: { type: 'string', example: 'admin@enterprise.local' },
          action: { type: 'string', example: 'CONFIG_UPDATED' },
          resource: { type: 'string', example: 'SystemConfig' },
          resourceId: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
          severity: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'], default: 'INFO' },
          details: { type: 'object', example: { changedFrom: 'STRIPE', changedTo: 'PAYPAL' } },
          ipAddress: { type: 'string', example: '127.0.0.1' },
          correlationId: { type: 'string', example: 'req-c7f8a9e1' }
        }
      }
    }
  },
  paths: {
    // Gateway Health
    '/health': {
      get: {
        tags: ['Gateway Health'],
        summary: 'Gateway Liveness Probe',
        description: 'Returns the health status of the API Gateway.',
        responses: {
          '200': {
            description: 'Gateway is healthy and operational',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/health/detailed': {
      get: {
        tags: ['Gateway Health'],
        summary: 'Aggregated Platform Health Check',
        description: 'Probes all 10 downstream microservices and returns individual latencies and statuses.',
        responses: {
          '200': {
            description: 'All downstream microservices are healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          },
          '503': {
            description: 'One or more downstream services are degraded or unavailable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' }
              }
            }
          }
        }
      }
    },

    // IAM Service
    '/api/v1/iam/register': {
      post: {
        tags: ['IAM Service'],
        summary: 'Register New User',
        description: 'Registers a new user account with hashed password and publishes an event to RabbitMQ.',
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
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/StandardResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/AuthResponseData' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            description: 'Validation error or duplicate email',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/iam/login': {
      post: {
        tags: ['IAM Service'],
        summary: 'User Login & Token Issuance',
        description: 'Authenticates user credentials and issues a signed JWT token.',
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
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/StandardResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/AuthResponseData' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/iam/profile': {
      get: {
        tags: ['IAM Service'],
        summary: 'Get Current User Profile',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          },
          '401': {
            description: 'Unauthorized - invalid or missing token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/iam/users/{id}': {
      get: {
        tags: ['IAM Service'],
        summary: 'Get User By ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'User ID' }
        ],
        responses: {
          '200': {
            description: 'User found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          },
          '404': {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' }
              }
            }
          }
        }
      }
    },

    // Order Service
    '/api/v1/orders': {
      post: {
        tags: ['Order Service'],
        summary: 'Create New Order',
        description: 'Creates a basket order. Checks real-time stock via synchronous gRPC to inventory-service.',
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
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/StandardResponse' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/OrderResponseData' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            description: 'Insufficient stock or validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/orders/my': {
      get: {
        tags: ['Order Service'],
        summary: 'List Authenticated User Orders',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Orders retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/orders/{id}': {
      get: {
        tags: ['Order Service'],
        summary: 'Get Order by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Order found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          },
          '404': {
            description: 'Order not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/orders/{id}/cancel': {
      post: {
        tags: ['Order Service'],
        summary: 'Cancel Order',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Order cancelled successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },

    // Inventory Service
    '/api/v1/inventory/{productId}': {
      get: {
        tags: ['Inventory Service'],
        summary: 'Get Stock Level',
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Stock details returned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/inventory/reserve': {
      post: {
        tags: ['Inventory Service'],
        summary: 'Reserve Stock Quantity',
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
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/inventory/stock': {
      post: {
        tags: ['Inventory Service'],
        summary: 'Add Stock Quantity',
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
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },

    // Transaction Service
    '/api/v1/transactions/initiate': {
      post: {
        tags: ['Transaction Service'],
        summary: 'Initiate Payment Transaction',
        description: 'Resolves active payment gateway dynamically via gRPC to config-service and dispatches hosted checkout.',
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
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/transactions/webhook': {
      post: {
        tags: ['Transaction Service'],
        summary: 'Handle Payment Gateway Webhook',
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
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/transactions/{id}': {
      get: {
        tags: ['Transaction Service'],
        summary: 'Get Transaction by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Transaction details returned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },

    // Config Service
    '/api/v1/config': {
      get: {
        tags: ['Config Service'],
        summary: 'List All Dynamic Configs',
        responses: {
          '200': {
            description: 'List of configurations',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Config Service'],
        summary: 'Set Dynamic Configuration Key',
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
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/config/{key}': {
      get: {
        tags: ['Config Service'],
        summary: 'Get Config by Key',
        parameters: [
          { name: 'key', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Config key value',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Config Service'],
        summary: 'Delete Config Key',
        parameters: [
          { name: 'key', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Config key deleted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },

    // Asset Service
    '/api/v1/assets': {
      post: {
        tags: ['Asset Service'],
        summary: 'Register Media Asset',
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
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/assets/my': {
      get: {
        tags: ['Asset Service'],
        summary: 'List Assets Owned by User',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'User assets returned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },

    // Notification Service
    '/api/v1/notifications': {
      post: {
        tags: ['Notification Service'],
        summary: 'Send Multi-Channel Notification',
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
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      },
      get: {
        tags: ['Notification Service'],
        summary: 'List Recent Notifications',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
        ],
        responses: {
          '200': {
            description: 'Notifications list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },

    // Scheduler Service
    '/api/v1/scheduler/jobs': {
      get: {
        tags: ['Scheduler Service'],
        summary: 'List Cron Jobs',
        responses: {
          '200': {
            description: 'List of registered jobs',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Scheduler Service'],
        summary: 'Register Scheduled Job',
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
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/scheduler/jobs/{id}/trigger': {
      post: {
        tags: ['Scheduler Service'],
        summary: 'Trigger Job Manually',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Job execution initiated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },

    // Search Service
    '/api/v1/search': {
      get: {
        tags: ['Search Service'],
        summary: 'Full-Text Search Query',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search keywords' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['order', 'user', 'all'] }, description: 'Entity filter' }
        ],
        responses: {
          '200': {
            description: 'Search results returned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
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
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      },
      get: {
        tags: ['Audit Service'],
        summary: 'Query Audit Logs',
        parameters: [
          { name: 'actorId', in: 'query', schema: { type: 'string' } },
          { name: 'resource', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
        ],
        responses: {
          '200': {
            description: 'Audit logs returned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/audit/config': {
      get: {
        tags: ['Audit Service'],
        summary: 'Get Active Monitoring Adapters',
        responses: {
          '200': {
            description: 'Active monitoring configuration',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/audit/grafana/annotations': {
      get: {
        tags: ['Audit Service'],
        summary: 'Grafana Dashboard Annotations',
        responses: {
          '200': {
            description: 'Annotations array'
          }
        }
      }
    }
  }
};
