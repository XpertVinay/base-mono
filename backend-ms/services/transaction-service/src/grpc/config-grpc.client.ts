import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../shared/infrastructure/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigGrpcClient {
  private client: any;

  constructor(targetUrl: string = process.env.CONFIG_GRPC_URL || 'localhost:50053') {
    const protoPath = path.resolve(__dirname, '../proto/config.proto');
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const descriptor = grpc.loadPackageDefinition(packageDef) as any;
    this.client = new descriptor.config.ConfigService(
      targetUrl,
      grpc.credentials.createInsecure()
    );
  }

  async getActiveGateway(): Promise<string> {
    return new Promise((resolve) => {
      this.client.GetActivePaymentGateway({}, (err: any, response: any) => {
        if (err || !response || !response.provider) {
          logger.warn('gRPC GetActivePaymentGateway failed, fallback to env/STRIPE', { err: err?.message });
          return resolve(process.env.DEFAULT_PAYMENT_GATEWAY || 'STRIPE');
        }
        resolve(response.provider);
      });
    });
  }
}
