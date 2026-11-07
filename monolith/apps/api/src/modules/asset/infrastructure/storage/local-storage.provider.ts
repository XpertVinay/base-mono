import fs from 'fs';
import path from 'path';
import { IStorageProvider } from '../../domain/services/storage-provider.interface.js';
import { sanitizeStorageKey } from '../../domain/services/storage-path.util.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;
  private memoryStore: Map<string, Buffer> = new Map();

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.env.LOCAL_STORAGE_DIR || path.resolve(process.cwd(), 'storage/uploads');
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch {
      // If filesystem directory creation fails in restricted environments, fallback in-memory store handles writes
    }
  }

  private resolvePath(storagePath: string): string {
    const sanitized = sanitizeStorageKey(storagePath);
    return path.join(this.baseDir, sanitized);
  }

  async generatePresignedUploadUrl(
    key: string,
    _mimeType: string,
    _expiresInSeconds: number
  ): Promise<{ uploadUrl: string; storagePath: string }> {
    const sanitizedKey = sanitizeStorageKey(key);
    const uploadUrl = `/api/assets/local-upload/${encodeURIComponent(sanitizedKey)}`;
    return {
      uploadUrl,
      storagePath: sanitizedKey
    };
  }

  async getDownloadUrl(
    storagePath: string,
    _expiresInSeconds: number
  ): Promise<string> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    return `/api/assets/download/${encodeURIComponent(sanitizedKey)}`;
  }

  async deleteFile(storagePath: string): Promise<void> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    this.memoryStore.delete(sanitizedKey);

    try {
      const fullPath = this.resolvePath(sanitizedKey);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      logger.warn('Could not delete local file from disk', { storagePath, error: (err as Error).message });
    }
  }

  async fileExists(storagePath: string): Promise<boolean> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    if (this.memoryStore.has(sanitizedKey)) {
      return true;
    }

    try {
      const fullPath = this.resolvePath(sanitizedKey);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  async saveFile(storagePath: string, content: Buffer): Promise<void> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    this.memoryStore.set(sanitizedKey, content);

    try {
      const fullPath = this.resolvePath(sanitizedKey);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content);
    } catch (err) {
      logger.warn('Could not save file to disk, cached in memory fallback', { storagePath, error: (err as Error).message });
    }
  }

  async getFile(storagePath: string): Promise<Buffer | null> {
    const sanitizedKey = sanitizeStorageKey(storagePath);
    if (this.memoryStore.has(sanitizedKey)) {
      return this.memoryStore.get(sanitizedKey)!;
    }

    try {
      const fullPath = this.resolvePath(sanitizedKey);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
    } catch {
      // return null
    }

    return null;
  }
}
