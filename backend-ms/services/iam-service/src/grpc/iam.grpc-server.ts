import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../domain/repositories/user-repository.interface.js';
import { logger } from '../shared/infrastructure/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startIamGrpcServer(userRepo: IUserRepository, port: number = 50051): grpc.Server {
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
    VerifyToken: (call: any, callback: any) => {
      const { token } = call.request;
      const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
      const requestId = `grpc-iam-${Date.now()}`;

      try {
        const decoded = jwt.verify(token, secret) as any;
        const userId = decoded.sub || decoded.id;
        const email = decoded.email || '';
        const role = decoded.role || 'USER';

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
          data: { valid: true, userId, email, role },
          valid: true,
          userId,
          email,
          role,
          error: ''
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
            further_steps: ['Obtain a new bearer token via POST /api/v1/iam/login']
          },
          data: { valid: false, userId: '', email: '', role: '' },
          valid: false,
          userId: '',
          email: '',
          role: '',
          error: err.message
        });
      }
    },

    GetUserById: async (call: any, callback: any) => {
      const requestId = `grpc-iam-${Date.now()}`;
      try {
        const { userId } = call.request;
        const user = await userRepo.findById(userId);

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
            createdAt: ''
          });
        }

        const userData = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString()
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
