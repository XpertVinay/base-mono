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
  description: 'Forbidden - requires administrative privileges (ADMIN, SUPER_ADMIN, SUPPORT, or ORGANIZATION_ADMIN)',
  content: middlewareErrorContent
};

export const swaggerBackofficeDoc = {
  openapi: '3.0.3',
  info: {
    title: 'Enterprise Microservices Platform - Back-Office REST API',
    version: '1.0.0',
    description: `Dedicated Back-Office REST API suite designed specifically for consumption by the Back-Office Management Portal.

### Access Control & Perimeter Defense
- **Perimeter Guard**: All endpoints under \`/api/v1/backoffice/*\` and \`/api/backoffice/*\` are strictly guarded at the API Gateway perimeter.
- **Role Requirements**: Callers must possess one of: \`ADMIN\`, \`SUPER_ADMIN\`, \`SUPPORT\`, or \`ORGANIZATION_ADMIN\`.
- **Inter-Service Access**: Authorized internal services may authenticate via \`x-internal-secret\`.
- **Tenant Isolation**: Administrative queries require or scope against \`x-tenant-id\` header to enforce data isolation.
- **Device Security**: High-privilege operations validate \`x-device-fingerprint\` to prevent session hijacking.

### Response Envelope Format
All endpoints return the unified standard response envelope:
\`\`\`json
{
  "status": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "errors": [],
  "meta_data": {
    "requestId": "req-...",
    "timestamp": "ISO-8601",
    "pagination": { "page": 1, "limit": 20, "total": 100 }
  }
}
\`\`\`
`,
    contact: {
      name: 'Back-Office Platform Engineering',
      email: 'backoffice-dev@enterprise.local'
    }
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'API Gateway (Central Back-Office Ingress)'
    }
  ],
  tags: [
    { name: 'Back-Office: Discovery', description: 'Catalog and route discovery for back-office frontend navigation' },
    { name: 'Back-Office: IAM & Users', description: 'User administration, profile management, status locks, and password resets' },
    { name: 'Back-Office: Orders', description: 'Order lifecycle management, status overrides, and transaction tracking' },
    { name: 'Back-Office: Inventory', description: 'Stock levels, SKU catalog ingestion, and warehouse inventory adjustment' },
    { name: 'Back-Office: Transactions', description: 'Financial ledger, payment status overrides, and manual transaction logging' },
    { name: 'Back-Office: Assets', description: 'Digital media asset storage, metadata review, and asset purging' },
    { name: 'Back-Office: Audit Logs', description: 'Immutable security audit logs, compliance forensics, and log remediation' },
    { name: 'Back-Office: System Configuration', description: 'Dynamic tenant settings, payment gateway toggles, and feature flags' },
    { name: 'Back-Office: Organizations', description: 'Multi-tenant organization lifecycle, tier onboarding, and membership management' },
    { name: 'Back-Office: RBAC & Permissions', description: 'Custom roles definition, granular permissions catalog, and user-role assignment' },
    { name: 'Back-Office: Distributed Scheduler', description: 'Cron job scheduling, cadence configuration, and immediate execution triggers' },
    { name: 'Back-Office: Search Catalog', description: 'Full-text indexed search document administration and index re-building' },
    { name: 'Back-Office: Notifications', description: 'System alert dispatch, emergency broadcasts, and delivery receipt logs' },
    { name: 'Back-Office: AI & MCP Providers', description: 'Model Context Protocol (MCP) server integration, external tool registry, and AI providers' }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Administrative JWT accessToken issued by POST /api/v1/iam/login'
      }
    },
    schemas: {
      ...commonSchemas
    }
  },
  paths: {
    '/api/v1/backoffice': {
      get: {
        tags: ['Back-Office: Discovery'],
        summary: 'Back-Office Service Directory & Discovery',
        description: 'Returns available back-office service routes. Protected by backofficePerimeterGuard requiring administrative/support roles or internal service secret.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Back-office API directory metadata',
            content: {
              'application/json': {
                schema: envelopedData({
                  type: 'object',
                  properties: {
                    version: { type: 'string', example: 'v1' },
                    plane: { type: 'string', example: 'backoffice' },
                    services: {
                      type: 'object',
                      example: {
                        iam: '/api/v1/backoffice/iam',
                        orders: '/api/v1/backoffice/orders',
                        inventory: '/api/v1/backoffice/inventory',
                        transactions: '/api/v1/backoffice/transactions',
                        assets: '/api/v1/backoffice/assets',
                        audit: '/api/v1/backoffice/audit',
                        config: '/api/v1/backoffice/config',
                        organizations: '/api/v1/backoffice/organizations',
                        rbac: '/api/v1/backoffice/rbac',
                        scheduler: '/api/v1/backoffice/scheduler',
                        search: '/api/v1/backoffice/search',
                        notifications: '/api/v1/backoffice/notifications',
                        ai: '/api/v1/backoffice/ai'
                      }
                    }
                  }
                })
              }
            }
          },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // IAM Backoffice
    '/api/v1/backoffice/iam/users': {
      get: {
        tags: ['Back-Office: IAM & Users'],
        summary: 'List All Users (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: {
          '200': { description: 'Paginated user catalog retrieved' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: IAM & Users'],
        summary: 'Create User Account (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'role'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'manager@enterprise.local' },
                  password: { type: 'string', example: 'SecurePassword123!' },
                  role: { type: 'string', example: 'ADMIN' },
                  tenantId: { type: 'string', example: 'default' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'User account created successfully' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/iam/users/{id}': {
      get: {
        tags: ['Back-Office: IAM & Users'],
        summary: 'Get User By ID (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'User profile retrieved' },
          '401': auth401Response,
          '403': forbidden403Response,
          '404': standardErrorContent
        }
      },
      put: {
        tags: ['Back-Office: IAM & Users'],
        summary: 'Update User Profile (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string' },
                  isActive: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'User updated' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Back-Office: IAM & Users'],
        summary: 'Delete User Account (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'User deleted' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/iam/users/{id}/status': {
      patch: {
        tags: ['Back-Office: IAM & Users'],
        summary: 'Update User Lock/Active Status (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isActive'],
                properties: {
                  isActive: { type: 'boolean', example: false },
                  reason: { type: 'string', example: 'Temporary administrative security lock' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Status updated' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/iam/users/{id}/reset-password': {
      post: {
        tags: ['Back-Office: IAM & Users'],
        summary: 'Reset User Password (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newPassword'],
                properties: {
                  newPassword: { type: 'string', example: 'NewTemporaryPassword123!' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Password reset' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/iam/roles': {
      get: {
        tags: ['Back-Office: IAM & Users'],
        summary: 'List Available Roles (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Roles retrieved' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Orders Backoffice
    '/api/v1/backoffice/orders': {
      get: {
        tags: ['Back-Office: Orders'],
        summary: 'List All Orders (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Order list retrieved' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/orders/{id}': {
      get: {
        tags: ['Back-Office: Orders'],
        summary: 'Get Order by ID (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Order details' },
          '401': auth401Response,
          '403': forbidden403Response,
          '404': standardErrorContent
        }
      }
    },
    '/api/v1/backoffice/orders/{id}/status': {
      patch: {
        tags: ['Back-Office: Orders'],
        summary: 'Override Order Status (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', example: 'CANCELLED' },
                  reason: { type: 'string', example: 'Manual back-office administrative cancellation' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Status overridden' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Inventory Backoffice
    '/api/v1/backoffice/inventory/items': {
      get: {
        tags: ['Back-Office: Inventory'],
        summary: 'List All Inventory Items (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': { description: 'Inventory items retrieved' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: Inventory'],
        summary: 'Create / Ingest Inventory Item (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'quantity', 'price'],
                properties: {
                  productId: { type: 'string', example: 'prod-101' },
                  name: { type: 'string', example: 'Enterprise Cloud Server Rack' },
                  quantity: { type: 'integer', example: 50 },
                  price: { type: 'number', example: 2499.99 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Item created' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/inventory/items/{productId}': {
      get: {
        tags: ['Back-Office: Inventory'],
        summary: 'Get Stock Details (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Stock details' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      put: {
        tags: ['Back-Office: Inventory'],
        summary: 'Update Stock & Price (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  quantity: { type: 'integer', example: 75 },
                  price: { type: 'number', example: 2399.00 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Item updated' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Back-Office: Inventory'],
        summary: 'Delete Item from Inventory (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Item deleted' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Transactions Backoffice
    '/api/v1/backoffice/transactions': {
      get: {
        tags: ['Back-Office: Transactions'],
        summary: 'List All Ledger Transactions (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': { description: 'Transactions list' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: Transactions'],
        summary: 'Create Manual Transaction (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId', 'amount', 'currency'],
                properties: {
                  orderId: { type: 'string', example: 'ord-101' },
                  amount: { type: 'number', example: 150.00 },
                  currency: { type: 'string', example: 'USD' },
                  paymentMethod: { type: 'string', example: 'MANUAL_CREDIT' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Manual transaction created' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/transactions/{id}': {
      get: {
        tags: ['Back-Office: Transactions'],
        summary: 'Get Transaction by ID (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Transaction details' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Back-Office: Transactions'],
        summary: 'Delete Transaction (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Transaction deleted' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/transactions/{id}/status': {
      patch: {
        tags: ['Back-Office: Transactions'],
        summary: 'Override Transaction Status (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', example: 'REFUNDED' },
                  reason: { type: 'string', example: 'Customer dispute resolution' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Status updated' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Assets Backoffice
    '/api/v1/backoffice/assets': {
      get: {
        tags: ['Back-Office: Assets'],
        summary: 'List All Media Assets (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': { description: 'Assets retrieved' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: Assets'],
        summary: 'Upload / Register Asset (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['filename', 'mimetype', 'size'],
                properties: {
                  filename: { type: 'string', example: 'company-logo.png' },
                  mimetype: { type: 'string', example: 'image/png' },
                  size: { type: 'integer', example: 1048576 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Asset registered' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/assets/{id}': {
      get: {
        tags: ['Back-Office: Assets'],
        summary: 'Get Asset Metadata (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Asset metadata' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Back-Office: Assets'],
        summary: 'Delete Asset (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Asset deleted' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Audit Backoffice
    '/api/v1/backoffice/audit/logs': {
      get: {
        tags: ['Back-Office: Audit Logs'],
        summary: 'Query Audit Log Trail (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'userId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Audit log entries' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/audit/logs/{id}': {
      get: {
        tags: ['Back-Office: Audit Logs'],
        summary: 'Get Audit Event by ID (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Audit event' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Back-Office: Audit Logs'],
        summary: 'Remediation Delete Log (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Log removed for compliance' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Config Backoffice
    '/api/v1/backoffice/config': {
      get: {
        tags: ['Back-Office: System Configuration'],
        summary: 'List All Dynamic Configs (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'System configuration map' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/config/{key}': {
      get: {
        tags: ['Back-Office: System Configuration'],
        summary: 'Get Configuration Key (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Config key value' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      put: {
        tags: ['Back-Office: System Configuration'],
        summary: 'Upsert Configuration Key (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['value'],
                properties: {
                  value: { example: 'STRIPE' },
                  description: { type: 'string', example: 'Default payment gateway provider' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Configuration updated' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Back-Office: System Configuration'],
        summary: 'Delete Configuration Key (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Configuration key removed' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Organizations Backoffice
    '/api/v1/backoffice/organizations': {
      get: {
        tags: ['Back-Office: Organizations'],
        summary: 'List All Organizations (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Organizations list' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: Organizations'],
        summary: 'Create Organization (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'slug'],
                properties: {
                  name: { type: 'string', example: 'Acme Corporation' },
                  slug: { type: 'string', example: 'acme-corp' },
                  tier: { type: 'string', example: 'ENTERPRISE' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Organization created' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/organizations/{id}': {
      get: {
        tags: ['Back-Office: Organizations'],
        summary: 'Get Organization Details (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Organization details' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      put: {
        tags: ['Back-Office: Organizations'],
        summary: 'Update Organization (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  tier: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Organization updated' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Back-Office: Organizations'],
        summary: 'Delete Organization (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Organization deleted' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // RBAC Backoffice
    '/api/v1/backoffice/rbac/roles': {
      get: {
        tags: ['Back-Office: RBAC & Permissions'],
        summary: 'List RBAC Roles (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'RBAC roles list' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: RBAC & Permissions'],
        summary: 'Create Custom RBAC Role (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'permissions'],
                properties: {
                  name: { type: 'string', example: 'ComplianceAuditor' },
                  description: { type: 'string', example: 'Read-only access to audit trails' },
                  permissions: { type: 'array', items: { type: 'string' }, example: ['audit:read', 'reports:export'] }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Role created' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/rbac/permissions': {
      get: {
        tags: ['Back-Office: RBAC & Permissions'],
        summary: 'Catalog of All System Permissions (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Permissions catalog' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/rbac/users/{userId}/roles': {
      post: {
        tags: ['Back-Office: RBAC & Permissions'],
        summary: 'Assign Role to User (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['roleId'],
                properties: {
                  roleId: { type: 'string', example: 'role-compliance-auditor' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Role assigned' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Scheduler Backoffice
    '/api/v1/backoffice/scheduler/jobs': {
      get: {
        tags: ['Back-Office: Distributed Scheduler'],
        summary: 'List Distributed Scheduled Jobs (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Scheduled jobs list' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: Distributed Scheduler'],
        summary: 'Create Scheduled Job (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'cronExpression', 'targetService'],
                properties: {
                  name: { type: 'string', example: 'DailyInventoryReconciliation' },
                  cronExpression: { type: 'string', example: '0 2 * * *' },
                  targetService: { type: 'string', example: 'inventory-service' },
                  payload: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Job created' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/scheduler/jobs/{id}': {
      get: {
        tags: ['Back-Office: Distributed Scheduler'],
        summary: 'Get Scheduled Job by ID (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Job details' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      put: {
        tags: ['Back-Office: Distributed Scheduler'],
        summary: 'Update Scheduled Job (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  cronExpression: { type: 'string' },
                  isEnabled: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Job updated' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Back-Office: Distributed Scheduler'],
        summary: 'Delete Scheduled Job (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Job deleted' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/scheduler/jobs/{id}/trigger': {
      post: {
        tags: ['Back-Office: Distributed Scheduler'],
        summary: 'Trigger Job Execution Now (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Job triggered immediately' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Search Backoffice
    '/api/v1/backoffice/search/documents': {
      get: {
        tags: ['Back-Office: Search Catalog'],
        summary: 'List Indexed Documents (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Indexed search documents' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: Search Catalog'],
        summary: 'Index New Document (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'content', 'entityType'],
                properties: {
                  title: { type: 'string', example: 'Product Catalog 2026' },
                  content: { type: 'string', example: 'Comprehensive catalog of enterprise cloud server units' },
                  entityType: { type: 'string', example: 'PRODUCT' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Document indexed' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/search/documents/{id}': {
      get: {
        tags: ['Back-Office: Search Catalog'],
        summary: 'Get Document Details (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Document details' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      delete: {
        tags: ['Back-Office: Search Catalog'],
        summary: 'Delete Document from Search Index (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Document removed' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // Notifications Backoffice
    '/api/v1/backoffice/notifications': {
      get: {
        tags: ['Back-Office: Notifications'],
        summary: 'List Dispatched Alerts & Notifications (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': { description: 'Notifications log' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: Notifications'],
        summary: 'Dispatch System-Wide Announcement (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['channel', 'recipient', 'message'],
                properties: {
                  channel: { type: 'string', example: 'EMAIL' },
                  recipient: { type: 'string', example: 'all-admins@enterprise.local' },
                  message: { type: 'string', example: 'Scheduled maintenance window tonight at 02:00 UTC' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Notification dispatched' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/notifications/{id}': {
      get: {
        tags: ['Back-Office: Notifications'],
        summary: 'Get Notification Status (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Notification details' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },

    // AI & MCP Backoffice
    '/api/v1/backoffice/ai/providers': {
      get: {
        tags: ['Back-Office: AI & MCP Providers'],
        summary: 'List Registered MCP Tools & AI Providers (ADMIN / SUPPORT)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'MCP providers list' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      },
      post: {
        tags: ['Back-Office: AI & MCP Providers'],
        summary: 'Register New MCP Provider (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'transport', 'url'],
                properties: {
                  name: { type: 'string', example: 'custom-inventory-mcp' },
                  transport: { type: 'string', example: 'streamable_http' },
                  url: { type: 'string', example: 'http://localhost:8080/mcp' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'MCP provider registered' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    },
    '/api/v1/backoffice/ai/providers/{id}': {
      delete: {
        tags: ['Back-Office: AI & MCP Providers'],
        summary: 'Unregister MCP Provider (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'MCP provider removed' },
          '401': auth401Response,
          '403': forbidden403Response
        }
      }
    }
  }
};

