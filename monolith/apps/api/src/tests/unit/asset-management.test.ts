import { describe, it, expect, beforeEach } from 'vitest';
import { PostgresAssetRepository } from '../../modules/asset/infrastructure/persistence/postgres-asset.repository.js';
import { LocalStorageProvider } from '../../modules/asset/infrastructure/storage/local-storage.provider.js';
import { IStorageProvider } from '../../modules/asset/domain/services/storage-provider.interface.js';
import { AssetValidationService } from '../../modules/asset/domain/services/asset-validation.service.js';
import { RequestPresignedUploadUseCase } from '../../modules/asset/application/commands/request-presigned-upload.use-case.js';
import { ConfirmAssetUploadUseCase } from '../../modules/asset/application/commands/confirm-asset-upload.use-case.js';
import { GetAssetDownloadUrlQuery } from '../../modules/asset/application/queries/get-asset-download-url.query.js';
import { ListTenantAssetsQuery } from '../../modules/asset/application/queries/list-tenant-assets.query.js';
import { DeleteAssetUseCase } from '../../modules/asset/application/commands/delete-asset.use-case.js';
import { CreateAssetUseCase } from '../../modules/asset/application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from '../../modules/asset/application/queries/list-assets.query.js';
import { AssetController } from '../../modules/asset/presentation/http/asset.controller.js';
import { BadRequestError, ForbiddenError } from '../../shared/presentation/error-handler.middleware.js';

