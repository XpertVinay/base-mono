export const commonSchemas = {
  MetaData: {
    type: 'object',
    required: ['requestId', 'timestamp'],
    properties: {
      requestId: {
        type: 'string',
        example: 'req-c7f8a9e1-3b4d-4e9a-9d2a-8f7a6b5c4d3e',
        description: 'Unique correlation or request identifier'
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        example: '2026-10-16T10:30:00.000Z',
        description: 'ISO-8601 UTC timestamp of response generation'
      },
      debug: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        description: 'Debugging diagnostics for local & development environments (omitted in production)',
        properties: {
          service: { type: 'string', example: 'iam-service' },
          env: { type: 'string', example: 'development' },
          durationMs: { type: 'number', example: 14 },
          stack: { type: 'string', description: 'Internal stack trace (omitted in production)' }
        }
      },
      pagination: {
        type: 'object',
        nullable: true,
        description: 'Pagination details when querying collection resources',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 120 },
          totalPages: { type: 'integer', example: 6 },
          hasNext: { type: 'boolean', example: true },
          hasPrev: { type: 'boolean', example: false }
        }
      },
      further_steps: {
        type: 'array',
        nullable: true,
        description: 'Actionable guidance and links for downstream execution',
        items: { type: 'string' },
        example: ['Authenticate with POST /api/v1/iam/login', 'Check status in 30 seconds']
      }
    }
  },

  ErrorDetail: {
    type: 'object',
    additionalProperties: true,
    properties: {
      code: { type: 'string', example: 'VALIDATION_ERROR' },
      message: { type: 'string', example: 'Password must contain at least 8 characters' },
      field: { type: 'string', example: 'password' }
    }
  },

  StandardResponse: {
    type: 'object',
    required: ['status', 'message', 'errors', 'meta_data'],
    properties: {
      status: {
        type: 'boolean',
        description: 'true for successful execution, false for failed operations',
        example: true
      },
      message: {
        type: 'string',
        description: 'Human-readable summary of the outcome',
        example: 'Operation completed successfully'
      },
      data: {
        nullable: true,
        description: 'Response payload data (object, array, primitive, or null)'
      },
      errors: {
        type: 'array',
        description: 'List of validation or operational errors; empty array on success',
        items: {
          $ref: '#/components/schemas/ErrorDetail'
        },
        example: []
      },
      meta_data: {
        $ref: '#/components/schemas/MetaData'
      }
    }
  },

  StandardErrorResponse: {
    type: 'object',
    required: ['status', 'message', 'errors', 'meta_data'],
    properties: {
      status: {
        type: 'boolean',
        example: false
      },
      message: {
        type: 'string',
        example: 'Invalid request input or resource not found'
      },
      data: {
        nullable: true,
        description: 'Always null on error responses',
        example: null
      },
      errors: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ErrorDetail'
        },
        example: [
          {
            code: 'VALIDATION_ERROR',
            message: 'Email must be a valid email address',
            field: 'email'
          }
        ]
      },
      meta_data: {
        $ref: '#/components/schemas/MetaData'
      }
    }
  },

  MiddlewareErrorResponse: {
    type: 'object',
    required: ['success', 'error'],
    description: 'Error payload returned directly by authentication or rate-limiting middleware',
    properties: {
      success: {
        type: 'boolean',
        example: false
      },
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: {
            type: 'string',
            enum: ['UNAUTHORIZED', 'INVALID_TOKEN', 'FORBIDDEN', 'RATE_LIMIT_EXCEEDED'],
            example: 'UNAUTHORIZED'
          },
          message: {
            type: 'string',
            example: 'Missing or malformed Authorization header'
          }
        }
      }
    }
  }
};
