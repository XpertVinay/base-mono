export interface AssetDto {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetRequestDto {
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}
