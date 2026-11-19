/**
 * Security & Sanitization Utilities (Requirement R4)
 * Provides input sanitization, HTML tag stripping, and URL protocol whitelisting.
 */

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Trims leading/trailing whitespace from string.
 */
export function sanitizeString(val: string | undefined | null): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

/**
 * Strips HTML tags and script/style elements (including their contents) to prevent stored XSS attacks.
 */
export function stripHtml(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Validates whether a given URL adheres to secure protocols (http:, https:).
 * Explicitly rejects javascript:, data:, file:, and vbscript: pseudo-protocols.
 */
export function isValidUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    // Relative URLs or malformed URLs
    return false;
  }
}

/**
 * Returns a sanitized URL if valid; otherwise returns fallback URL or empty string.
 */
export function sanitizeUrl(rawUrl: string | undefined | null, fallback = ''): string {
  if (isValidUrl(rawUrl)) {
    return String(rawUrl).trim();
  }
  return fallback;
}

/**
 * Recursively trims and sanitizes strings in an object payload.
 */
export function sanitizePayload<T>(payload: T): T {
  if (typeof payload === 'string') {
    return sanitizeString(payload) as unknown as T;
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item)) as unknown as T;
  }
  if (payload !== null && typeof payload === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      sanitizedObj[key] = sanitizePayload(value);
    }
    return sanitizedObj as T;
  }
  return payload;
}
