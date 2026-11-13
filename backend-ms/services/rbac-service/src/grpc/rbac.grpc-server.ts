import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import { IRoleRepository } from '../domain/repositories/role-repository.interface.js';
import { IPermissionRepository } from '../domain/repositories/permission-repository.interface.js';
import { IUserRoleRepository } from '../domain/repositories/user-role-repository.interface.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RbacGrpcServerRepos {
  roleRepo: IRoleRepository;
  permRepo: IPermissionRepository;
  userRoleRepo: IUserRoleRepository;
}

export function startRbacGrpcServer(
  repos: RbacGrpcServerRepos,
  port: number = 50063,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/rbac.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const rbacProto = protoDescriptor.rbac;

  const server = new grpc.Server();

  server.addService(rbacProto.RbacService.service, {
    GetRole: async (call: any, callback: any) => {
      const requestId = `grpc-rbac-${Date.now()}`;
      try {
        const { id, tenantId } = call.request;
        const role = await repos.roleRepo.findById(tenantId || 'default', id);
        if (!role) {
          return callback(null, {
            status: false,
            message: `Role '${id}' not found`,
            errors: [{ code: 'NOT_FOUND', message: `Role '${id}' not found`, field: 'id' }],
            meta_data: { requestId, timestamp: new Date().toISOString() },
            data: null
          });
        }
        callback(null, {
          status: true,
          message: 'Role retrieved successfully',
          errors: [],
          meta_data: { requestId, timestamp: new Date().toISOString() },
          data: role.toJSON()
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ListRoles: async (call: any, callback: any) => {
      const requestId = `grpc-rbac-${Date.now()}`;
      try {
        const { tenantId, page, limit, search } = call.request;
        const p = page || 1;
        const l = limit || 20;
        const result = await repos.roleRepo.list(tenantId || 'default', {
          page: p,
          limit: l,
          search
        });
        const totalPages = Math.ceil(result.total / l) || 1;
        callback(null, {
          status: true,
          message: 'Roles retrieved successfully',
          errors: [],
          meta_data: {
            requestId,
            timestamp: new Date().toISOString(),
            pagination: {
              page: p,
              limit: l,
              total: result.total,
              totalPages,
              hasNext: p < totalPages,
              hasPrev: p > 1
            }
          },
          data: {
            items: result.items.map(r => r.toJSON()),
            total: result.total
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ListPermissions: async (call: any, callback: any) => {
      const requestId = `grpc-rbac-${Date.now()}`;
      try {
        const { category } = call.request;
        const items = await repos.permRepo.list(category);
        callback(null, {
          status: true,
          message: 'Permissions retrieved successfully',
          errors: [],
          meta_data: { requestId, timestamp: new Date().toISOString() },
          data: {
            items: items.map(p => p.toJSON()),
            total: items.length
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    GetUserRoles: async (call: any, callback: any) => {
      const requestId = `grpc-rbac-${Date.now()}`;
      try {
        const { tenantId, userId } = call.request;
        const assignments = await repos.userRoleRepo.getUserRoles(tenantId || 'default', userId);
        callback(null, {
          status: true,
          message: 'User roles retrieved successfully',
          errors: [],
          meta_data: { requestId, timestamp: new Date().toISOString() },
          data: {
            items: assignments.map(a => a.toJSON())
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    CheckPermission: async (call: any, callback: any) => {
      const requestId = `grpc-rbac-${Date.now()}`;
      try {
        const { tenantId, userId, permission } = call.request;
        const tid = tenantId || 'default';
        const assignments = await repos.userRoleRepo.getUserRoles(tid, userId);
        const userRoles = assignments.map(a => a.roleName || a.roleId);
        const permissions = await repos.userRoleRepo.getUserPermissions(tid, userId);

        const perm = (permission || '').trim().toLowerCase();
        const permSet = new Set(permissions.map(p => p.toLowerCase()));

        let allowed = false;
        if (permSet.has('*') || permSet.has(perm)) {
          allowed = true;
        } else {
          const [domain] = perm.split(':');
          if (domain && permSet.has(`${domain}:*`)) {
            allowed = true;
          }
        }

        callback(null, {
          status: true,
          message: allowed ? 'Permission granted' : 'Permission denied',
          errors: [],
          meta_data: { requestId, timestamp: new Date().toISOString() },
          data: {
            userId,
            tenantId: tid,
            permission,
            allowed,
            userRoles,
            permissions
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'rbac-service',
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
            message: 'Express dispatch app not attached to RBAC gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in rbac-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind RBAC gRPC server', err);
        return;
      }
      logger.info(`⚡ RBAC gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}
