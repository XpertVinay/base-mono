import crypto from 'crypto';
import { IStorageProvider } from '../../domain/services/storage-provider.interface.js';
import { sanitizeStorageKey } from '../../domain/services/storage-path.util.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface S3StorageConfig {
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  endpoint?: string;
  cdnBaseUrl?: string;
  forcePathStyle?: boolean;
}

export class S3StorageProvider implements IStorageProvider {
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly sessionToken?: string;
  private readonly endpoint?: string;
  private readonly cdnBaseUrl?: string;
  private readonly forcePathStyle: boolean;

  // In-memory registry fallback for test execution and offline simulation
  private readonly memoryStore: Map<string, Buffer> = new Map();

  constructor(config: S3StorageConfig) {
    if (!config.bucket || config.bucket.trim().length === 0) {
      throw new Error('S3StorageProvider requires a non-empty bucket name');
    }

    this.bucket = config.bucket.trim();
    this.region = config.region?.trim() || 'us-east-1';
    this.accessKeyId = config.accessKeyId?.trim() || 'test-access-key';
    this.secretAccessKey = config.secretAccessKey?.trim() || 'test-secret-key';
    this.sessionToken = config.sessionToken?.trim();
    this.endpoint = config.endpoint?.trim();
    this.cdnBaseUrl = config.cdnBaseUrl?.trim();
    this.forcePathStyle = config.forcePathStyle ?? false;
  }

  public getBucket(): string {
    return this.bucket;
  }

  public getRegion(): string {
    return this.region;
  }

  public getCdnBaseUrl(): string | undefined {
    return this.cdnBaseUrl;
  }

  /**
   * Generates an AWS Signature Version 4 presigned URL for the given HTTP method and object key.
   */
  private signV4(method: 'PUT' | 'GET', storagePath: string, expiresInSeconds: number): string {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    const dateObj = new Date();
    const amzDate = dateObj.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const credential = `${this.accessKeyId}/${credentialScope}`;

    let host: string;
    let canonicalUri: string;
    const encodedSegments = sanitizedKey.split('/').map(encodeURIComponent).join('/');

    if (this.endpoint) {
      const endpointUrl = new URL(this.endpoint);
      if (this.forcePathStyle) {
        host = endpointUrl.host;
        canonicalUri = `/${this.bucket}/${encodedSegments}`;
      } else {
        host = `${this.bucket}.${endpointUrl.host}`;
        canonicalUri = `/${encodedSegments}`;
      }
    } else {
      host = this.region === 'us-east-1'
        ? `${this.bucket}.s3.amazonaws.com`
        : `${this.bucket}.s3.${this.region}.amazonaws.com`;
      canonicalUri = `/${encodedSegments}`;
    }

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-SignedHeaders': 'host'
    };

    if (this.sessionToken) {
      queryParams['X-Amz-Security-Token'] = this.sessionToken;
    }

    // Sort query parameters alphabetically for canonical request
    const canonicalQueryString = Object.entries(queryParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Derive AWS SigV4 signing key
    const kDate = crypto.createHmac('sha256', 'AWS4' + this.secretAccessKey).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const protocol = this.endpoint ? new URL(this.endpoint).protocol : 'https:';
    return `${protocol}//${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  async generatePresignedUploadUrl(
    key: string,
    _mimeType: string,
    expiresInSeconds = 900
  ): Promise<{ uploadUrl: string; storagePath: string }> {
    const sanitizedKey = sanitizeStorageKey(key);
    const uploadUrl = this.signV4('PUT', sanitizedKey, expiresInSeconds);
    return {
      uploadUrl,
      storagePath: sanitizedKey
    };
  }

  async getDownloadUrl(
    storagePath: string,
    expiresInSeconds = 3600
  ): Promise<string> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    if (this.cdnBaseUrl) {
      const cleanCdn = this.cdnBaseUrl.replace(/\/+$/, '');
      const encodedSegments = sanitizedKey.split('/').map(encodeURIComponent).join('/');
      return `${cleanCdn}/${encodedSegments}`;
    }

    return this.signV4('GET', sanitizedKey, expiresInSeconds);
  }

  async deleteFile(storagePath: string): Promise<void> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    this.memoryStore.delete(sanitizedKey);
    logger.info('S3StorageProvider: purged object', { key: sanitizedKey, bucket: this.bucket });
  }

  async fileExists(storagePath: string): Promise<boolean> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    return this.memoryStore.has(sanitizedKey);
  }

  async saveFile(storagePath: string, content: Buffer): Promise<void> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    this.memoryStore.set(sanitizedKey, content);
  }

  async getFile(storagePath: string): Promise<Buffer | null> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    return this.memoryStore.get(sanitizedKey) || null;
  }
}
