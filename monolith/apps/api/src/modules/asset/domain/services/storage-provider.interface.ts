export interface IStorageProvider {
  generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds: number
  ): Promise<{ uploadUrl: string; storagePath: string }>;

  getDownloadUrl(
    storagePath: string,
    expiresInSeconds: number
  ): Promise<string>;

  deleteFile(storagePath: string): Promise<void>;

  fileExists(storagePath: string): Promise<boolean>;
}

