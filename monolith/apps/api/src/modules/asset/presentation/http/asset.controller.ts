import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateAssetUseCase } from '../../application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from '../../application/queries/list-assets.query.js';
import { RequestPresignedUploadUseCase } from '../../application/commands/request-presigned-upload.use-case.js';
import { ConfirmAssetUploadUseCase } from '../../application/commands/confirm-asset-upload.use-case.js';
import { GetAssetDownloadUrlQuery } from '../../application/queries/get-asset-download-url.query.js';
import { ListTenantAssetsQuery } from '../../application/queries/list-tenant-assets.query.js';
import { DeleteAssetUseCase } from '../../application/commands/delete-asset.use-case.js';
import { LocalStorageProvider } from '../../infrastructure/storage/local-storage.provider.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';
import { BadRequestError, UnauthorizedError } from '../../../../shared/presentation/error-handler.middleware.js';
import { AssetCategory, AssetStatus } from '@monolith/contracts';

const presignUploadSchema = z.object({
  name: z.string().min(1, 'Asset name is required'),
  category: z.enum(['PROPERTY_IMAGE', 'INSPECTION_PHOTO', 'MAINTENANCE_RECEIPT', 'LEGAL_DOCUMENT', 'GENERAL']),
  mimeType: z.string().min(1, 'MIME type is required'),
  sizeBytes: z.number().positive('Size in bytes must be positive'),
  checksum: z.string().optional()
});

const confirmUploadSchema = z.object({
  checksum: z.string().optional()
});

const createAssetSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().positive(),
  storagePath: z.string().min(1),
  category: z.enum(['PROPERTY_IMAGE', 'INSPECTION_PHOTO', 'MAINTENANCE_RECEIPT', 'LEGAL_DOCUMENT', 'GENERAL']).optional()
});

export class AssetController {
  constructor(
    private readonly requestPresignedUploadUseCase: RequestPresignedUploadUseCase,
    private readonly confirmAssetUploadUseCase: ConfirmAssetUploadUseCase,
    private readonly getAssetDownloadUrlQuery: GetAssetDownloadUrlQuery,
    private readonly listTenantAssetsQuery: ListTenantAssetsQuery,
    private readonly deleteAssetUseCase: DeleteAssetUseCase,
    private readonly createAssetUseCase: CreateAssetUseCase,
    private readonly listAssetsQuery: ListAssetsQuery,
    private readonly storageProvider?: LocalStorageProvider
  ) {}

  private extractTenantId(req: Request): string {
    const rawHeader = req.headers['x-tenant-id'] || req.headers['x-organization-id'];
    const tenantFromHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    const tenantId = (
      req.tenantContext?.activeOrganization?.id ||
      tenantFromHeader ||
      req.user?.tenantId
    );

    if (!tenantId || tenantId.trim().length === 0) {
      throw new BadRequestError('Tenant ID is required (via X-Tenant-ID header or authenticated context)');
    }
    return tenantId.trim();
  }

  presignUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const validated = presignUploadSchema.parse(req.body);
      const tenantId = this.extractTenantId(req);
      const ownerId = req.user.id;

      const result = await this.requestPresignedUploadUseCase.execute({
        name: validated.name,
        category: validated.category as AssetCategory,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        checksum: validated.checksum,
        tenantId,
        ownerId
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const rawId = req.params.id;
      const assetId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!assetId) {
        return next(new BadRequestError('Asset ID parameter is required'));
      }

      const validated = confirmUploadSchema.parse(req.body || {});
      const tenantId = this.extractTenantId(req);

      const result = await this.confirmAssetUploadUseCase.execute({
        assetId,
        tenantId,
        checksum: validated.checksum
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const rawId = req.params.id;
      const assetId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!assetId) {
        return next(new BadRequestError('Asset ID parameter is required'));
      }

      const tenantId = this.extractTenantId(req);

      const result = await this.getAssetDownloadUrlQuery.execute({
        assetId,
        tenantId
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listTenantAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const tenantId = this.extractTenantId(req);
      const category = req.query.category as AssetCategory | undefined;
      const status = req.query.status as AssetStatus | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const result = await this.listTenantAssetsQuery.execute({
        tenantId,
        category,
        status,
        page,
        limit
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      const val = result.getValue();
      res.status(200).json({
        success: true,
        data: val.assets,
        meta: {
          total: val.total,
          page: val.page,
          limit: val.limit,
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const rawId = req.params.id;
      const assetId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!assetId) {
        return next(new BadRequestError('Asset ID parameter is required'));
      }

      const tenantId = this.extractTenantId(req);

      const result = await this.deleteAssetUseCase.execute({
        assetId,
        tenantId
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  handleLocalUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storageKey = decodeURIComponent(req.params[0] || req.url.replace(/^\/local-upload\/?/, ''));
      if (!storageKey) {
        return next(new BadRequestError('Storage key required for upload'));
      }

      const buffer = Buffer.isBuffer(req.body)
        ? req.body
        : typeof req.body === 'string'
        ? Buffer.from(req.body)
        : Buffer.from(JSON.stringify(req.body || {}));

      if (this.storageProvider) {
        await this.storageProvider.saveFile(storageKey, buffer);
      }

      res.status(200).json({
        success: true,
        data: { storageKey, sizeBytes: buffer.length },
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  // Backwards-compatible methods
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }
      const validated = createAssetSchema.parse(req.body);
      const ownerId = req.user.id;
      const tenantId = req.headers['x-tenant-id'] as string || req.user.tenantId || 'default-tenant';

      const result = await this.createAssetUseCase.execute({
        ...validated,
        ownerId,
        tenantId
      });

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listMyAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }
      const ownerId = req.user.id;
      const tenantId = req.headers['x-tenant-id'] as string || req.user.tenantId;

      const result = await this.listAssetsQuery.execute({ ownerId, tenantId });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
