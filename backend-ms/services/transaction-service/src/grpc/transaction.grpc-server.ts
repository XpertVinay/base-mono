import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import {
  InitiatePaymentUseCase,
  CompletePaymentUseCase,
  GetTransactionByIdQuery
} from '../application/use-cases/transaction.use-cases.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startTransactionGrpcServer(
  useCases: {
    initiateUseCase: InitiatePaymentUseCase;
    completeUseCase: CompletePaymentUseCase;
    getByIdQuery: GetTransactionByIdQuery;
  },
  port: number = 50057,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/transaction.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const transactionProto = protoDescriptor.transaction;

  const server = new grpc.Server();

  server.addService(transactionProto.TransactionService.service, {
    InitiatePayment: async (call: any, callback: any) => {
      const requestId = `grpc-txn-${Date.now()}`;
      try {
        const { referenceId, userId, amount, currency, paymentMethod } = call.request;
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const result = await useCases.initiateUseCase.execute({
          referenceId,
          userId,
          amount: Number(amount),
          currency: currency || undefined,
          paymentMethod: paymentMethod || undefined,
          tenantId
        });

        const txn = result.getValue();
        callback(null, {
          status: true,
          message: 'Payment transaction initiated successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'transaction-service', rpc: 'InitiatePayment' },
            further_steps: []
          },
          data: {
            ...txn,
            failureReason: txn.failureReason || '',
            provider: txn.provider || '',
            providerSessionId: txn.providerSessionId || '',
            providerTransactionId: txn.providerTransactionId || '',
            redirectUrl: txn.redirectUrl || ''
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HandleWebhook: async (call: any, callback: any) => {
      const requestId = `grpc-txn-${Date.now()}`;
      try {
        const { transactionId, status, providerTxnId, failureReason } = call.request;
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || call.request?.tenantId || 'default';
        const result = await useCases.completeUseCase.execute({
          transactionId,
          providerTxnId: providerTxnId || undefined,
          success: status === 'SUCCESS',
          failureReason: failureReason || undefined,
          tenantId
        });

        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'WEBHOOK_FAILED', message: result.getError() }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'transaction-service', rpc: 'HandleWebhook' },
              further_steps: []
            },
            data: null
          });
        }

        const txn = result.getValue();
        callback(null, {
          status: true,
          message: 'Payment webhook processed successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'transaction-service', rpc: 'HandleWebhook' },
            further_steps: []
          },
          data: {
            ...txn,
            failureReason: txn.failureReason || '',
            provider: txn.provider || '',
            providerSessionId: txn.providerSessionId || '',
            providerTransactionId: txn.providerTransactionId || '',
            redirectUrl: txn.redirectUrl || ''
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    GetTransactionById: async (call: any, callback: any) => {
      const requestId = `grpc-txn-${Date.now()}`;
      try {
        const userId = call.metadata?.get('x-user-id')?.[0]?.toString() || '';
        const role = call.metadata?.get('x-user-role')?.[0]?.toString() || 'ADMIN';
        const tenantId = call.metadata?.get('x-tenant-id')?.[0]?.toString() || 'default';
        const result = await useCases.getByIdQuery.execute({ id: call.request.id, userId, role, tenantId });
        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'id' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'transaction-service', rpc: 'GetTransactionById' },
              further_steps: []
            },
            data: null
          });
        }

        const txn = result.getValue();
        callback(null, {
          status: true,
          message: 'Transaction retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'transaction-service', rpc: 'GetTransactionById' },
            further_steps: []
          },
          data: {
            ...txn,
            failureReason: txn.failureReason || '',
            provider: txn.provider || '',
            providerSessionId: txn.providerSessionId || '',
            providerTransactionId: txn.providerTransactionId || '',
            redirectUrl: txn.redirectUrl || ''
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'transaction-service',
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
            message: 'Express dispatch app not attached to Transaction gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in transaction-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Transaction gRPC server', err);
        return;
      }
      logger.info(`⚡ Transaction gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}

