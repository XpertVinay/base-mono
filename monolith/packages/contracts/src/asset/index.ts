export type AssetCategory =
  | 'PROPERTY_IMAGE'
  | 'INSPECTION_PHOTO'
  | 'MAINTENANCE_RECEIPT'
  | 'LEGAL_DOCUMENT'
  | 'GENERAL';

export type AssetStatus =
  | 'PENDING_UPLOAD'
  | 'ACTIVE'
  | 'QUARANTINED'
  | 'ARCHIVED';

export type StorageProviderType = 'LOCAL' | 'S3' | 'GCS';

export interface StorageConfigDto {
  provider: StorageProviderType;
  s3?: {
    bucket: string;
    region?: string;
    endpoint?: string;
    cdnBaseUrl?: string;
    forcePathStyle?: boolean;
  };
  gcs?: {
    bucket: string;
    projectId?: string;
    cdnBaseUrl?: string;
  };
  localStorageDir?: string;
}

export interface AssetDto {
  id: string;
  tenantId: string;
  ownerId: string;
  name: string;
  category: AssetCategory;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  status: AssetStatus;
  checksum?: string;
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresignUploadRequestDto {
  name: string;
  category: AssetCategory;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
}

export interface PresignUploadResponseDto {
  assetId: string;
  uploadUrl: string;
  storagePath: string;
  expiresInSeconds: number;
  requiredHeaders?: Record<string, string>;
}

export interface ConfirmUploadRequestDto {
  checksum?: string;
}

export interface CreateAssetRequestDto {
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  tenantId?: string;
  category?: AssetCategory;
}
