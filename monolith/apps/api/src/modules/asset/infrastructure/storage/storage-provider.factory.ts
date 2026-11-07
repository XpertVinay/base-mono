import { IStorageProvider } from '../../domain/services/storage-provider.interface.js';
import { LocalStorageProvider } from './local-storage.provider.js';
import { S3StorageProvider, S3StorageConfig } from './s3-storage.provider.js';
import { GcsStorageProvider, GcsStorageConfig } from './gcs-storage.provider.js';

export type StorageProviderType = 'LOCAL' | 'S3' | 'GCS';

export class InvalidStorageConfigurationError extends Error {
  constructor(message: string) {
    super(`Storage Configuration Error: ${message}`);
    this.name = 'InvalidStorageConfigurationError';
  }
}

export interface StorageFactoryOptions {
  provider?: StorageProviderType;
  s3?: S3StorageConfig;
  gcs?: GcsStorageConfig;
  localDir?: string;
}

export interface TenantStorageOverrides {
  bucket?: string;
  region?: string;
  cdnBaseUrl?: string;
  prefix?: string;
}

export class StorageProviderFactory {
  /**
   * Instantiates a storage provider based on explicit options or active environment variables.
   */
  public static create(options?: StorageFactoryOptions): IStorageProvider {
    const rawType = options?.provider || process.env.STORAGE_PROVIDER || 'LOCAL';
    const providerType = rawType.toUpperCase() as StorageProviderType;

    switch (providerType) {
      case 'S3': {
        const bucket = options?.s3?.bucket || process.env.AWS_S3_BUCKET;
        if (!bucket || bucket.trim().length === 0) {
          throw new InvalidStorageConfigurationError(
            'AWS S3 bucket is required when STORAGE_PROVIDER=S3 (set AWS_S3_BUCKET or provide s3.bucket in options)'
          );
        }

        const s3Config: S3StorageConfig = {
          bucket: bucket.trim(),
          region: options?.s3?.region || process.env.AWS_REGION || 'us-east-1',
          accessKeyId: options?.s3?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || 'test-access-key',
          secretAccessKey: options?.s3?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || 'test-secret-key',
          sessionToken: options?.s3?.sessionToken || process.env.AWS_SESSION_TOKEN,
          endpoint: options?.s3?.endpoint || process.env.AWS_ENDPOINT,
          cdnBaseUrl: options?.s3?.cdnBaseUrl || process.env.ASSET_CDN_BASE_URL,
          forcePathStyle: options?.s3?.forcePathStyle ?? (process.env.AWS_S3_FORCE_PATH_STYLE === 'true')
        };

        return new S3StorageProvider(s3Config);
      }

      case 'GCS': {
        const bucket = options?.gcs?.bucket || process.env.GCS_BUCKET_NAME;
        if (!bucket || bucket.trim().length === 0) {
          throw new InvalidStorageConfigurationError(
            'GCS bucket name is required when STORAGE_PROVIDER=GCS (set GCS_BUCKET_NAME or provide gcs.bucket in options)'
          );
        }

        const gcsConfig: GcsStorageConfig = {
          bucket: bucket.trim(),
          projectId: options?.gcs?.projectId || process.env.GCS_PROJECT_ID,
          clientEmail: options?.gcs?.clientEmail || process.env.GCS_CLIENT_EMAIL || 'test-service-account@test-project.iam.gserviceaccount.com',
          privateKey: options?.gcs?.privateKey || process.env.GCS_PRIVATE_KEY,
          cdnBaseUrl: options?.gcs?.cdnBaseUrl || process.env.ASSET_CDN_BASE_URL,
          apiEndpoint: options?.gcs?.apiEndpoint || process.env.GCS_API_ENDPOINT
        };

        return new GcsStorageProvider(gcsConfig);
      }

      case 'LOCAL':
      default: {
        const localDir = options?.localDir || process.env.LOCAL_STORAGE_DIR;
        return new LocalStorageProvider(localDir);
      }
    }
  }

  /**
   * Helper that instantiates a storage provider relying on current environment variables.
   */
  public static createFromEnv(): IStorageProvider {
    return StorageProviderFactory.create();
  }

  /**
   * Produces a storage provider configured with tenant-specific bucket or CDN overrides.
   */
  public static createForTenant(
    tenantId: string,
    overrides?: TenantStorageOverrides,
    baseOptions?: StorageFactoryOptions
  ): IStorageProvider {
    const rawType = baseOptions?.provider || process.env.STORAGE_PROVIDER || 'LOCAL';
    const providerType = rawType.toUpperCase() as StorageProviderType;

    if (providerType === 'S3') {
      const defaultBucket = process.env.AWS_S3_BUCKET || `tenant-${tenantId}-assets`;
      return StorageProviderFactory.create({
        ...baseOptions,
        provider: 'S3',
        s3: {
          ...baseOptions?.s3,
          bucket: overrides?.bucket || baseOptions?.s3?.bucket || defaultBucket,
          region: overrides?.region || baseOptions?.s3?.region,
          cdnBaseUrl: overrides?.cdnBaseUrl || baseOptions?.s3?.cdnBaseUrl
        }
      });
    }

    if (providerType === 'GCS') {
      const defaultBucket = process.env.GCS_BUCKET_NAME || `tenant-${tenantId}-assets`;
      return StorageProviderFactory.create({
        ...baseOptions,
        provider: 'GCS',
        gcs: {
          ...baseOptions?.gcs,
          bucket: overrides?.bucket || baseOptions?.gcs?.bucket || defaultBucket,
          cdnBaseUrl: overrides?.cdnBaseUrl || baseOptions?.gcs?.cdnBaseUrl
        }
      });
    }

    // Default to LOCAL
    return StorageProviderFactory.create(baseOptions);
  }
}

