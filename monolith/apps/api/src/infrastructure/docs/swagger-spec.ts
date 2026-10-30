export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Monolith API - Notification & Platform Services',
    version: '1.0.0',
    description: `Enterprise Modular Monolith Platform RESTful APIs.

### Notification System Architecture
- **Adapter-Based Dispatching**: Pluggable adapters for **SendGrid (Email)**, **Twilio (SMS)**, **Meta Cloud (WhatsApp)**, **Firebase Cloud Messaging (FCM Push)**, and **Mock / DRY-Run**.
- **Configuration-Driven**: Providers and DRY-run execution can be toggled via environment variables or dynamic database configurations (\`IConfigModulePublicApi\`).
- **Developer DRY-Run Outbox**: High-performance in-memory simulation outbox to inspect delivered payloads without consuming external paid API quotas during local and test runs.
- **RESTful Endpoints**: Single and high-throughput batch dispatches, delivery filtering, status retrieval, config inspection, and webhook processing.
`,
    contact: {
      name: 'Platform Engineering Team',
      email: 'dev@monolith.local'
    }
  },
  servers: [
    {
      url: '/',
      description: 'Current API Server (Direct & Docker Proxy)'
    },
    {
      url: 'http://localhost:4001',
      description: 'Docker Monolith API Server'
    },
    {
      url: 'http://localhost:4000',
      description: 'Local Monolith API Server'
    }
  ],
  tags: [
    {
      name: 'IAM - Identity & Access Management',
      description: 'User registration, authentication, JWT token issuance, and authenticated identity profile'
    },
    {
      name: 'Configuration - Modular Sections',
      description: 'Module-specific configurations for Multi-Tenant, IAM (RS256 JWT), White-Label, Asset, Finance, Transaction, Inventory, Order, Property, Search, and Scheduler'
    },
    {
      name: 'Configuration - Core & Caching',
      description: 'Low-level runtime settings, client-facing configuration maps, in-memory cache metrics, and cache purge/invalidation'
    },
    {
      name: 'Notifications',
      description: 'Adapter-based multi-channel notification engine (Email, SMS, WhatsApp, Push, Batch, DRY-Run)'
    },
    {
      name: 'Notifications - Developer DRY-Run Outbox',
      description: 'Local testing & simulation outbox to inspect dispatched payloads without external third-party calls'
    },
    {
      name: 'Notifications - Webhooks',
      description: 'Provider delivery status callbacks and webhooks (SendGrid, Twilio, Meta Cloud)'
    }
  ],
  paths: {
    '/api/iam/register': {
      post: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Register a new user',
        description: 'Registers a new platform user with email, password, and profile name. Rate limited via authRateLimiter. In production, public registration strictly restricts to USER role; elevated role assignment requires ADMIN privileges.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterUserRequest' }
            }
          }
        },
        responses: {
          201: {
            description: 'User successfully registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/UserDto' },
                    meta: {
                      type: 'object',
                      properties: {
                        requestId: { type: 'string', example: 'req-c8d9e2b1' },
                        timestamp: { type: 'string', format: 'date-time', example: '2026-10-30T06:00:00.000Z' }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          409: { $ref: '#/components/responses/Conflict' },
          429: { $ref: '#/components/responses/TooManyRequests' }
        }
      }
    },
    '/api/iam/login': {
      post: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Authenticate user & issue hardened tokens',
        description: 'Authenticates user credentials, verifies active account status, and issues hardened AES-256-GCM encrypted access and refresh tokens bound to client device fingerprint, plus an OIDC-compliant signed idToken.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginUserRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'Authentication successful. Returns encrypted accessToken, encrypted refreshToken, signed idToken, and user profile.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AuthTokensResponse' },
                    meta: {
                      type: 'object',
                      properties: {
                        requestId: { type: 'string', example: 'req-c8d9e2b1' },
                        timestamp: { type: 'string', format: 'date-time', example: '2026-10-30T06:00:00.000Z' }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/TooManyRequests' }
        }
      }
    },
    '/api/iam/refresh': {
      post: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Refresh access tokens',
        description: 'Exchanges an encrypted refresh token for newly rotated access, refresh, and id tokens. Strictly verifies client device fingerprint to prevent session hijacking across different browsers or systems.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshTokenRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'Tokens successfully refreshed and rotated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AuthTokensResponse' },
                    meta: {
                      type: 'object',
                      properties: {
                        requestId: { type: 'string', example: 'req-c8d9e2b1' },
                        timestamp: { type: 'string', format: 'date-time', example: '2026-10-30T06:00:00.000Z' }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/TooManyRequests' }
        }
      }
    },
    '/api/iam/.well-known/jwks.json': {
      get: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'RFC 7517 JSON Web Key Set (JWKS) Discovery',
        description: 'Exposes public keys for offline, decentralized verification of Asymmetric RS256 JWT identity tokens by microservices, microfrontends, and multi-tenant portals.',
        security: [],
        responses: {
          200: {
            description: 'JWKS public key set returned successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    keys: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          kty: { type: 'string', example: 'RSA' },
                          use: { type: 'string', example: 'sig' },
                          alg: { type: 'string', example: 'RS256' },
                          kid: { type: 'string', example: 'monolith-iam-key-1' },
                          n: { type: 'string' },
                          e: { type: 'string', example: 'AQAB' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/iam/public-key': {
      get: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Get RSA Public Key in PEM format',
        description: 'Returns the RSA Public Key in standard SPKI PEM format for asymmetric JWT verification.',
        security: [],
        responses: {
          200: {
            description: 'PEM-encoded RSA Public Key returned successfully',
            content: {
              'text/plain': {
                schema: { type: 'string' }
              }
            }
          }
        }
      }
    },
    '/api/iam/me': {
      get: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Get current authenticated user profile',
        description: 'Retrieves profile information for the authenticated user identified by the Bearer JWT token in the Authorization header.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'User profile retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/UserDto' },
                    meta: {
                      type: 'object',
                      properties: {
                        requestId: { type: 'string', example: 'req-c8d9e2b1' },
                        timestamp: { type: 'string', format: 'date-time', example: '2026-10-30T06:00:00.000Z' }
                      }
                    }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/api/iam/mfa/setup': {
      post: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Initiate MFA setup with RFC 6238 TOTP',
        description: 'Generates a high-entropy TOTP base32 secret, QR code URI (otpauth://), and single-use backup recovery codes. Requires active user authentication.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'MFA setup initiated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/MfaSetupResponse' }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/iam/mfa/enable': {
      post: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Enable and activate MFA on account',
        description: 'Verifies the initial TOTP code generated by the authenticator app against the setup secret and enables MFA on the account.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MfaEnableRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'MFA successfully enabled with fresh 24h verification',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean', example: true },
                        tokens: { $ref: '#/components/schemas/AuthTokensResponse' },
                        backupCodes: { type: 'array', items: { type: 'string' } }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/iam/mfa/verify': {
      post: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Verify MFA challenge during login or SSO',
        description: 'Completes two-factor authentication by verifying a 6-digit TOTP code or backup code against an issued temporary challenge token. Upon success, issues full tokens with 24h MFA verification.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MfaVerifyRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'MFA verified successfully, full tokens issued with 24h validity',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AuthTokensResponse' }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/iam/mfa/reverify': {
      post: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Re-verify MFA to renew the 24-hour verification window',
        description: 'Re-authenticates user with fresh TOTP code or backup code, resetting the 24-hour expiration window clock and returning rotated tokens.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MfaReverifyRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'MFA re-verification successful, 24-hour expiration window renewed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AuthTokensResponse' }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/iam/mfa/status': {
      get: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Get current MFA enrollment and session status',
        description: 'Returns whether MFA is enabled, active methods, enrollment timestamp, last verification time, and reverification window.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'MFA status retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/MfaStatusResponse' }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/iam/sso/initiate': {
      post: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Initiate Single Sign-On (SSO)',
        description: 'Initiates enterprise Single Sign-On (Google, Azure AD, Okta, Mock SSO) with state and nonce parameters.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SsoInitiateRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'SSO flow initiated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/SsoInitiateResponse' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/iam/sso/callback': {
      post: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Handle SSO authorization callback',
        description: 'Validates identity assertion and provisions user. If user has MFA enabled, strict authentication challenges user with mfaRequired.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SsoCallbackRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'SSO login success or MFA challenge issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      oneOf: [
                        { $ref: '#/components/schemas/AuthTokensResponse' },
                        { $ref: '#/components/schemas/MfaChallengeResponse' }
                      ]
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/iam/audit-logs': {
      get: {
        tags: ['IAM - Identity & Access Management'],
        summary: 'Inspect IAM authentication and MFA audit logs',
        description: 'Returns historical audit trail of login, MFA verification, reverification, token rotation, and sensitive route access events. Requires ADMIN or AUDITOR role.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'string' } },
          { name: 'eventType', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['SUCCESS', 'FAILURE'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          200: {
            description: 'Audit logs retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/IamAuditLog' }
                    }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/config/sections': {
      get: {
        tags: ['Configuration - Modular Sections'],
        summary: 'Get All Configuration Sections Summary',
        description: 'Returns consolidated configuration across all business modules (Multi-tenancy, IAM with asymmetric RS256 JWT keys, White-label branding, Asset storage, Finance logging matrix, Transaction gateway adapters, Inventory availability, Orders, Property services, Search full-text index, and Scheduler jobs). Requires ADMIN authentication. Enforces tenant boundary isolation.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'tenantId',
            in: 'query',
            required: false,
            description: 'Optional RFC 4122 UUID for tenant-scoped configurations',
            schema: { type: 'string', format: 'uuid', example: '11111111-2222-3333-4444-555555555555' }
          },
          {
            name: 'x-tenant-id',
            in: 'header',
            required: false,
            description: 'Optional RFC 4122 UUID in request header',
            schema: { type: 'string', format: 'uuid', example: '11111111-2222-3333-4444-555555555555' }
          }
        ],
        responses: {
          200: {
            description: 'Consolidated modular sections configuration summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AllSectionsSummary' },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/config/sections/{section}': {
      get: {
        tags: ['Configuration - Modular Sections'],
        summary: 'Get Module Section Configuration',
        description: 'Retrieves strongly-typed configuration for a specific module section (tenant, iam, white-label, asset, finance, transaction, inventory, order, property, search, scheduler). All confidential secrets (such as RSA private keys or webhook secrets) are automatically sanitized and redacted. Requires ADMIN authentication. Tenant ID must be an RFC 4122 UUID.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'section',
            in: 'path',
            required: true,
            description: 'Module configuration section identifier',
            schema: {
              type: 'string',
              enum: [
                'tenant',
                'iam',
                'white-label',
                'asset',
                'finance',
                'transaction',
                'inventory',
                'order',
                'property',
                'search',
                'scheduler'
              ]
            }
          },
          {
            name: 'tenantId',
            in: 'query',
            required: false,
            description: 'Optional RFC 4122 UUID for tenant-specific configuration overrides',
            schema: { type: 'string', format: 'uuid', example: '11111111-2222-3333-4444-555555555555' }
          }
        ],
        responses: {
          200: {
            description: 'Strongly-typed section configuration',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object' },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      },

      put: {
        tags: ['Configuration - Modular Sections'],
        summary: 'Update Module Section Configuration',
        description: 'Updates one or more configuration properties for a module section. Updates are persisted to the database and invalidated across BE in-memory and FE caches. Requires ADMIN role.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'section',
            in: 'path',
            required: true,
            description: 'Module configuration section identifier',
            schema: {
              type: 'string',
              enum: [
                'tenant',
                'iam',
                'white-label',
                'asset',
                'finance',
                'transaction',
                'inventory',
                'order',
                'property',
                'search',
                'scheduler'
              ]
            }
          },
          {
            name: 'tenantId',
            in: 'query',
            required: false,
            description: 'Optional tenant ID for tenant-specific overrides',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', example: { primaryColor: '#4f46e5', brandName: 'Acme CareTaking' } }
            }
          }
        },
        responses: {
          200: {
            description: 'Updated section configuration',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object' },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/config/context/token': {
      post: {
        tags: ['Configuration - Modular Sections'],
        summary: 'Generate Encrypted PII Tenant Context Token',
        description: 'Generates a tamper-proof AES-256-GCM ciphertext containing tenant & user PII. This token can be transmitted on the fly (via x-tenant-context header) so that plaintext tenant IDs and PII are never exposed in transit or URL logs.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tenantId: { type: 'string', format: 'uuid', example: 'a0000000-0000-4000-8000-000000000001' },
                  orgId: { type: 'string', example: 'org-luxury-estates' },
                  ttlMs: { type: 'integer', example: 86400000 }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Encrypted context token generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        contextToken: { type: 'string', example: 'v1.iv.tag.ciphertext' },
                        tenantId: { type: 'string', format: 'uuid' },
                        expiresInSeconds: { type: 'integer', example: 86400 }
                      }
                    }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/config/client': {
      get: {
        tags: ['Configuration - Core & Caching'],
        summary: 'Get Client-Accessible Configuration (FE Caching)',
        description: 'Returns non-sensitive configurations marked with target FRONTEND or ALL. Sets HTTP Cache-Control (public, max-age=60, stale-while-revalidate=300) for high-performance frontend caching.',
        responses: {
          200: {
            description: 'Client configuration key-value map',
            headers: {
              'Cache-Control': {
                schema: { type: 'string', example: 'public, max-age=60, stale-while-revalidate=300' }
              }
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      example: {
                        ACTIVE_PAYMENT_GATEWAY: 'STRIPE',
                        FEATURE_NEW_CHECKOUT: 'true',
                        SYSTEM_MAINTENANCE_MODE: 'false',
                        DEFAULT_CURRENCY: 'USD',
                        APP_NAME: 'Real Estate CareTaking'
                      }
                    },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/config/cache/stats': {
      get: {
        tags: ['Configuration - Core & Caching'],
        summary: 'Get Backend In-Memory Cache Statistics',
        description: 'Returns real-time metrics from the in-memory ConfigCache: hit count, miss count, hit ratio, total cached entries, and pre-warm timestamp. Requires ADMIN role.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Cache metrics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean', example: true },
                        hits: { type: 'number', example: 142 },
                        misses: { type: 'number', example: 6 },
                        size: { type: 'number', example: 48 },
                        hitRatio: { type: 'number', example: 0.959 },
                        lastWarmedAt: { type: 'string', format: 'date-time' }
                      }
                    },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/config/cache/invalidate': {
      post: {
        tags: ['Configuration - Core & Caching'],
        summary: 'Invalidate In-Memory Configuration Cache',
        description: 'Purges a specific configuration key or all cached configurations in memory, forcing subsequent reads to fetch fresh values from the database. Requires ADMIN role.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  key: { type: 'string', description: 'Optional key to invalidate; if omitted, clears entire cache', example: 'ACTIVE_PAYMENT_GATEWAY' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Cache invalidated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: true },
                        invalidatedKey: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' }
                      }
                    },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/config': {
      get: {
        tags: ['Configuration - Core & Caching'],
        summary: 'List All Runtime Configurations',
        description: 'Lists all system configuration keys with encrypted values masked. Supports target scope filtering (BACKEND, FRONTEND, ALL).',
        parameters: [
          {
            name: 'target',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['BACKEND', 'FRONTEND', 'ALL'] }
          }
        ],
        responses: {
          200: {
            description: 'List of configurations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AppConfig' }
                    },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Configuration - Core & Caching'],
        summary: 'Set / Update Runtime Configuration',
        description: 'Persists a runtime configuration key-value pair to PostgreSQL and updates/invalidates the in-memory cache. Requires ADMIN role.',
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
          200: {
            description: 'Configuration saved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AppConfig' },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' }
        }
      }
    },
    '/api/config/{key}': {
      get: {
        tags: ['Configuration - Core & Caching'],
        summary: 'Get Configuration by Key',
        parameters: [
          {
            name: 'key',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' }
          }
        ],
        responses: {
          200: {
            description: 'Configuration details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AppConfig' },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/notifications': {

      post: {
        tags: ['Notifications'],
        summary: 'Send Multi-Channel Notification',
        description: 'Dispatches a notification via the configured provider adapter (SendGrid, Twilio, Meta WhatsApp, FCM Push, or Mock). Supports DRY-run simulation.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'X-Dry-Run',
            in: 'header',
            required: false,
            description: 'Override dry-run simulation mode (true/false)',
            schema: { type: 'boolean' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SendNotificationRequest' },
              examples: {
                sendgridEmail: {
                  summary: 'SendGrid Email Example',
                  value: {
                    recipient: 'john.doe@example.com',
                    channel: 'EMAIL',
                    subject: 'Welcome to Monolith Platform',
                    body: '<h1>Welcome!</h1><p>Your account is ready.</p>',
                    provider: 'SENDGRID',
                    dryRun: true
                  }
                },
                twilioSms: {
                  summary: 'Twilio SMS Example',
                  value: {
                    recipient: '+12345678901',
                    channel: 'SMS',
                    subject: 'Security Verification',
                    body: 'Your authentication passcode is 839210.',
                    provider: 'TWILIO',
                    dryRun: true
                  }
                },
                metaWhatsApp: {
                  summary: 'Meta Cloud WhatsApp Example',
                  value: {
                    recipient: '+12345678901',
                    channel: 'WHATSAPP',
                    subject: 'Order Shipped',
                    body: 'Your package #TRK-9871 has departed our fulfillment center.',
                    provider: 'META_CLOUD',
                    dryRun: true,
                    templateId: 'shipping_notification'
                  }
                },
                fcmPush: {
                  summary: 'FCM Push Notification Example',
                  value: {
                    recipient: 'dK8f...device_token_xyz',
                    channel: 'PUSH',
                    subject: 'New Document Uploaded',
                    body: 'Lease Agreement 2026.pdf is available for review.',
                    provider: 'FCM',
                    dryRun: true,
                    metadata: { documentId: 'doc-1234', priority: 'high' }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Notification dispatched successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotificationResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      },
      get: {
        tags: ['Notifications'],
        summary: 'List Notifications',
        description: 'Retrieves sent notifications, filterable by recipient, channel, and status with pagination limit.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'recipient',
            in: 'query',
            required: false,
            description: 'Filter by recipient email, phone, or token',
            schema: { type: 'string' }
          },
          {
            name: 'channel',
            in: 'query',
            required: false,
            description: 'Filter by channel',
            schema: {
              type: 'string',
              enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP']
            }
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            description: 'Filter by status',
            schema: {
              type: 'string',
              enum: ['PENDING', 'SENT', 'FAILED', 'DELIVERED']
            }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum items to retrieve (default 50)',
            schema: { type: 'integer', default: 50 }
          }
        ],
        responses: {
          '200': {
            description: 'List of notifications',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotificationListResponse' }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },

    '/api/notifications/batch': {
      post: {
        tags: ['Notifications'],
        summary: 'High-Performance Batch Dispatch',
        description: 'Dispatches up to 100 notifications concurrently with individual status reporting.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BatchNotificationRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Batch execution result summary',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BatchNotificationResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },

    '/api/notifications/{id}': {
      get: {
        tags: ['Notifications'],
        summary: 'Get Notification Details by ID',
        description: 'Fetches delivery details, provider message ID, and metadata for a specific notification.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'UUID of the notification',
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Notification found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotificationResponse' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },

    '/api/notifications/config': {
      get: {
        tags: ['Notifications'],
        summary: 'Get Active Notification Provider Configuration',
        description: 'Returns the current active provider routing for each channel, dry-run mode, and credential status (without exposing secrets).',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current notification routing and provider configuration',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotificationConfigResponse' }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },

    '/api/notifications/dry-run/outbox': {
      get: {
        tags: ['Notifications - Developer DRY-Run Outbox'],
        summary: 'Query DRY-Run Outbox',
        description: 'Inspects all simulated/mock notification dispatches in the in-memory outbox. Useful for local development and test verifications.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'recipient',
            in: 'query',
            required: false,
            schema: { type: 'string' }
          },
          {
            name: 'channel',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP']
            }
          }
        ],
        responses: {
          '200': {
            description: 'List of simulated outbox items',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DryRunOutboxResponse' }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      },
      delete: {
        tags: ['Notifications - Developer DRY-Run Outbox'],
        summary: 'Clear DRY-Run Outbox',
        description: 'Clears all simulated notifications from the in-memory developer outbox.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Outbox cleared',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        cleared: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Dry-run outbox cleared (5 items removed)' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },

    '/api/notifications/webhooks/{provider}': {
      post: {
        tags: ['Notifications - Webhooks'],
        summary: 'Provider Delivery Webhook Ingestion',
        description: 'Ingests delivery receipts, opens, clicks, or bounces from SendGrid, Twilio, or Meta WhatsApp Cloud.',
        parameters: [
          {
            name: 'provider',
            in: 'path',
            required: true,
            description: 'Provider name (sendgrid, twilio, meta_cloud)',
            schema: { type: 'string', example: 'sendgrid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true }
            }
          }
        },
        responses: {
          '200': {
            description: 'Webhook successfully ingested',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        handled: { type: 'boolean', example: true },
                        provider: { type: 'string', example: 'SENDGRID' },
                        message: { type: 'string', example: 'SendGrid webhook processed' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authorization token obtained from `/api/iam/login`'
      }
    },
    schemas: {
      UserRole: {
        type: 'string',
        enum: [
          'ADMIN',
          'USER',
          'AUDITOR',
          'OWNER',
          'CARETAKER',
          'TENANT',
          'BUYER',
          'VENDOR',
          'AGENT',
          'LEGAL'
        ],
        example: 'USER'
      },
      UserDto: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'd3b07384-d113-4c56-bf5b-4228dc2c5f11' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          name: { type: 'string', example: 'Jane Doe' },
          role: { $ref: '#/components/schemas/UserRole' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time', example: '2026-10-30T06:00:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-10-30T06:00:00.000Z' }
        }
      },
      RegisterUserRequest: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255, example: 'newuser@example.com' },
          password: { type: 'string', minLength: 8, maxLength: 128, example: 'StrongP@ssw0rd!' },
          name: { type: 'string', minLength: 2, maxLength: 100, example: 'Jane Doe' },
          role: {
            $ref: '#/components/schemas/UserRole',
            description: 'Optional user role. In production, public registration defaults to USER unless caller is ADMIN.'
          }
        }
      },
      LoginUserRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255, example: 'user@example.com' },
          password: { type: 'string', minLength: 1, maxLength: 128, example: 'StrongP@ssw0rd!' }
        }
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Hardened AES-256-GCM encrypted refresh token',
            example: 'ref.mNPzl8SU4Ie0kR8Y.-8d0WLUsbMPrEwy0nx3lph.obqGiI2BLxY...'
          }
        }
      },
      AuthTokensResponse: {
        type: 'object',
        properties: {
          accessToken: {
            type: 'string',
            description: 'Hardened AES-256-GCM encrypted token cryptographically bound to client device/browser session (anti-session hijacking)',
            example: 'enc.kYLel7SU3Id9jR7X.-6c9VKTraLPqDwx9mw2kog.naqFhH1AKwX-7tqMxFDH0qfQ0k1Niyaly6LW-tgEXTBPGYJAENbIZM_dcTqO2mbTwG1r7SN5zKJiP3MfskT63Lw'
          },
          refreshToken: {
            type: 'string',
            description: 'Hardened AES-256-GCM encrypted refresh token cryptographically bound to client device session for secure rotation',
            example: 'ref.mNPzl8SU4Ie0kR8Y.-8d0WLUsbMPrEwy0nx3lph.obqGiI2BLxY-8urNyGEI1rgR1l2Ojzbmz7MX-uhFYUCPHZKBFncJaN_edUrP3ncUxH2s8TO6zLKiQ4NgtlU74Mx'
          },
          idToken: {
            type: 'string',
            description: 'Signed OpenID Connect (OIDC) identity token carrying verifiable user profile claims (sub, email, name, role, iss, aud)',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          },
          user: { $ref: '#/components/schemas/UserDto' }
        }
      },
      MfaSetupResponse: {
        type: 'object',
        properties: {
          secret: { type: 'string', example: 'O7NP23ADIJF2R3SZB3NM55TJZDHZFYMN' },
          otpauthUrl: { type: 'string', example: 'otpauth://totp/Monolith:user@example.com?secret=...' },
          backupCodes: { type: 'array', items: { type: 'string' }, example: ['ABCD-1234', 'EFGH-5678'] }
        }
      },
      MfaEnableRequest: {
        type: 'object',
        required: ['code', 'secret'],
        properties: {
          code: { type: 'string', minLength: 6, maxLength: 6, example: '123456' },
          secret: { type: 'string', example: 'O7NP23ADIJF2R3SZB3NM55TJZDHZFYMN' },
          backupCodes: { type: 'array', items: { type: 'string' } }
        }
      },
      MfaVerifyRequest: {
        type: 'object',
        required: ['mfaChallengeToken', 'code'],
        properties: {
          mfaChallengeToken: { type: 'string' },
          code: { type: 'string', minLength: 6, maxLength: 9, example: '123456' }
        }
      },
      MfaReverifyRequest: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', minLength: 6, maxLength: 9, example: '123456' }
        }
      },
      MfaStatusResponse: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', example: true },
          enrolledAt: { type: 'string', format: 'date-time', nullable: true },
          lastVerifiedAt: { type: 'string', format: 'date-time', nullable: true },
          methods: { type: 'array', items: { type: 'string' } },
          reverificationWindowSeconds: { type: 'integer', example: 86400 }
        }
      },
      MfaChallengeResponse: {
        type: 'object',
        properties: {
          mfaRequired: { type: 'boolean', example: true },
          mfaChallengeToken: { type: 'string' },
          methods: { type: 'array', items: { type: 'string' } },
          userId: { type: 'string' },
          email: { type: 'string' },
          expiresInSeconds: { type: 'integer', example: 300 }
        }
      },
      SsoInitiateRequest: {
        type: 'object',
        required: ['provider'],
        properties: {
          provider: { type: 'string', enum: ['google', 'azure-ad', 'okta', 'mock-sso'] },
          redirectUri: { type: 'string', format: 'uri' }
        }
      },
      SsoInitiateResponse: {
        type: 'object',
        properties: {
          authorizationUrl: { type: 'string' },
          state: { type: 'string' },
          nonce: { type: 'string' },
          provider: { type: 'string' }
        }
      },
      SsoCallbackRequest: {
        type: 'object',
        required: ['provider', 'state'],
        properties: {
          provider: { type: 'string' },
          state: { type: 'string' },
          code: { type: 'string' },
          idToken: { type: 'string' }
        }
      },
      IamAuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string', nullable: true },
          eventType: { type: 'string' },
          ipAddress: { type: 'string', nullable: true },
          userAgent: { type: 'string', nullable: true },
          details: { type: 'object' },
          status: { type: 'string', enum: ['SUCCESS', 'FAILURE'] },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      SendNotificationRequest: {
        type: 'object',
        required: ['recipient', 'channel', 'subject', 'body'],
        properties: {
          recipient: {
            type: 'string',
            description: 'Target email address, E.164 phone number, or FCM device token',
            example: 'developer@example.com'
          },
          channel: {
            type: 'string',
            enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'],
            example: 'EMAIL'
          },
          subject: {
            type: 'string',
            description: 'Notification subject or push title',
            example: 'Welcome to Platform'
          },
          body: {
            type: 'string',
            description: 'Notification text or HTML content',
            example: 'Your account has been created.'
          },
          provider: {
            type: 'string',
            enum: ['SENDGRID', 'TWILIO', 'META_CLOUD', 'FCM', 'MOCK'],
            description: 'Explicit provider override. Defaults to channel configuration.',
            example: 'SENDGRID'
          },
          dryRun: {
            type: 'boolean',
            description: 'When true, simulates delivery and records to developer outbox',
            example: true
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            description: 'Custom key-value parameters or provider custom arguments'
          },
          templateId: {
            type: 'string',
            description: 'Dynamic template ID for SendGrid or template name for Meta WhatsApp'
          },
          templateData: {
            type: 'object',
            additionalProperties: true,
            description: 'Variables passed to dynamic template'
          }
        }
      },

      NotificationDto: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '8fbc2e7a-1234-4567-89ab-cdef01234567' },
          recipient: { type: 'string', example: 'developer@example.com' },
          channel: { type: 'string', enum: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'], example: 'EMAIL' },
          subject: { type: 'string', example: 'Welcome to Platform' },
          body: { type: 'string', example: 'Your account has been created.' },
          status: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED', 'DELIVERED'], example: 'SENT' },
          provider: { type: 'string', example: 'SENDGRID' },
          providerMessageId: { type: 'string', example: 'sg_msg_9a8b7c6d5e4f3a2b1c0d' },
          isDryRun: { type: 'boolean', example: true },
          metadata: { type: 'object', nullable: true },
          errorMessage: { type: 'string', nullable: true },
          sentAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },

      NotificationResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/NotificationDto' },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string', example: 'req-1234-5678' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      },

      NotificationListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/NotificationDto' }
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string', example: 'req-1234-5678' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      },

      BatchNotificationRequest: {
        type: 'object',
        required: ['notifications'],
        properties: {
          notifications: {
            type: 'array',
            items: { $ref: '#/components/schemas/SendNotificationRequest' },
            description: 'List of notifications to send (max 100)'
          },
          dryRun: {
            type: 'boolean',
            description: 'Batch-wide dry-run flag'
          }
        }
      },

      BatchNotificationResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              total: { type: 'integer', example: 3 },
              sentCount: { type: 'integer', example: 3 },
              failedCount: { type: 'integer', example: 0 },
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'integer', example: 0 },
                    recipient: { type: 'string', example: 'user1@example.com' },
                    channel: { type: 'string', example: 'EMAIL' },
                    success: { type: 'boolean', example: true },
                    notification: { $ref: '#/components/schemas/NotificationDto' },
                    error: { type: 'string', nullable: true }
                  }
                }
              }
            }
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string', example: 'req-1234-5678' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      },

      NotificationConfigResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              globalDryRun: { type: 'boolean', example: true },
              environment: { type: 'string', example: 'development' },
              channels: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    channel: { type: 'string' },
                    activeProvider: { type: 'string', example: 'SENDGRID' },
                    isConfigured: { type: 'boolean', example: true },
                    isDryRun: { type: 'boolean', example: true },
                    supportedProviders: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      DryRunOutboxResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                notificationId: { type: 'string', format: 'uuid' },
                recipient: { type: 'string' },
                channel: { type: 'string' },
                provider: { type: 'string' },
                subject: { type: 'string' },
                body: { type: 'string' },
                isDryRun: { type: 'boolean' },
                simulatedAt: { type: 'string', format: 'date-time' },
                headers: { type: 'object' },
                payload: { type: 'object' }
              }
            }
          }
        }
      },

      AppConfig: {
        type: 'object',
        properties: {
          key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
          value: { type: 'string', example: 'STRIPE' },
          description: { type: 'string', example: 'Active payment gateway adapter (STRIPE | PAYPAL | RAZORPAY | MOCK)' },
          isEncrypted: { type: 'boolean', example: false },
          target: { type: 'string', enum: ['BACKEND', 'FRONTEND', 'ALL'], example: 'ALL' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },

      SetConfigRequest: {
        type: 'object',
        required: ['key', 'value'],
        properties: {
          key: { type: 'string', example: 'ACTIVE_PAYMENT_GATEWAY' },
          value: { type: 'string', example: 'PAYPAL' },
          description: { type: 'string', example: 'Switch active payment adapter to PayPal' },
          isEncrypted: { type: 'boolean', default: false },
          target: { type: 'string', enum: ['BACKEND', 'FRONTEND', 'ALL'], default: 'ALL' }
        }
      },

      TenantConfig: {
        type: 'object',
        properties: {
          multiTenancyEnabled: { type: 'boolean', example: true },
          isolationMode: { type: 'string', enum: ['ROW_LEVEL', 'SCHEMA_LEVEL', 'DATABASE_LEVEL'], example: 'ROW_LEVEL' },
          defaultTenantId: { type: 'string', example: 'tenant-default' },
          headerKey: { type: 'string', example: 'x-tenant-id' },
          subdomainRoutingEnabled: { type: 'boolean', example: false },
          maxTenants: { type: 'number', example: 100 },
          enforceTenantIsolation: { type: 'boolean', example: true }
        }
      },

      IamConfig: {
        type: 'object',
        properties: {
          jwtAlgorithm: { type: 'string', enum: ['RS256', 'HS256'], example: 'RS256' },
          jwtPublicKey: { type: 'string', example: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----' },
          jwtPrivateKey: { type: 'string', example: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----' },
          jwtExpiresIn: { type: 'string', example: '1h' },
          jwtRefreshExpiresIn: { type: 'string', example: '7d' },
          bcryptSaltRounds: { type: 'number', example: 10 },
          mfaEnabled: { type: 'boolean', example: false },
          passwordMinLength: { type: 'number', example: 8 },
          passwordRequireSpecialChar: { type: 'boolean', example: true },
          maxLoginAttempts: { type: 'number', example: 5 },
          lockoutDurationMinutes: { type: 'number', example: 15 },
          sessionTimeoutMinutes: { type: 'number', example: 60 }
        }
      },

      WhiteLabelConfig: {
        type: 'object',
        properties: {
          brandName: { type: 'string', example: 'Real Estate CareTaking' },
          companyName: { type: 'string', example: 'CareTaking Global Platform Inc.' },
          portalTitle: { type: 'string', example: 'CareTaking Portal' },
          logoUrl: { type: 'string', example: 'https://assets.monolith.local/logo.svg' },
          faviconUrl: { type: 'string', example: 'https://assets.monolith.local/favicon.ico' },
          primaryColor: { type: 'string', example: '#6366f1' },
          secondaryColor: { type: 'string', example: '#0ea5e9' },
          accentColor: { type: 'string', example: '#10b981' },
          supportEmail: { type: 'string', example: 'support@caretaking.local' },
          customDomainEnabled: { type: 'boolean', example: true },
          emailFooterText: { type: 'string', example: '© 2026 CareTaking Platform. All rights reserved.' }
        }
      },

      AssetConfig: {
        type: 'object',
        properties: {
          storageProvider: { type: 'string', enum: ['LOCAL', 'S3', 'GCS', 'MINIO'], example: 'LOCAL' },
          bucketName: { type: 'string', example: 'monolith-assets-bucket' },
          region: { type: 'string', example: 'us-east-1' },
          cdnBaseUrl: { type: 'string', example: 'https://cdn.monolith.local/assets' },
          maxUploadSizeBytes: { type: 'number', example: 52428800 },
          allowedMimeTypes: { type: 'array', items: { type: 'string' } },
          presignedUrlTtlSeconds: { type: 'number', example: 3600 },
          virusScanningEnabled: { type: 'boolean', example: false }
        }
      },

      FinanceConfig: {
        type: 'object',
        properties: {
          defaultCurrency: { type: 'string', example: 'USD' },
          fiscalYearStartMonth: { type: 'number', example: 1 },
          taxRatePercentage: { type: 'number', example: 18 },
          auditLoggingEnabled: { type: 'boolean', example: true },
          invoiceDueDays: { type: 'number', example: 30 },
          reconciliationScheduleCron: { type: 'string', example: '0 0 * * *' },
          ledgerImmutabilityStrict: { type: 'boolean', example: true }
        }
      },

      TransactionConfig: {
        type: 'object',
        properties: {
          activePaymentGateway: { type: 'string', enum: ['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK'], example: 'STRIPE' },
          enabledGateways: { type: 'array', items: { type: 'string' } },
          stripePublicKey: { type: 'string', example: 'pk_test_sample' },
          stripeWebhookSecret: { type: 'string', example: 'whsec_sample' },
          paypalClientId: { type: 'string', example: 'paypal_client_sample' },
          razorpayKeyId: { type: 'string', example: 'rzp_test_sample' },
          transactionFeePercentage: { type: 'number', example: 2.5 },
          autoCapture: { type: 'boolean', example: true },
          maxRetryAttempts: { type: 'number', example: 3 }
        }
      },

      InventoryConfig: {
        type: 'object',
        properties: {
          stockTrackingEnabled: { type: 'boolean', example: true },
          lowStockThreshold: { type: 'number', example: 10 },
          autoReserveOnOrder: { type: 'boolean', example: true },
          reservationExpiryMinutes: { type: 'number', example: 15 },
          allowBackorders: { type: 'boolean', example: false },
          serviceAvailabilityBufferMinutes: { type: 'number', example: 30 }
        }
      },

      OrderConfig: {
        type: 'object',
        properties: {
          bookingConfirmationMode: { type: 'string', enum: ['MANUAL', 'AUTO'], example: 'AUTO' },
          cancellationWindowHours: { type: 'number', example: 24 },
          orderAutoExpiryMinutes: { type: 'number', example: 30 },
          defaultOrderStatusWorkflow: { type: 'array', items: { type: 'string' } },
          invoicePrefix: { type: 'string', example: 'INV-' },
          minimumOrderAmount: { type: 'number', example: 10 }
        }
      },

      PropertyConfig: {
        type: 'object',
        properties: {
          defaultInspectionIntervalDays: { type: 'number', example: 30 },
          caretakingServiceTypes: { type: 'array', items: { type: 'string' } },
          requireApprovalBeforeListing: { type: 'boolean', example: true },
          maxPhotosPerProperty: { type: 'number', example: 25 },
          enableVirtualTour: { type: 'boolean', example: true },
          emergencyContactRequired: { type: 'boolean', example: true }
        }
      },

      SearchConfig: {
        type: 'object',
        properties: {
          searchEngine: { type: 'string', enum: ['POSTGRES_FTS', 'ELASTICSEARCH', 'OPENSEARCH'], example: 'POSTGRES_FTS' },
          elasticIndexPrefix: { type: 'string', example: 'monolith_search' },
          searchableEntities: { type: 'array', items: { type: 'string' } },
          fuzzinessLevel: { type: 'string', enum: ['AUTO', '0', '1', '2'], example: 'AUTO' },
          highlightEnabled: { type: 'boolean', example: true },
          maxSearchResults: { type: 'number', example: 50 },
          minimumMatchScore: { type: 'number', example: 0.5 }
        }
      },

      SchedulerConfig: {
        type: 'object',
        properties: {
          cronEngineEnabled: { type: 'boolean', example: true },
          maxConcurrentJobs: { type: 'number', example: 10 },
          jobRetryLimit: { type: 'number', example: 3 },
          retryBackoffMultiplier: { type: 'number', example: 2 },
          deadLetterQueueRetentionDays: { type: 'number', example: 14 },
          pollIntervalMs: { type: 'number', example: 5000 }
        }
      },

      AllSectionsSummary: {
        type: 'object',
        properties: {
          tenant: { $ref: '#/components/schemas/TenantConfig' },
          iam: { $ref: '#/components/schemas/IamConfig' },
          'white-label': { $ref: '#/components/schemas/WhiteLabelConfig' },
          asset: { $ref: '#/components/schemas/AssetConfig' },
          finance: { $ref: '#/components/schemas/FinanceConfig' },
          transaction: { $ref: '#/components/schemas/TransactionConfig' },
          inventory: { $ref: '#/components/schemas/InventoryConfig' },
          order: { $ref: '#/components/schemas/OrderConfig' },
          property: { $ref: '#/components/schemas/PropertyConfig' },
          search: { $ref: '#/components/schemas/SearchConfig' },
          scheduler: { $ref: '#/components/schemas/SchedulerConfig' }
        }
      }
    },
    responses: {
      BadRequest: {
        description: 'Validation Error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'VALIDATION_ERROR' },
                    message: { type: 'string', example: 'Recipient is required' }
                  }
                }
              }
            }
          }
        }
      },
      Unauthorized: {
        description: 'Missing or Invalid Bearer Token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'UNAUTHORIZED' },
                    message: { type: 'string', example: 'Missing or malformed Authorization header' }
                  }
                }
              }
            }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden: Insufficient Permissions (ADMIN Required)',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'FORBIDDEN' },
                    message: { type: 'string', example: 'Access restricted to roles: ADMIN' }
                  }
                }
              }
            }
          }
        }
      },
      NotFound: {
        description: 'Resource Not Found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'NOT_FOUND' },
                    message: { type: 'string', example: 'Configuration resource not found' }
                  }
                }
              }
            }
          }
        }
      },
      Conflict: {
        description: 'Resource Conflict (e.g. Duplicate Email)',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'CONFLICT' },
                    message: { type: 'string', example: "User with email 'user@example.com' already exists" }
                  }
                }
              }
            }
          }
        }
      },
      TooManyRequests: {
        description: 'Rate Limit Exceeded',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
                    message: { type: 'string', example: 'Too many authentication attempts, please try again later.' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
