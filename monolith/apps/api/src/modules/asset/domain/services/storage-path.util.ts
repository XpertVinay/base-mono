export class StoragePathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoragePathValidationError';
  }
}

/**
 * Sanitizes an object storage path/key to prevent directory traversal attacks (e.g. `../` or leading slashes).
 * Preserves normalized forward slashes for folder hierarchies.
 */
export function sanitizeStorageKey(key: string): string {
  if (!key || typeof key !== 'string') {
    throw new StoragePathValidationError('Storage key must be a non-empty string');
  }

  // Remove null bytes
  let sanitized = key.replace(/\0/g, '');

  // Convert backslashes to forward slashes
  sanitized = sanitized.replace(/\\/g, '/');

  // Collapse multiple slashes into single slash
  sanitized = sanitized.replace(/\/+/g, '/');

  // Strip leading and trailing slashes
  sanitized = sanitized.replace(/^\/+/, '').replace(/\/+$/, '');

  // Split into path segments and eliminate traversal tokens ('.', '..', or empty)
  const segments = sanitized.split('/').filter(segment => {
    return segment.length > 0 && segment !== '.' && segment !== '..';
  });

  if (segments.length === 0) {
    throw new StoragePathValidationError('Invalid storage key: resolved to empty path');
  }

  return segments.join('/');
}

/**
 * Validates that an object storage key belongs to the authorized tenant directory (`tenants/<tenantId>/...`).
 * Throws StoragePathValidationError if the key violates tenant partitioning.
 */
export function validateTenantPathIsolation(key: string, expectedTenantId: string): string {
  const sanitized = sanitizeStorageKey(key);
  const expectedPrefix = `tenants/${expectedTenantId}/`;

  if (!sanitized.startsWith(expectedPrefix)) {
    throw new StoragePathValidationError(
      `Tenant path isolation violation: storage key does not belong to tenant partition '${expectedPrefix}'`
    );
  }

  return sanitized;
}

/**
 * Constructs a secure tenant-isolated storage path conforming to standard platform partitioning:
 * `tenants/<tenantId>/<category>/<uuid>-<filename>`
 */
export function buildTenantStoragePath(
  tenantId: string,
  category: string,
  uniquePrefix: string,
  fileName: string
): string {
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const rawKey = `tenants/${tenantId}/${category.toLowerCase()}/${uniquePrefix}-${cleanFileName}`;
  return sanitizeStorageKey(rawKey);
}
