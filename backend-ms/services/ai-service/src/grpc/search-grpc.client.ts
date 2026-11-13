import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { ISearchGatewayPort } from '../application/ports/internal-services.port.js';
import { SearchResultItemDto } from '../shared/contracts/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SearchGrpcClient implements ISearchGatewayPort {
  private client: any;
  private readonly timeoutMs: number;

  constructor(
    targetUrl: string = process.env.SEARCH_GRPC_URL || 'localhost:50058',
    timeoutMs: number = parseInt(process.env.MCP_REQUEST_TIMEOUT_MS || '10000', 10)
  ) {
    this.timeoutMs = timeoutMs;
    const protoPath = path.resolve(__dirname, '../proto/search.proto');
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const descriptor = grpc.loadPackageDefinition(packageDef) as any;
    this.client = new descriptor.search.SearchService(
      targetUrl,
      grpc.credentials.createInsecure()
    );
  }

  async search(query: string, type?: string): Promise<SearchResultItemDto[]> {
    const deadline = new Date(Date.now() + this.timeoutMs);
    return new Promise((resolve, reject) => {
      this.client.Search({ query, type: type || '' }, { deadline }, (err: grpc.ServiceError | null, response: any) => {
        if (err) {
          return reject(new Error(`SearchService.Search gRPC failed: ${err.details || err.message}`));
        }
        const items = (response?.data?.items || []).map((item: any) => {
          let metadata: Record<string, any> | undefined;
          if (item.metadataJson) {
            try {
              metadata = JSON.parse(item.metadataJson);
            } catch {
              metadata = { raw: item.metadataJson };
            }
          }
          return {
            id: item.id,
            type: item.type,
            title: item.title,
            description: item.description || undefined,
            metadata
          } satisfies SearchResultItemDto;
        });
        resolve(items);
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

