import { NotificationDto, SearchResultItemDto } from '../../shared/contracts/index.js';

export interface SendNotificationPayload {
  recipient: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';
  subject: string;
  body: string;
}

export interface INotificationGatewayPort {
  send(payload: SendNotificationPayload): Promise<NotificationDto>;
  list(limit?: number): Promise<NotificationDto[]>;
}

export interface ISearchGatewayPort {
  search(query: string, type?: string): Promise<SearchResultItemDto[]>;
}

export interface InternalDbQueryResult {
  rows: Record<string, any>[];
  rowCount: number;
  fields: string[];
  executedSql: string;
}

export interface IInternalDatabasePort {
  listTables(tenantId: string, schema?: string): Promise<Array<{ schema: string; table: string; type: string }>>;
  describeTable(schema: string, table: string): Promise<Array<{ column: string; dataType: string; nullable: boolean }>>;
  executeReadOnlyQuery(tenantId: string, sql: string, params?: any[]): Promise<InternalDbQueryResult>;
}

export interface ExternalHttpRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: any;
  timeoutMs?: number;
  retries?: number;
}

export interface ExternalHttpResponse {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  data: any;
  durationMs: number;
}

export interface IExternalApiPort {
  request(req: ExternalHttpRequest): Promise<ExternalHttpResponse>;
}

