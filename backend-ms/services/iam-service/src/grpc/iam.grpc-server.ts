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
      try {
        const decoded = jwt.verify(token, secret) as any;
        callback(null, {
          valid: true,
          userId: decoded.sub || decoded.id,
          email: decoded.email,
          role: decoded.role || 'USER',
          error: ''
        });
      } catch (err: any) {
        callback(null, {
          valid: false,
          userId: '',
          email: '',
          role: '',
          error: err.message
        });
      }
    },

    GetUserById: async (call: any, callback: any) => {
      try {
        const { userId } = call.request;
        const user = await userRepo.findById(userId);
        if (!user) {
          return callback({
            code: grpc.status.NOT_FOUND,
            message: 'User not found'
          });
        }
        callback(null, {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString()
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
