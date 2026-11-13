import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { INotificationGatewayPort, SendNotificationPayload } from '../application/ports/internal-services.port.js';
import { NotificationDto } from '../shared/contracts/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class NotificationGrpcClient implements INotificationGatewayPort {
  private client: any;
  private readonly timeoutMs: number;

  constructor(
    targetUrl: string = process.env.NOTIFICATION_GRPC_URL || 'localhost:50054',
    timeoutMs: number = parseInt(process.env.MCP_REQUEST_TIMEOUT_MS || '10000', 10)
  ) {
    this.timeoutMs = timeoutMs;
    const protoPath = path.resolve(__dirname, '../proto/notification.proto');
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const descriptor = grpc.loadPackageDefinition(packageDef) as any;
    this.client = new descriptor.notification.NotificationService(
      targetUrl,
      grpc.credentials.createInsecure()
    );
  }

  async send(payload: SendNotificationPayload): Promise<NotificationDto> {
    const deadline = new Date(Date.now() + this.timeoutMs);
    return new Promise((resolve, reject) => {
      this.client.SendNotification(payload, { deadline }, (err: grpc.ServiceError | null, response: any) => {
        if (err) {
          return reject(new Error(`NotificationService.SendNotification gRPC failed: ${err.details || err.message}`));
        }
        if (!response?.status && response?.errors?.length) {
          return reject(new Error(response.errors[0]?.message || 'NotificationService rejected request'));
        }
        resolve(response.data as NotificationDto);
      });
    });
  }

  async list(limit: number = 50): Promise<NotificationDto[]> {
    const deadline = new Date(Date.now() + this.timeoutMs);
    return new Promise((resolve, reject) => {
      this.client.ListNotifications({ limit }, { deadline }, (err: grpc.ServiceError | null, response: any) => {
        if (err) {
          return reject(new Error(`NotificationService.ListNotifications gRPC failed: ${err.details || err.message}`));
        }
        resolve((response?.data?.items || []) as NotificationDto[]);
      });
    });
  }

  close(): void {
    try {
      this.client.close();
    } catch {
      // ignore
    }
  }
}

