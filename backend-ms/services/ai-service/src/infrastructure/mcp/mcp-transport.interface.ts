import { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from './mcp-jsonrpc.types.js';

export interface IMcpTransport {
  connect(): Promise<void>;
  sendRequest<T = any>(request: JsonRpcRequest, timeoutMs?: number): Promise<JsonRpcResponse<T>>;
  sendNotification(notification: JsonRpcNotification): Promise<void>;
  isConnected(): boolean;
  close(): Promise<void>;
}

