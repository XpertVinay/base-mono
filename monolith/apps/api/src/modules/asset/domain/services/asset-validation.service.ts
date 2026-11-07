export interface MimeRule {
  maxBytes: number;
  allowedExtensions: string[];
}

export const ALLOWED_MIME_REGISTRY: Record<string, MimeRule> = {
  'image/jpeg': {
    maxBytes: 15 * 1024 * 1024, // 15MB
    allowedExtensions: ['.jpg', '.jpeg']
  },
  'image/png': {
    maxBytes: 15 * 1024 * 1024, // 15MB
    allowedExtensions: ['.png']
  },
  'image/webp': {
    maxBytes: 15 * 1024 * 1024, // 15MB
    allowedExtensions: ['.webp']
  },
  'application/pdf': {
    maxBytes: 25 * 1024 * 1024, // 25MB
    allowedExtensions: ['.pdf']
  },
  'text/csv': {
    maxBytes: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.csv']
  }
};

export const PROHIBITED_EXTENSIONS = [
  '.exe', '.sh', '.bat', '.cmd', '.bin', '.js', '.mjs', '.ts', '.php', '.py', '.vbs', '.com', '.msi'
];

export class AssetValidationService {
  public static validateFile(name: string, mimeType: string, sizeBytes: number): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'File name cannot be empty' };
    }

    const lowerName = name.toLowerCase();
    const isProhibited = PROHIBITED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
    if (isProhibited) {
      return { valid: false, error: `Executable or script file extension is strictly prohibited: ${name}` };
    }

    const rule = ALLOWED_MIME_REGISTRY[mimeType.toLowerCase()];
    if (!rule) {
      return { valid: false, error: `Unsupported or prohibited MIME type: ${mimeType}. Allowed MIME types: ${Object.keys(ALLOWED_MIME_REGISTRY).join(', ')}` };
    }

    const matchesExtension = rule.allowedExtensions.some(ext => lowerName.endsWith(ext));
    if (!matchesExtension) {
      return { valid: false, error: `File name extension does not match MIME type ${mimeType}. Expected extensions: ${rule.allowedExtensions.join(', ')}` };
    }

    if (sizeBytes <= 0) {
      return { valid: false, error: 'File size must be greater than zero bytes' };
    }

    if (sizeBytes > rule.maxBytes) {
      const maxMb = (rule.maxBytes / (1024 * 1024)).toFixed(0);
      const actualMb = (sizeBytes / (1024 * 1024)).toFixed(2);
      return { valid: false, error: `File size (${actualMb}MB) exceeds maximum permitted limit of ${maxMb}MB for MIME type ${mimeType}` };
    }

    return { valid: true };
  }
}

