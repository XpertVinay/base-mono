export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

export function decodeJwt(token: string): DecodedJwt | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const decodePart = (b64Url: string) => {
      const b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text) as Record<string, unknown>;
    };

    return {
      header: decodePart(parts[0]!),
      payload: decodePart(parts[1]!),
      signature: parts[2]!,
    };
  } catch {
    return null;
  }
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const codeVerifier = toBase64Url(randomBytes);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    const codeChallenge = toBase64Url(new Uint8Array(digest));
    return { codeVerifier, codeChallenge };
  }

  return { codeVerifier, codeChallenge: codeVerifier };
}

