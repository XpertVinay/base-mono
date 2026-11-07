import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  StorageProviderFactory,
  InvalidStorageConfigurationError,
  S3StorageProvider,
  GcsStorageProvider,
  LocalStorageProvider,
  sanitizeStorageKey,
  validateTenantPathIsolation,
  buildTenantStoragePath,
  StoragePathValidationError
} from '../../modules/asset/index.js';
import { AssetModule } from '../../modules/asset/asset.module.js';

describe('Sprint 06: Cloud Storage Adapters & Dynamic Storage Provider Factory', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STORAGE_PROVIDER;
    delete process.env.AWS_S3_BUCKET;
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.GCS_CLIENT_EMAIL;
    delete process.env.ASSET_CDN_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Storage Provider Factory & Dynamic Configuration', () => {
    it('instantiates LocalStorageProvider by default when STORAGE_PROVIDER is unset', () => {
      const provider = StorageProviderFactory.createFromEnv();
      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });

    it('instantiates LocalStorageProvider when STORAGE_PROVIDER=LOCAL', () => {
      process.env.STORAGE_PROVIDER = 'LOCAL';
      const provider = StorageProviderFactory.createFromEnv();
      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });

    it('instantiates S3StorageProvider when options specify provider=S3 with bucket', () => {
      const provider = StorageProviderFactory.create({
        provider: 'S3',
        s3: {
          bucket: 'production-assets-bucket',
          region: 'us-west-2'
        }
      });
      expect(provider).toBeInstanceOf(S3StorageProvider);
      const s3 = provider as S3StorageProvider;
      expect(s3.getBucket()).toBe('production-assets-bucket');
      expect(s3.getRegion()).toBe('us-west-2');
    });

    it('throws InvalidStorageConfigurationError when S3 is requested without a bucket', () => {
      expect(() => {
        StorageProviderFactory.create({ provider: 'S3' });
      }).toThrow(InvalidStorageConfigurationError);
    });

    it('instantiates GcsStorageProvider when options specify provider=GCS with bucket', () => {
      const provider = StorageProviderFactory.create({
        provider: 'GCS',
        gcs: {
          bucket: 'gcp-production-media-bucket',
          projectId: 'realestate-cloud-prod'
        }
      });
      expect(provider).toBeInstanceOf(GcsStorageProvider);
      const gcs = provider as GcsStorageProvider;
      expect(gcs.getBucket()).toBe('gcp-production-media-bucket');
      expect(gcs.getProjectId()).toBe('realestate-cloud-prod');
    });

    it('throws InvalidStorageConfigurationError when GCS is requested without a bucket', () => {
      expect(() => {
        StorageProviderFactory.create({ provider: 'GCS' });
      }).toThrow(InvalidStorageConfigurationError);
    });

    it('applies tenant-specific bucket and CDN overrides via createForTenant', () => {
      process.env.STORAGE_PROVIDER = 'S3';
      process.env.AWS_S3_BUCKET = 'default-s3-bucket';

      const tenantProvider = StorageProviderFactory.createForTenant('org-enterprise-corp', {
        bucket: 'tenant-enterprise-isolated-vault',
        cdnBaseUrl: 'https://cdn.enterprise-corp.com'
      });

      expect(tenantProvider).toBeInstanceOf(S3StorageProvider);
      const s3 = tenantProvider as S3StorageProvider;
      expect(s3.getBucket()).toBe('tenant-enterprise-isolated-vault');
      expect(s3.getCdnBaseUrl()).toBe('https://cdn.enterprise-corp.com');
    });
  });

  describe('2. AWS S3 Storage Adapter (S3StorageProvider & SigV4)', () => {
    const s3Config = {
      bucket: 'test-realestate-assets',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    };

    it('generates presigned PUT upload URL conforming to AWS SigV4 specification', async () => {
      const provider = new S3StorageProvider(s3Config);
      const storageKey = 'tenants/tenant-alpha/property_image/kitchen-photo.jpg';

      const result = await provider.generatePresignedUploadUrl(storageKey, 'image/jpeg', 900);

      expect(result.storagePath).toBe(storageKey);
      expect(result.uploadUrl).toContain('https://test-realestate-assets.s3.amazonaws.com/');
      expect(result.uploadUrl).toContain(encodeURIComponent('kitchen-photo.jpg'));

      const url = new URL(result.uploadUrl);
      expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
      expect(url.searchParams.get('X-Amz-Credential')).toContain('AKIAIOSFODNN7EXAMPLE');
      expect(url.searchParams.get('X-Amz-Credential')).toContain('us-east-1/s3/aws4_request');
      expect(url.searchParams.get('X-Amz-Date')).toMatch(/^\d{8}T\d{6}Z$/);
      expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
      expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates presigned GET download URL with SigV4 signature and custom TTL', async () => {
      const provider = new S3StorageProvider({
        ...s3Config,
        region: 'eu-central-1'
      });
      const storageKey = 'tenants/tenant-alpha/legal_document/deed-scan.pdf';

      const downloadUrl = await provider.getDownloadUrl(storageKey, 1800);

      expect(downloadUrl).toContain('https://test-realestate-assets.s3.eu-central-1.amazonaws.com/');
      const url = new URL(downloadUrl);
      expect(url.searchParams.get('X-Amz-Expires')).toBe('1800');
      expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('routes asset download through configured CDN base URL instead of S3', async () => {
      const provider = new S3StorageProvider({
        ...s3Config,
        cdnBaseUrl: 'https://cdn.realestatecare.com'
      });
      const storageKey = 'tenants/tenant-alpha/property_image/living-room.jpg';

      const downloadUrl = await provider.getDownloadUrl(storageKey, 3600);

      expect(downloadUrl).toBe('https://cdn.realestatecare.com/tenants/tenant-alpha/property_image/living-room.jpg');
      expect(downloadUrl).not.toContain('X-Amz-Signature');
    });

    it('supports custom S3 endpoint and path-style addressing for local MinIO containers', async () => {
      const provider = new S3StorageProvider({
        ...s3Config,
        endpoint: 'http://localhost:9000',
        forcePathStyle: true
      });
      const storageKey = 'tenants/tenant-alpha/maintenance_receipt/invoice.pdf';

      const result = await provider.generatePresignedUploadUrl(storageKey, 'application/pdf', 600);

      expect(result.uploadUrl).toContain('http://localhost:9000/test-realestate-assets/tenants/tenant-alpha/maintenance_receipt/invoice.pdf');
      const url = new URL(result.uploadUrl);
      expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
      expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    });

    it('includes security token parameter when sessionToken is configured', async () => {
      const provider = new S3StorageProvider({
        ...s3Config,
        sessionToken: 'FwoGZXIvYXdzEBcaDEXAMPLE'
      });
      const storageKey = 'tenants/tenant-alpha/general/doc.pdf';

      const result = await provider.generatePresignedUploadUrl(storageKey, 'application/pdf', 900);

      const url = new URL(result.uploadUrl);
      expect(url.searchParams.get('X-Amz-Security-Token')).toBe('FwoGZXIvYXdzEBcaDEXAMPLE');
    });

    it('manages file lifecycle (save, exists, delete) via internal storage port', async () => {
      const provider = new S3StorageProvider(s3Config);
      const key = 'tenants/tenant-alpha/property_image/garden.jpg';
      const fileData = Buffer.from('fake-image-bytes');

      expect(await provider.fileExists(key)).toBe(false);

      await provider.saveFile(key, fileData);
      expect(await provider.fileExists(key)).toBe(true);

      const retrieved = await provider.getFile(key);
      expect(retrieved).toEqual(fileData);

      await provider.deleteFile(key);
      expect(await provider.fileExists(key)).toBe(false);
    });
  });

  describe('3. Google Cloud Storage Adapter (GcsStorageProvider & V4 Signing)', () => {
    const gcsConfig = {
      bucket: 'my-gcs-realestate-bucket',
      projectId: 'gcp-caretaking-prod',
      clientEmail: 'service-account@gcp-caretaking-prod.iam.gserviceaccount.com'
    };

    it('generates presigned PUT upload URL conforming to Google Cloud V4 signing', async () => {
      const provider = new GcsStorageProvider(gcsConfig);
      const storageKey = 'tenants/tenant-beta/property_image/bedroom.jpg';

      const result = await provider.generatePresignedUploadUrl(storageKey, 'image/jpeg', 900);

      expect(result.storagePath).toBe(storageKey);
      expect(result.uploadUrl).toContain('https://storage.googleapis.com/my-gcs-realestate-bucket/');
      expect(result.uploadUrl).toContain(encodeURIComponent('bedroom.jpg'));

      const url = new URL(result.uploadUrl);
      expect(url.searchParams.get('X-Goog-Algorithm')).toBe('GOOG4-RSA-SHA256');
      expect(url.searchParams.get('X-Goog-Credential')).toContain('service-account@gcp-caretaking-prod.iam.gserviceaccount.com');
      expect(url.searchParams.get('X-Goog-Date')).toMatch(/^\d{8}T\d{6}Z$/);
      expect(url.searchParams.get('X-Goog-Expires')).toBe('900');
      expect(url.searchParams.get('X-Goog-SignedHeaders')).toBe('host');
      expect(url.searchParams.get('X-Goog-Signature')).toBeTruthy();
    });

    it('generates presigned GET download URL for GCS object with custom TTL', async () => {
      const provider = new GcsStorageProvider(gcsConfig);
      const storageKey = 'tenants/tenant-beta/legal_document/tax-receipt.pdf';

      const downloadUrl = await provider.getDownloadUrl(storageKey, 7200);

      expect(downloadUrl).toContain('https://storage.googleapis.com/my-gcs-realestate-bucket/');
      const url = new URL(downloadUrl);
      expect(url.searchParams.get('X-Goog-Expires')).toBe('7200');
      expect(url.searchParams.get('X-Goog-Signature')).toBeTruthy();
    });

    it('routes GCS asset downloads through configured CDN base URL', async () => {
      const provider = new GcsStorageProvider({
        ...gcsConfig,
        cdnBaseUrl: 'https://media.realestatecare.com'
      });
      const storageKey = 'tenants/tenant-beta/inspection_photo/roof-crack.png';

      const downloadUrl = await provider.getDownloadUrl(storageKey, 3600);

      expect(downloadUrl).toBe('https://media.realestatecare.com/tenants/tenant-beta/inspection_photo/roof-crack.png');
      expect(downloadUrl).not.toContain('X-Goog-Signature');
    });

    it('manages file lifecycle (save, exists, delete) via GCS storage port', async () => {
      const provider = new GcsStorageProvider(gcsConfig);
      const key = 'tenants/tenant-beta/general/sample.pdf';
      const fileData = Buffer.from('fake-pdf-content');

      expect(await provider.fileExists(key)).toBe(false);

      await provider.saveFile(key, fileData);
      expect(await provider.fileExists(key)).toBe(true);

      const retrieved = await provider.getFile(key);
      expect(retrieved).toEqual(fileData);

      await provider.deleteFile(key);
      expect(await provider.fileExists(key)).toBe(false);
    });
  });

  describe('4. Anti-Directory Traversal & Tenant Path Isolation Invariants', () => {
    it('sanitizes and eliminates directory traversal sequences (../) from storage keys', () => {
      const maliciousKey = 'tenants/tenant-1/../../etc/passwd';
      const clean = sanitizeStorageKey(maliciousKey);

      expect(clean).toBe('tenants/tenant-1/etc/passwd');
      expect(clean).not.toContain('..');
    });

    it('strips redundant multiple slashes and leading/trailing slashes', () => {
      const messyKey = '///tenants///tenant-1///photos///image.jpg///';
      const clean = sanitizeStorageKey(messyKey);

      expect(clean).toBe('tenants/tenant-1/photos/image.jpg');
    });

    it('throws StoragePathValidationError if storage key resolves to an empty path', () => {
      expect(() => sanitizeStorageKey('///..///..///')).toThrow(StoragePathValidationError);
    });

    it('enforces tenant directory isolation via validateTenantPathIsolation', () => {
      const validKey = 'tenants/org-tenant-100/property_image/front.jpg';
      const validated = validateTenantPathIsolation(validKey, 'org-tenant-100');
      expect(validated).toBe(validKey);

      const crossTenantKey = 'tenants/org-tenant-200/property_image/front.jpg';
      expect(() => {
        validateTenantPathIsolation(crossTenantKey, 'org-tenant-100');
      }).toThrow(StoragePathValidationError);
    });

    it('safely constructs tenant-isolated storage path via buildTenantStoragePath', () => {
      const path = buildTenantStoragePath(
        'org-tenant-42',
        'PROPERTY_IMAGE',
        'uuid-1234',
        'my kitchen photo (1).jpg'
      );

      expect(path).toBe('tenants/org-tenant-42/property_image/uuid-1234-my_kitchen_photo__1_.jpg');
      expect(path).not.toContain('(');
      expect(path).not.toContain(' ');
    });
  });

  describe('5. AssetModule Integration with Pluggable Storage Providers', () => {
    it('initializes seamlessly with S3StorageProvider and resolves download URLs', async () => {
      const s3Provider = new S3StorageProvider({
        bucket: 'tenant-portfolio-bucket',
        region: 'us-west-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      });

      const { publicApi, storageProvider } = AssetModule.init(s3Provider);

      expect(storageProvider).toBe(s3Provider);
      expect(publicApi.getStorageProvider()).toBe(s3Provider);

      const testPath = 'tenants/org-42/property_image/building.png';
      const downloadUrl = await publicApi.getDownloadUrl(testPath, 1800);

      expect(downloadUrl).toContain('https://tenant-portfolio-bucket.s3.us-west-1.amazonaws.com/');
      expect(downloadUrl).toContain('X-Amz-Signature');
    });

    it('initializes seamlessly with GcsStorageProvider and resolves download URLs', async () => {
      const gcsProvider = new GcsStorageProvider({
        bucket: 'gcs-tenant-bucket',
        clientEmail: 'bot@gcs-tenant-bucket.iam.gserviceaccount.com'
      });

      const { publicApi, storageProvider } = AssetModule.init(gcsProvider);

      expect(storageProvider).toBe(gcsProvider);
      expect(publicApi.getStorageProvider()).toBe(gcsProvider);

      const testPath = 'tenants/org-99/property_image/pool.jpg';
      const downloadUrl = await publicApi.getDownloadUrl(testPath, 900);

      expect(downloadUrl).toContain('https://storage.googleapis.com/gcs-tenant-bucket/');
      expect(downloadUrl).toContain('X-Goog-Signature');
    });
  });
});
