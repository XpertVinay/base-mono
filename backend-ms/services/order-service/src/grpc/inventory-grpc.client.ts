import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../shared/infrastructure/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class InventoryGrpcClient {
  private client: any;

  constructor(targetUrl: string = process.env.INVENTORY_GRPC_URL || 'localhost:50059') {
    const protoPath = path.resolve(__dirname, '../proto/inventory.proto');
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const descriptor = grpc.loadPackageDefinition(packageDef) as any;
    this.client = new descriptor.inventory.InventoryService(
      targetUrl,
      grpc.credentials.createInsecure()
    );
  }

  async checkStock(productId: string, quantity: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.CheckStock({ productId, quantity }, (err: any, response: any) => {
        if (err) {
          logger.warn('gRPC CheckStock call failed, allowing fallback', { err: err.message });
          return resolve(true);
        }
        const available = response.data?.available ?? response.available ?? response.status ?? true;
        resolve(Boolean(available));
      });
    });
  }

  async reserveStock(productId: string, quantity: number, orderId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.ReserveStock({ productId, quantity, orderId }, (err: any, response: any) => {
        if (err) {
          logger.warn('gRPC ReserveStock call failed, continuing with order', { err: err.message });
          return resolve(true);
        }
        const success = response.data ? true : (response.success ?? response.status ?? true);
        resolve(Boolean(success));
      });
    });
  }
}
