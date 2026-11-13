import http from 'node:http';
import { Duplex } from 'node:stream';
import type { Express } from 'express';

export interface GatewayDispatchRequestPayload {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: Buffer | Uint8Array | string;
  clientIp?: string;
  correlationId?: string;
}

export interface GatewayDispatchResponsePayload {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding'
]);

/**
 * Dispatches a gRPC GatewayDispatchRequest directly into the service's in-process
 * Express pipeline without opening an extra local TCP/HTTP socket.
 */
export function invokeExpressApp(
  app: Express,
  request: GatewayDispatchRequestPayload
): Promise<GatewayDispatchResponsePayload> {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({
      read() {},
      write(_chunk, _enc, cb) {
        cb();
      }
    }) as any;

    socket.remoteAddress = request.clientIp || '127.0.0.1';
    socket.encrypted = false;

    const req = new http.IncomingMessage(socket);
    req.method = (request.method || 'GET').toUpperCase();
    req.url = request.path || '/';

    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(request.headers || {})) {
      const lower = k.toLowerCase();
      if (lower === 'accept-encoding' || lower === 'transfer-encoding' || lower === 'content-length') {
        continue;
      }
      if (v !== undefined && v !== null) {
        normalizedHeaders[lower] = String(v);
      }
    }

    if (request.correlationId && !normalizedHeaders['x-correlation-id']) {
      normalizedHeaders['x-correlation-id'] = request.correlationId;
    }

    let bodyBuffer: Buffer;
    if (Buffer.isBuffer(request.body)) {
      bodyBuffer = request.body;
    } else if (request.body instanceof Uint8Array) {
      bodyBuffer = Buffer.from(request.body);
    } else if (typeof request.body === 'string' && request.body.length > 0) {
      bodyBuffer = Buffer.from(request.body, 'utf8');
    } else {
      bodyBuffer = Buffer.alloc(0);
    }

    if (bodyBuffer.length > 0) {
      normalizedHeaders['content-length'] = String(bodyBuffer.length);
      if (!normalizedHeaders['content-type']) {
        normalizedHeaders['content-type'] = 'application/json';
      }
    }

    req.headers = normalizedHeaders;

    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;

      const rawBody = Buffer.concat(chunks);
      const rawText = rawBody.toString('utf8');
      let finalBody = rawBody;
      const headerSep = rawText.indexOf('\r\n\r\n');
      if (headerSep >= 0 && rawText.startsWith('HTTP/')) {
        finalBody = rawBody.subarray(headerSep + 4);
      }

      const outHeaders: Record<string, string> = {};
      const rawHeaders = res.getHeaders();
      for (const [k, v] of Object.entries(rawHeaders)) {
        const lower = k.toLowerCase();
        if (HOP_BY_HOP_HEADERS.has(lower) || v === undefined) continue;
        outHeaders[lower] = Array.isArray(v) ? v.map(String).join(', ') : String(v);
      }

      resolve({
        statusCode: res.statusCode || 200,
        headers: outHeaders,
        body: finalBody
      });
    };

    res.write = ((chunk: any, ...args: any[]) => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return origWrite(chunk, ...args);
    }) as any;

    res.end = ((chunk?: any, ...args: any[]) => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      finish();
      return origEnd(chunk, ...args);
    }) as any;

    res.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    (app as any)(req, res);

    if (bodyBuffer.length > 0) {
      req.push(bodyBuffer);
    }
    req.push(null);
  });
}

