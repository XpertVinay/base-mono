import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../domain/repositories/user-repository.interface.js';
import { ITenantRepository } from '../domain/repositories/tenant-repository.interface.js';
import { ISsoSessionRepository } from '../domain/repositories/sso-session-repository.interface.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startIamGrpcServer(
  userRepo: IUserRepository,
  port: number = 50051,
  tenantRepo?: ITenantRepository,
  app?: Express,
  ssoSessionRepo?: ISsoSessionRepository
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/iam.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const iamProto = protoDescriptor.iam;

  const server = new grpc.Server();

  server.addService(iamProto.IAMService.service, {
    VerifyToken: async (call: any, callback: any) => {
      const { token, expectedTenantId } = call.request;
      const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
      const defaultTenantId = process.env.DEFAULT_TENANT_ID || 'default';
      const requestId = `grpc-iam-${Date.now()}`;

      try {
        const complete = jwt.decode(token, { complete: true }) as any;
        const alg = complete?.header?.alg;

        let decoded: any;
        if (alg === 'RS256') {
          const pubKey = (process.env.JWT_PUBLIC_KEY || process.env.IAM_JWT_PUBLIC_KEY)?.replace(/\\n/g, '\n');
          if (!pubKey) {
            throw new Error('RS256 public key is not configured');
          }
          decoded = jwt.verify(token, pubKey, { algorithms: ['RS256'] });
        } else {
          decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
        }
        const userId = decoded.sub || decoded.id;
        const email = decoded.email || '';
        const role = decoded.role || 'USER';
        const tenantId = decoded.tenantId || decoded.tid || defaultTenantId;
        const tenantSlug = decoded.tenantSlug || '';
        const authMethod = decoded.authMethod || 'LOCAL';
        const provider = decoded.provider || '';

        if (decoded.sid && ssoSessionRepo) {
          const revoked = await ssoSessionRepo.isRevoked(String(decoded.sid));
          if (revoked) {
            return callback(null, {
              status: false,
              message: 'SSO session has been logged out or revoked',
              errors: [{ code: 'SESSION_REVOKED', message: 'SSO session revoked via SLO', field: 'token' }],
              meta_data: {
                request_id: requestId,
                timestamp: new Date().toISOString(),
                debug_data: { service: 'iam-service', rpc: 'VerifyToken' },
                further_steps: ['Re-authenticate to establish a new SSO session']
              },
              data: { valid: false, userId: '', email: '', role: '', tenantId: '', tenantSlug: '', authMethod: '', provider: '' },
              valid: false,
              userId: '',
              email: '',
              role: '',
              error: 'Session revoked',
              tenantId: '',
              tenantSlug: '',
              authMethod: ''
            });
          }
        }

        if (expectedTenantId && expectedTenantId !== tenantId) {
          return callback(null, {
            status: false,
            message: 'Token tenant mismatch',
            errors: [{ code: 'TENANT_MISMATCH', message: 'Token belongs to a different tenant', field: 'expectedTenantId' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'iam-service', rpc: 'VerifyToken' },
              further_steps: ['Authenticate within the target tenant']
            },
            data: { valid: false, userId: '', email: '', role: '', tenantId: '', tenantSlug: '', authMethod: '', provider: '' },
            valid: false,
            userId: '',
            email: '',
            role: '',
            error: 'Token tenant mismatch',
            tenantId: '',
            tenantSlug: '',
            authMethod: ''
          });
        }

        callback(null, {
          status: true,
          message: 'Token verified successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'iam-service', rpc: 'VerifyToken' },
            further_steps: ['Token is valid; proceed with authorized request']
          },
          data: { valid: true, userId, email, role, tenantId, tenantSlug, authMethod, provider },
          valid: true,
          userId,
          email,
          role,
          error: '',
          tenantId,
          tenantSlug,
          authMethod
        });
      } catch (err: any) {
        callback(null, {
          status: false,
          message: err.message || 'Token verification failed',
          errors: [{ code: 'INVALID_TOKEN', message: err.message, field: 'token' }],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'iam-service', rpc: 'VerifyToken' },
            further_steps: ['Obtain a new bearer token via POST /api/v1/iam/login or OIDC callback']
          },
          data: { valid: false, userId: '', email: '', role: '', tenantId: '', tenantSlug: '', authMethod: '', provider: '' },
          valid: false,
          userId: '',
          email: '',
          role: '',
          error: err.message,
          tenantId: '',
          tenantSlug: '',
          authMethod: ''
        });
      }
    },

    GetUserById: async (call: any, callback: any) => {
      const requestId = `grpc-iam-${Date.now()}`;
      try {
        const { userId, tenantId } = call.request;
        const user = await userRepo.findById(userId, tenantId || undefined);

        if (!user) {
          return callback(null, {
            status: false,
            message: 'User not found',
            errors: [{ code: 'NOT_FOUND', message: `User ${userId} does not exist`, field: 'userId' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'iam-service', rpc: 'GetUserById' },
              further_steps: ['Check user ID or register a new user']
            },
            data: null,
            id: '',
            email: '',
            name: '',
            role: '',
            isActive: false,
            createdAt: '',
            tenantId: '',
            authMethod: ''
          });
        }

        const userData = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          tenantId: user.tenantId,
          authMethod: user.authMethod
        };

        callback(null, {
          status: true,
          message: 'User retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'iam-service', rpc: 'GetUserById' },
            further_steps: []
          },
          data: userData,
          ...userData
        });
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message
        });
      }
    },

    ResolveTenant: async (call: any, callback: any) => {
      const requestId = `grpc-iam-${Date.now()}`;
      try {
        if (!tenantRepo) {
          return callback(null, {
            status: false,
            message: 'Tenant repository not configured',
            errors: [{ code: 'NOT_CONFIGURED', message: 'Tenant repository unavailable', field: 'idOrSlug' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'iam-service', rpc: 'ResolveTenant' },
              further_steps: []
            },
            data: null
          });
        }

        const idOrSlug = call.request.idOrSlug || process.env.DEFAULT_TENANT_ID || 'default';
        const tenant = await tenantRepo.findByIdOrSlug(idOrSlug);

        if (!tenant) {
          return callback(null, {
            status: false,
            message: 'Tenant not found',
            errors: [{ code: 'NOT_FOUND', message: `Tenant '${idOrSlug}' not found`, field: 'idOrSlug' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'iam-service', rpc: 'ResolveTenant' },
              further_steps: ['Check tenant ID/slug or create tenant via POST /api/v1/iam/tenants']
            },
            data: null
          });
        }

        callback(null, {
          status: true,
          message: 'Tenant resolved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'iam-service', rpc: 'ResolveTenant' },
            further_steps: []
          },
          data: {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name,
            isActive: tenant.isActive,
            config: tenant.config
          }
        });
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message
        });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'iam-service',
        version: 'v1',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime())
      });
    },

    Dispatch: async (call: any, callback: any) => {
      try {
        if (!app) {
          return callback({
            code: grpc.status.UNIMPLEMENTED,
            message: 'Express dispatch app not attached to IAM gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in iam-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind IAM gRPC server', err);
        return;
      }
      logger.info(`⚡ IAM gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}