describe('Sprint 05: Asset Management Foundation & Storage Provider Abstraction', () => {
  let repository: PostgresAssetRepository;
  let storageProvider: LocalStorageProvider;
  let requestPresignedUploadUseCase: RequestPresignedUploadUseCase;
  let confirmAssetUploadUseCase: ConfirmAssetUploadUseCase;
  let getAssetDownloadUrlQuery: GetAssetDownloadUrlQuery;
  let listTenantAssetsQuery: ListTenantAssetsQuery;
  let deleteAssetUseCase: DeleteAssetUseCase;
  let createAssetUseCase: CreateAssetUseCase;
  let listAssetsQuery: ListAssetsQuery;
  let controller: AssetController;

  const tenantA = 'org-tenant-alpha-100';
  const tenantB = 'org-tenant-beta-200';
  const ownerUser = 'user-owner-555';

  beforeEach(() => {
    repository = new PostgresAssetRepository();
    storageProvider = new LocalStorageProvider();

    requestPresignedUploadUseCase = new RequestPresignedUploadUseCase(repository, storageProvider);
    confirmAssetUploadUseCase = new ConfirmAssetUploadUseCase(repository, storageProvider);
    getAssetDownloadUrlQuery = new GetAssetDownloadUrlQuery(repository, storageProvider);
    listTenantAssetsQuery = new ListTenantAssetsQuery(repository);
    deleteAssetUseCase = new DeleteAssetUseCase(repository, storageProvider);
    createAssetUseCase = new CreateAssetUseCase(repository);
    listAssetsQuery = new ListAssetsQuery(repository);

    controller = new AssetController(
      requestPresignedUploadUseCase,
      confirmAssetUploadUseCase,
      getAssetDownloadUrlQuery,
      listTenantAssetsQuery,
      deleteAssetUseCase,
      createAssetUseCase,
      listAssetsQuery,
      storageProvider
    );
  });

  describe('1. MIME Type Validation & Anti-Malware Gate', () => {
    it('accepts whitelisted image, document, and data formats within limits', () => {
      const validCases = [
        { name: 'property-front.jpg', mime: 'image/jpeg', size: 5 * 1024 * 1024 },
        { name: 'kitchen-inspection.png', mime: 'image/png', size: 10 * 1024 * 1024 },
        { name: 'elevation.webp', mime: 'image/webp', size: 2 * 1024 * 1024 },
        { name: 'title-deed-original.pdf', mime: 'application/pdf', size: 20 * 1024 * 1024 },
        { name: 'units-onboarding-data.csv', mime: 'text/csv', size: 8 * 1024 * 1024 }
      ];

      for (const c of validCases) {
        const res = AssetValidationService.validateFile(c.name, c.mime, c.size);
        expect(res.valid).toBe(true);
      }
    });

    it('rejects prohibited executable and script MIME types', async () => {
      const prohibitedMimes = [
        'application/x-executable',
        'application/x-sh',
        'application/x-msdownload',
        'application/javascript',
        'text/javascript',
        'text/html'
      ];

      for (const mime of prohibitedMimes) {
        const res = await requestPresignedUploadUseCase.execute({
          name: 'payload.unknown',
          category: 'GENERAL',
          mimeType: mime,
          sizeBytes: 1024,
          tenantId: tenantA,
          ownerId: ownerUser
        });

        expect(res.isFailure).toBe(true);
        expect(res.getError()).toBeInstanceOf(BadRequestError);
        expect(res.getError().message).toMatch(/Unsupported or prohibited MIME type/);
      }
    });

    it('rejects dangerous executable and script file extensions', async () => {
      const dangerousNames = [
        'exploit.exe',
        'backdoor.sh',
        'autorun.bat',
        'script.js',
        'service.php',
        'driver.com'
      ];

      for (const name of dangerousNames) {
        const res = await requestPresignedUploadUseCase.execute({
          name,
          category: 'GENERAL',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          tenantId: tenantA,
          ownerId: ownerUser
        });

        expect(res.isFailure).toBe(true);
        expect(res.getError()).toBeInstanceOf(BadRequestError);
        expect(res.getError().message).toMatch(/strictly prohibited/);
      }
    });

    it('rejects file extension and MIME type mismatch', async () => {
      const res = await requestPresignedUploadUseCase.execute({
        name: 'deed.pdf',
        category: 'PROPERTY_IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(BadRequestError);
      expect(res.getError().message).toMatch(/does not match MIME type/);
    });
  });

  describe('2. File Size Invariant Limits', () => {
    it('rejects zero or negative size uploads', async () => {
      const res = await requestPresignedUploadUseCase.execute({
        name: 'photo.jpg',
        category: 'PROPERTY_IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 0,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(BadRequestError);
      expect(res.getError().message).toMatch(/greater than zero bytes/);
    });

    it('rejects image files exceeding 15MB limit', async () => {
      const res = await requestPresignedUploadUseCase.execute({
        name: 'massive-photo.jpg',
        category: 'PROPERTY_IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 16 * 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(BadRequestError);
      expect(res.getError().message).toMatch(/exceeds maximum permitted limit of 15MB/);
    });

    it('rejects document PDF files exceeding 25MB limit', async () => {
      const res = await requestPresignedUploadUseCase.execute({
        name: 'massive-contract.pdf',
        category: 'LEGAL_DOCUMENT',
        mimeType: 'application/pdf',
        sizeBytes: 26 * 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(BadRequestError);
      expect(res.getError().message).toMatch(/exceeds maximum permitted limit of 25MB/);
    });

    it('rejects CSV data onboarding files exceeding 10MB limit', async () => {
      const res = await requestPresignedUploadUseCase.execute({
        name: 'bulk-units.csv',
        category: 'GENERAL',
        mimeType: 'text/csv',
        sizeBytes: 11 * 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      expect(res.isFailure).toBe(true);
      expect(res.getError()).toBeInstanceOf(BadRequestError);
      expect(res.getError().message).toMatch(/exceeds maximum permitted limit of 10MB/);
    });
  });

  describe('3. Presigned Upload & Confirmation Lifecycle', () => {
    it('generates presigned upload URL and registers asset in PENDING_UPLOAD status', async () => {
      const presignResult = await requestPresignedUploadUseCase.execute({
        name: 'property-kitchen.jpg',
        category: 'PROPERTY_IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 2 * 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser,
        checksum: 'sha256-dummy-hash-1'
      });

      expect(presignResult.isSuccess).toBe(true);
      const data = presignResult.getValue();
      expect(data.assetId).toBeDefined();
      expect(data.uploadUrl).toContain('/api/assets/local-upload/');
      expect(data.storagePath).toContain(`tenants/${tenantA}/property_image/`);
      expect(data.expiresInSeconds).toBe(900);
      expect(data.requiredHeaders).toEqual({ 'Content-Type': 'image/jpeg' });

      // Verify asset persisted in PENDING_UPLOAD
      const stored = await repository.findById(data.assetId);
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('PENDING_UPLOAD');
      expect(stored!.tenantId).toBe(tenantA);
      expect(stored!.ownerId).toBe(ownerUser);
    });

    it('fails to confirm upload if physical file does not exist in storage provider', async () => {
      const presignResult = await requestPresignedUploadUseCase.execute({
        name: 'living-room.jpg',
        category: 'PROPERTY_IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      const { assetId } = presignResult.getValue();

      // Attempt to confirm without physical file write
      const confirmResult = await confirmAssetUploadUseCase.execute({
        assetId,
        tenantId: tenantA
      });

      expect(confirmResult.isFailure).toBe(true);
      expect(confirmResult.getError()).toBeInstanceOf(BadRequestError);
      expect(confirmResult.getError().message).toMatch(/Uploaded file does not exist in storage/);

      // Asset remains in PENDING_UPLOAD
      const asset = await repository.findById(assetId);
      expect(asset!.status).toBe('PENDING_UPLOAD');
    });

    it('successfully confirms upload and transitions asset to ACTIVE once file is physically written', async () => {
      const presignResult = await requestPresignedUploadUseCase.execute({
        name: 'bathroom.jpg',
        category: 'PROPERTY_IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      const { assetId, storagePath } = presignResult.getValue();

      // Simulate client upload to local storage
      const dummyFileContent = Buffer.from('jpeg-binary-image-data-payload');
      await storageProvider.saveFile(storagePath, dummyFileContent);

      // Confirm upload
      const confirmResult = await confirmAssetUploadUseCase.execute({
        assetId,
        tenantId: tenantA,
        checksum: 'sha256-verified-checksum'
      });

      expect(confirmResult.isSuccess).toBe(true);
      const activeAsset = confirmResult.getValue();
      expect(activeAsset.status).toBe('ACTIVE');
      expect(activeAsset.checksum).toBe('sha256-verified-checksum');
      expect(activeAsset.downloadUrl).toBeDefined();

      // Verify in repository
      const stored = await repository.findById(assetId);
      expect(stored!.status).toBe('ACTIVE');
    });
  });

  describe('4. Tenant Quarantine & Isolation Invariants', () => {
    let orgAAssetId: string;
    let orgAStoragePath: string;

    beforeEach(async () => {
      const presign = await requestPresignedUploadUseCase.execute({
        name: 'confidential-deed.pdf',
        category: 'LEGAL_DOCUMENT',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });
      orgAAssetId = presign.getValue().assetId;
      orgAStoragePath = presign.getValue().storagePath;

      await storageProvider.saveFile(orgAStoragePath, Buffer.from('confidential-deed-pdf-content'));
      await confirmAssetUploadUseCase.execute({
        assetId: orgAAssetId,
        tenantId: tenantA
      });
    });

    it('Tenant B cannot retrieve download URL for Tenant A asset (403 Forbidden)', async () => {
      const result = await getAssetDownloadUrlQuery.execute({
        assetId: orgAAssetId,
        tenantId: tenantB
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
      expect(result.getError().message).toMatch(/across tenant boundary is prohibited/);
    });

    it('Tenant B cannot confirm upload for Tenant A asset (403 Forbidden)', async () => {
      const result = await confirmAssetUploadUseCase.execute({
        assetId: orgAAssetId,
        tenantId: tenantB
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
      expect(result.getError().message).toMatch(/across tenant boundary is prohibited/);
    });

    it('Tenant B cannot delete Tenant A asset (403 Forbidden)', async () => {
      const result = await deleteAssetUseCase.execute({
        assetId: orgAAssetId,
        tenantId: tenantB
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
      expect(result.getError().message).toMatch(/across tenant boundary is prohibited/);

      // Asset remains ACTIVE and unharmed
      const asset = await repository.findById(orgAAssetId);
      expect(asset!.status).toBe('ACTIVE');
    });
  });

  describe('5. Lifecycle State Integrity & Listing Filtering', () => {
    it('unconfirmed PENDING_UPLOAD assets are quarantined from standard queries', async () => {
      // 1. Create a confirmed ACTIVE asset
      const presign1 = await requestPresignedUploadUseCase.execute({
        name: 'verified-asset.pdf',
        category: 'LEGAL_DOCUMENT',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });
      await storageProvider.saveFile(presign1.getValue().storagePath, Buffer.from('pdf'));
      await confirmAssetUploadUseCase.execute({
        assetId: presign1.getValue().assetId,
        tenantId: tenantA
      });

      // 2. Create an unconfirmed PENDING_UPLOAD asset
      const presign2 = await requestPresignedUploadUseCase.execute({
        name: 'abandoned-upload.jpg',
        category: 'PROPERTY_IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      // Standard listing should only return ACTIVE asset
      const listResult = await listTenantAssetsQuery.execute({ tenantId: tenantA });
      expect(listResult.isSuccess).toBe(true);
      const items = listResult.getValue().assets;

      const ids = items.map(i => i.id);
      expect(ids).toContain(presign1.getValue().assetId);
      expect(ids).not.toContain(presign2.getValue().assetId);
    });

    it('unconfirmed PENDING_UPLOAD asset download URL generation is rejected', async () => {
      const presign = await requestPresignedUploadUseCase.execute({
        name: 'pending-photo.jpg',
        category: 'PROPERTY_IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      const result = await getAssetDownloadUrlQuery.execute({
        assetId: presign.getValue().assetId,
        tenantId: tenantA
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(BadRequestError);
      expect(result.getError().message).toMatch(/not in ACTIVE state for download/);
    });
  });

  describe('6. Soft Delete & Storage Purge Lifecycle', () => {
    it('deletes asset metadata and purges physical file from storage provider', async () => {
      const presign = await requestPresignedUploadUseCase.execute({
        name: 'temporary-receipt.pdf',
        category: 'MAINTENANCE_RECEIPT',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });
      const { assetId, storagePath } = presign.getValue();

      await storageProvider.saveFile(storagePath, Buffer.from('invoice-content'));
      await confirmAssetUploadUseCase.execute({ assetId, tenantId: tenantA });

      expect(await storageProvider.fileExists(storagePath)).toBe(true);

      // Execute Delete
      const deleteResult = await deleteAssetUseCase.execute({
        assetId,
        tenantId: tenantA
      });
      expect(deleteResult.isSuccess).toBe(true);

      // Asset marked ARCHIVED
      const stored = await repository.findById(assetId);
      expect(stored!.status).toBe('ARCHIVED');

      // Storage file purged
      expect(await storageProvider.fileExists(storagePath)).toBe(false);

      // Excluded from standard tenant active listing
      const list = await listTenantAssetsQuery.execute({ tenantId: tenantA });
      expect(list.getValue().assets.map(a => a.id)).not.toContain(assetId);
    });
  });

  describe('7. Storage Provider Decoupling & Pluggable Port', () => {
    it('operates seamlessly with custom/mock IStorageProvider port implementation', async () => {
      const mockProvider: IStorageProvider = {
        generatePresignedUploadUrl: async (key) => ({
          uploadUrl: `https://s3.amazonaws.com/tenant-bucket/${key}?signature=abc`,
          storagePath: `s3://${key}`
        }),
        getDownloadUrl: async (path) => `https://cdn.platform.com/${path}`,
        deleteFile: async () => {},
        fileExists: async () => true
      };

      const customPresignUseCase = new RequestPresignedUploadUseCase(repository, mockProvider);
      const customConfirmUseCase = new ConfirmAssetUploadUseCase(repository, mockProvider);

      const presign = await customPresignUseCase.execute({
        name: 'pluggable-test.png',
        category: 'PROPERTY_IMAGE',
        mimeType: 'image/png',
        sizeBytes: 1024,
        tenantId: tenantA,
        ownerId: ownerUser
      });

      expect(presign.isSuccess).toBe(true);
      expect(presign.getValue().uploadUrl).toContain('https://s3.amazonaws.com/');

      const confirm = await customConfirmUseCase.execute({
        assetId: presign.getValue().assetId,
        tenantId: tenantA
      });

      expect(confirm.isSuccess).toBe(true);
      expect(confirm.getValue().downloadUrl).toContain('https://cdn.platform.com/');
    });
  });

  describe('8. Presentation Boundary & Controller Integration', () => {
    it('executes full upload, confirmation, retrieval, and delete flow via AssetController', async () => {
      // 1. Presign Upload Request
      const fakeReq1: any = {
        user: { id: ownerUser, role: 'OWNER' },
        headers: { 'x-tenant-id': tenantA },
        body: {
          name: 'controller-test.pdf',
          category: 'LEGAL_DOCUMENT',
          mimeType: 'application/pdf',
          sizeBytes: 1024 * 1024
        }
      };
      let presignData: any = null;
      const fakeRes1: any = {
        status: (code: number) => {
          expect(code).toBe(201);
          return {
            json: (payload: any) => { presignData = payload.data; }
          };
        }
      };
      await controller.presignUpload(fakeReq1, fakeRes1, (err) => { expect(err).toBeUndefined(); });
      expect(presignData).not.toBeNull();
      expect(presignData.assetId).toBeDefined();

      // 2. Simulate Local File Upload via handleLocalUpload
      const fakeUploadReq: any = {
        params: [presignData.storagePath],
        url: `/local-upload/${presignData.storagePath}`,
        body: Buffer.from('pdf-data')
      };
      const fakeUploadRes: any = {
        status: (code: number) => {
          expect(code).toBe(200);
          return { json: () => {} };
        }
      };
      await controller.handleLocalUpload(fakeUploadReq, fakeUploadRes, () => {});

      // 3. Confirm Upload
      const fakeConfirmReq: any = {
        user: { id: ownerUser, role: 'OWNER' },
        headers: { 'x-tenant-id': tenantA },
        params: { id: presignData.assetId },
        body: { checksum: 'abc-checksum' }
      };
      let confirmedData: any = null;
      const fakeConfirmRes: any = {
        status: (code: number) => {
          expect(code).toBe(200);
          return {
            json: (payload: any) => { confirmedData = payload.data; }
          };
        }
      };
      await controller.confirm(fakeConfirmReq, fakeConfirmRes, (err) => { expect(err).toBeUndefined(); });
      expect(confirmedData.status).toBe('ACTIVE');

      // 4. Retrieve by ID
      const fakeGetReq: any = {
        user: { id: ownerUser, role: 'OWNER' },
        headers: { 'x-tenant-id': tenantA },
        params: { id: presignData.assetId }
      };
      let retrievedData: any = null;
      const fakeGetRes: any = {
        status: (code: number) => {
          expect(code).toBe(200);
          return {
            json: (payload: any) => { retrievedData = payload.data; }
          };
        }
      };
      await controller.getById(fakeGetReq, fakeGetRes, (err) => { expect(err).toBeUndefined(); });
      expect(retrievedData.id).toBe(presignData.assetId);
      expect(retrievedData.downloadUrl).toBeDefined();

      // 5. List Tenant Assets
      const fakeListReq: any = {
        user: { id: ownerUser, role: 'OWNER' },
        headers: { 'x-tenant-id': tenantA },
        query: {}
      };
      let listedAssets: any = null;
      const fakeListRes: any = {
        status: (code: number) => {
          expect(code).toBe(200);
          return {
            json: (payload: any) => { listedAssets = payload.data; }
          };
        }
      };
      await controller.listTenantAssets(fakeListReq, fakeListRes, (err) => { expect(err).toBeUndefined(); });
      expect(listedAssets.some((a: any) => a.id === presignData.assetId)).toBe(true);

      // 6. Delete Asset
      const fakeDeleteReq: any = {
        user: { id: ownerUser, role: 'OWNER' },
        headers: { 'x-tenant-id': tenantA },
        params: { id: presignData.assetId }
      };
      let deletedResponse: any = null;
      const fakeDeleteRes: any = {
        status: (code: number) => {
          expect(code).toBe(200);
          return {
            json: (payload: any) => { deletedResponse = payload.data; }
          };
        }
      };
      await controller.delete(fakeDeleteReq, fakeDeleteRes, (err) => { expect(err).toBeUndefined(); });
      expect(deletedResponse.success).toBe(true);
    });

    it('rejects requests missing tenant identification with 400 Bad Request', async () => {
      const fakeReq: any = {
        user: { id: ownerUser, role: 'OWNER' },
        headers: {}, // No tenant ID header
        body: {
          name: 'no-tenant.jpg',
          category: 'PROPERTY_IMAGE',
          mimeType: 'image/jpeg',
          sizeBytes: 1024
        }
      };
      let errorThrown: any = null;
      await controller.presignUpload(fakeReq, {} as any, (err) => { errorThrown = err; });

      expect(errorThrown).toBeDefined();
      expect(errorThrown).toBeInstanceOf(BadRequestError);
      expect(errorThrown.message).toMatch(/Tenant ID is required/);
    });
  });
});
