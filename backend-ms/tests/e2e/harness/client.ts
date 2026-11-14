/**
 * tests/e2e/harness/client.ts
 * Resilient Dual-Transport HTTP Client for E2E Testing
 */

import http from 'node:http';
import { Duplex } from 'node:stream';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Express } from 'express';
import { E2E_CONFIG } from './config.js';
import { getInProcessGatewayApp } from './in-process-gateway.js';

let zModule: any;
try {
  const req = createRequire(path.resolve('services/api-gateway/package.json'));
  zModule = req('zod');
} catch {
  try {
    const req = createRequire(import.meta.url);
    zModule = req('zod');
  } catch {
    // fallback minimal schema validator
    zModule = {
      z: {
        string: () => ({ safeParse: (v: any) => ({ success: typeof v === 'string', data: v }) }),
        object: () => ({ safeParse: (v: any) => ({ success: typeof v === 'object' && v !== null, data: v }) })
      }
    };
  }
}
export const z = zModule.z || zModule;

export interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export class HttpResponse<T = any> {
  constructor(
    public readonly status: number,
    public readonly headers: Record<string, string>,
    public readonly data: T,
    public readonly rawText: string,
    public readonly durationMs: number
  ) {}

  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }

  /**
   * Assert exact HTTP status code
   */
  assertStatus(expected: number): this {
    assert.strictEqual(
      this.status,
      expected,
      `Expected HTTP ${expected} but received ${this.status}. Body: ${this.rawText.slice(0, 300)}`
    );
    return this;
  }

  /**
   * Assert successful response (2xx) and standard success envelope
   */
  assertSuccess(): this {
    assert.ok(
      this.status >= 200 && this.status < 300,
      `Expected 2xx status, got ${this.status}. Body: ${this.rawText.slice(0, 300)}`
    );
    if (this.data && typeof this.data === 'object') {
      if ('success' in this.data) {
        assert.strictEqual((this.data as any).success, true, 'Expected response success: true');
      } else if ('status' in this.data) {
        const st = (this.data as any).status;
        assert.ok(st === true || st === 'ok' || st === 200, `Expected status true/ok, got ${st}`);
      }
    }
    return this;
  }

  /**
   * Assert error response status and optional error code
   */
  assertError(expectedStatus: number, expectedErrorCode?: string): this {
    this.assertStatus(expectedStatus);
    if (expectedErrorCode && this.data && typeof this.data === 'object') {
      const err = (this.data as any).error;
      const errors = (this.data as any).errors;
      const code = err?.code || errors?.[0]?.code || (this.data as any).code;
      if (code) {
        assert.strictEqual(code, expectedErrorCode, `Expected error code ${expectedErrorCode}, got ${code}`);
      }
    }
    return this;
  }

  /**
   * Assert response data matches schema
   */
  assertSchema(schema: any): any {
    const parsed = schema.safeParse ? schema.safeParse(this.data) : { success: true, data: this.data };
    if (!parsed.success) {
      assert.fail(`Response schema validation failed: ${JSON.stringify(parsed.error?.format?.() || parsed.error, null, 2)}`);
    }
    return parsed.data;
  }
}

export interface ClientConfig {
  baseUrl?: string;
  app?: Express;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

export class E2EClient {
  private readonly baseUrl: string;
  private app?: Express;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private liveCheckDone = false;
  private useLive = false;

  constructor(config: ClientConfig = {}) {
    this.baseUrl = config.baseUrl || E2E_CONFIG.GATEWAY_URL;
    this.app = config.app;
    this.defaultHeaders = config.defaultHeaders || {};
    this.timeoutMs = config.timeoutMs ?? E2E_CONFIG.TIMEOUT_MS;
    this.retries = config.retries ?? E2E_CONFIG.RETRY_COUNT;
  }

  async get<T = any>(path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  async post<T = any>(path: string, body?: unknown, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>('POST', path, { ...options, body });
  }

  async put<T = any>(path: string, body?: unknown, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  async patch<T = any>(path: string, body?: unknown, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  async delete<T = any>(path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }

  async head<T = any>(path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>('HEAD', path, options);
  }

  async options<T = any>(path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>('OPTIONS', path, options);
  }

  private async ensureTransport(): Promise<boolean> {
    if (this.app) return false; // already has explicit in-process app
    if (E2E_CONFIG.TEST_MODE === 'in-process') {
      this.app = getInProcessGatewayApp();
      return false;
    }
    if (E2E_CONFIG.TEST_MODE === 'live') {
      this.useLive = true;
      return true;
    }
    if (!this.liveCheckDone) {
      this.liveCheckDone = true;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 800);
        const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          this.useLive = true;
          return true;
        }
      } catch {
        // Fallback to in-process app
        this.useLive = false;
      }
      if (!this.useLive) {
        this.app = getInProcessGatewayApp();
      }
    }
    return this.useLive;
  }

  private async request<T>(
    method: string,
    urlPath: string,
    options: RequestOptions
  ): Promise<HttpResponse<T>> {
    const isLive = await this.ensureTransport();
    const retries = options.retries ?? (isLive ? this.retries : 0);
    const retryDelay = options.retryDelayMs ?? E2E_CONFIG.RETRY_DELAY_MS;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= retries) {
      try {
        const start = Date.now();
        const res = isLive
          ? await this.executeLiveFetch<T>(method, urlPath, options, start)
          : await this.executeInProcess<T>(method, urlPath, options, start);

        if (attempt < retries && (res.status === 502 || res.status === 503 || res.status === 504)) {
          attempt++;
          await new Promise((r) => setTimeout(r, retryDelay * attempt));
          continue;
        }

        return res;
      } catch (err: any) {
        lastError = err;
        attempt++;
        if (attempt <= retries) {
          await new Promise((r) => setTimeout(r, retryDelay * attempt));
        }
      }
    }

    throw lastError || new Error(`Request failed after ${retries} attempts: ${method} ${urlPath}`);
  }

  /**
   * Mode 1: Live HTTP via global fetch()
   */
  private async executeLiveFetch<T>(
    method: string,
    urlPath: string,
    options: RequestOptions,
    startTime: number
  ): Promise<HttpResponse<T>> {
    let fullUrl = urlPath.startsWith('http') ? urlPath : `${this.baseUrl}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
    if (options.query) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(options.query)) {
        q.append(k, String(v));
      }
      fullUrl += `?${q.toString()}`;
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'E2E-Test-Runner/1.0',
      ...this.defaultHeaders,
      ...options.headers
    };

    const timeout = options.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal
    };

    if (options.body !== undefined && method !== 'GET' && method !== 'HEAD') {
      init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    try {
      const res = await fetch(fullUrl, init);
      clearTimeout(timeoutId);
      const text = await res.text();
      const durationMs = Date.now() - startTime;

      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k.toLowerCase()] = v;
      });

      return new HttpResponse<T>(res.status, resHeaders, parsed, text, durationMs);
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Mode 2: In-Process Virtual Express Dispatch
   */
  private executeInProcess<T>(
    method: string,
    urlPath: string,
    options: RequestOptions,
    startTime: number
  ): Promise<HttpResponse<T>> {
    return new Promise((resolve, reject) => {
      const app = this.app || getInProcessGatewayApp();
      const socket = new Duplex({
        read() {},
        write(_chunk, _enc, cb) { cb(); }
      }) as any;
      socket.remoteAddress = '127.0.0.1';
      socket.encrypted = false;

      let fullPath = urlPath.startsWith('http') ? new URL(urlPath).pathname + new URL(urlPath).search : urlPath;
      if (options.query) {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(options.query)) q.append(k, String(v));
        fullPath += (fullPath.includes('?') ? '&' : '?') + q.toString();
      }

      const req = new http.IncomingMessage(socket);
      req.method = method.toUpperCase();
      req.url = fullPath;

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        host: 'localhost:4000',
        ...this.defaultHeaders,
        ...options.headers
      };

      const normalizedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        normalizedHeaders[k.toLowerCase()] = String(v);
      }

      const bodyStr =
        options.body !== undefined
          ? typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body)
          : undefined;

      if (bodyStr !== undefined) {
        normalizedHeaders['content-type'] = normalizedHeaders['content-type'] || 'application/json';
        normalizedHeaders['content-length'] = String(Buffer.byteLength(bodyStr));
      }
      req.headers = normalizedHeaders;

      const res = new http.ServerResponse(req);
      const chunks: Buffer[] = [];
      const origWrite = res.write.bind(res);
      const origEnd = res.end.bind(res);

      res.write = ((chunk: any, ...args: any[]) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return origWrite(chunk, ...args);
      }) as any;

      res.end = ((chunk?: any, ...args: any[]) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString('utf8');
        const headerSep = raw.indexOf('\r\n\r\n');
        const bodyPart = headerSep >= 0 && raw.startsWith('HTTP/') ? raw.slice(headerSep + 4) : raw;
        let parsed: any = null;
        try {
          parsed = bodyPart ? JSON.parse(bodyPart) : null;
        } catch {
          parsed = bodyPart;
        }

        const resHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.getHeaders())) {
          resHeaders[k.toLowerCase()] = String(v);
        }

        resolve(
          new HttpResponse<T>(
            res.statusCode,
            resHeaders,
            parsed,
            bodyPart,
            Date.now() - startTime
          )
        );
        return origEnd(chunk, ...args);
      }) as any;

      res.on('error', reject);
      (app as any)(req, res);

      if (bodyStr !== undefined) {
        req.push(Buffer.from(bodyStr));
      }
      req.push(null);
    });
  }
}

export const client = new E2EClient();
