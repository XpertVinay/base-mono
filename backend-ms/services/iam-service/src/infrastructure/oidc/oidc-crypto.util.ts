import crypto from 'crypto';

export interface JwkKey {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
  [key: string]: any;
}

interface JwksCacheEntry {
  keys: JwkKey[];
  fetchedAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();
const JWKS_TTL_MS = 5 * 60 * 1000;

export function decodeJwtParts(token: string): {
  header: Record<string, any>;
  payload: Record<string, any>;
  signingInput: string;
  signature: Buffer;
} {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT: expected 3 segments');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  const signature = Buffer.from(sigB64, 'base64url');
  return {
    header,
    payload,
    signingInput: `${headerB64}.${payloadB64}`,
    signature
  };
}

export async function fetchJwks(jwksUri: string, forceRefresh = false): Promise<JwkKey[]> {
  const cached = jwksCache.get(jwksUri);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.keys;
  }

  const res = await fetch(jwksUri, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUri}: HTTP ${res.status}`);
  }

  const body = (await res.json()) as { keys?: JwkKey[] };
  if (!body || !Array.isArray(body.keys)) {
    throw new Error('Invalid JWKS response: missing keys array');
  }

  jwksCache.set(jwksUri, { keys: body.keys, fetchedAt: Date.now() });
  return body.keys;
}

function verifySignatureWithJwk(
  alg: string,
  signingInput: string,
  signature: Buffer,
  jwk: JwkKey
): boolean {
  const publicKey = crypto.createPublicKey({ key: jwk as any, format: 'jwk' });
  const data = Buffer.from(signingInput, 'utf8');

  switch (alg) {
    case 'RS256':
      return crypto.verify('RSA-SHA256', data, publicKey, signature);
    case 'RS384':
      return crypto.verify('RSA-SHA384', data, publicKey, signature);
    case 'RS512':
      return crypto.verify('RSA-SHA512', data, publicKey, signature);
    case 'PS256':
      return crypto.verify(
        'RSA-SHA256',
        data,
        { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
        signature
      );
    case 'PS384':
      return crypto.verify(
        'RSA-SHA384',
        data,
        { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 48 },
        signature
      );
    case 'PS512':
      return crypto.verify(
        'RSA-SHA512',
        data,
        { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 },
        signature
      );
    case 'ES256':
      return crypto.verify('SHA256', data, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
    case 'ES384':
      return crypto.verify('SHA384', data, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
    case 'ES512':
      return crypto.verify('SHA512', data, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
    default:
      throw new Error(`Unsupported JWS algorithm: ${alg}`);
  }
}

function verifyHmacSignature(
  alg: string,
  signingInput: string,
  signature: Buffer,
  clientSecret: string
): boolean {
  const hashMap: Record<string, string> = {
    HS256: 'sha256',
    HS384: 'sha384',
    HS512: 'sha512'
  };
  const hashAlg = hashMap[alg];
  if (!hashAlg) return false;
  const expected = crypto.createHmac(hashAlg, clientSecret).update(signingInput).digest();
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(expected, signature);
}

async function verifyJwtSignature(
  token: string,
  jwksUri?: string,
  clientSecret?: string
): Promise<Record<string, any>> {
  const { header, payload, signingInput, signature } = decodeJwtParts(token);
  const alg = String(header.alg || '');

  if (!alg || alg.toLowerCase() === 'none') {
    throw new Error('Insecure or missing token signature algorithm');
  }

  if (alg.startsWith('HS')) {
    if (!clientSecret) {
      throw new Error('HMAC token requires clientSecret for verification');
    }
    const ok = verifyHmacSignature(alg, signingInput, signature, clientSecret);
    if (!ok) {
      throw new Error('Token HMAC signature verification failed');
    }
  } else {
    if (!jwksUri) {
      throw new Error('JWKS URI is required to verify asymmetric token signature');
    }

    let keys = await fetchJwks(jwksUri, false);
    let candidateKeys = header.kid ? keys.filter((k) => k.kid === header.kid) : keys;

    if (candidateKeys.length === 0 && header.kid) {
      keys = await fetchJwks(jwksUri, true);
      candidateKeys = keys.filter((k) => k.kid === header.kid);
    }

    if (candidateKeys.length === 0) {
      throw new Error(`No matching JWK found for kid '${header.kid || 'unspecified'}'`);
    }

    let verified = false;
    for (const key of candidateKeys) {
      try {
        if (verifySignatureWithJwk(alg, signingInput, signature, key)) {
          verified = true;
          break;
        }
      } catch {
        // Try next candidate key
      }
    }

    if (!verified) {
      throw new Error('Token signature verification failed against provider JWKS');
    }
  }

  return payload;
}

function isIssuerMatch(actualIssuer: string, expectedIssuer: string, tidClaim?: string): boolean {
  const normalize = (v: string) => v.replace(/\/+$/, '').toLowerCase();
  const actual = normalize(actualIssuer);
  const expected = normalize(expectedIssuer);

  if (actual === expected) {
    return true;
  }

  // Support Microsoft Entra ID multi-tenant issuers (/common/v2.0, /organizations/v2.0, /{tenantid}/v2.0)
  if (tidClaim && /^[a-z0-9-]+$/i.test(tidClaim)) {
    const substituted = expected
      .replace('/{tenantid}', `/${tidClaim.toLowerCase()}`)
      .replace('/common/', `/${tidClaim.toLowerCase()}/`)
      .replace('/organizations/', `/${tidClaim.toLowerCase()}/`)
      .replace(/\/common$/, `/${tidClaim.toLowerCase()}`)
      .replace(/\/organizations$/, `/${tidClaim.toLowerCase()}`);
    if (actual === substituted) {
      return true;
    }
  }

  return false;
}

export async function verifyOidcIdToken(options: {
  idToken: string;
  expectedIssuer: string;
  expectedAudience: string;
  expectedNonce?: string;
  jwksUri?: string;
  clientSecret?: string;
  clockToleranceSeconds?: number;
}): Promise<Record<string, any>> {
  const payload = await verifyJwtSignature(options.idToken, options.jwksUri, options.clientSecret);

  const tolerance = options.clockToleranceSeconds ?? 60;
  const nowSec = Math.floor(Date.now() / 1000);

  if (!payload.iss || !isIssuerMatch(String(payload.iss), options.expectedIssuer, payload.tid ? String(payload.tid) : undefined)) {
    throw new Error(`Invalid ID token issuer: expected '${options.expectedIssuer}', got '${payload.iss}'`);
  }

  const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audList.includes(options.expectedAudience)) {
    throw new Error(`Invalid ID token audience: expected '${options.expectedAudience}'`);
  }
  if (audList.length > 1 && payload.azp && payload.azp !== options.expectedAudience) {
    throw new Error(`Invalid ID token authorized party (azp): expected '${options.expectedAudience}'`);
  }

  if (typeof payload.exp !== 'number' || payload.exp + tolerance < nowSec) {
    throw new Error('ID token has expired');
  }

  if (typeof payload.nbf === 'number' && payload.nbf - tolerance > nowSec) {
    throw new Error('ID token is not yet valid (nbf)');
  }

  if (options.expectedNonce && payload.nonce !== options.expectedNonce) {
    throw new Error('ID token nonce mismatch');
  }

  if (!payload.sub) {
    throw new Error('ID token missing required sub claim');
  }

  return payload;
}

export async function verifyOidcLogoutToken(options: {
  logoutToken: string;
  expectedIssuer: string;
  expectedAudience: string;
  jwksUri?: string;
  clientSecret?: string;
  clockToleranceSeconds?: number;
}): Promise<{ sub?: string; sid?: string; jti?: string; rawClaims: Record<string, any> }> {
  const payload = await verifyJwtSignature(options.logoutToken, options.jwksUri, options.clientSecret);

  const tolerance = options.clockToleranceSeconds ?? 60;
  const nowSec = Math.floor(Date.now() / 1000);

  if (!payload.iss || !isIssuerMatch(String(payload.iss), options.expectedIssuer, payload.tid ? String(payload.tid) : undefined)) {
    throw new Error(`Invalid logout token issuer: expected '${options.expectedIssuer}', got '${payload.iss}'`);
  }

  const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audList.includes(options.expectedAudience)) {
    throw new Error(`Invalid logout token audience: expected '${options.expectedAudience}'`);
  }

  if (typeof payload.exp === 'number' && payload.exp + tolerance < nowSec) {
    throw new Error('Logout token has expired');
  }

  if (payload.nonce !== undefined) {
    throw new Error('Invalid logout token: nonce claim must not be present');
  }

  const events = payload.events;
  if (!events || typeof events !== 'object' || !events['http://schemas.openid.net/event/backchannel-logout']) {
    throw new Error('Invalid logout token: missing backchannel-logout event');
  }

  if (!payload.sub && !payload.sid) {
    throw new Error('Invalid logout token: missing both sub and sid claims');
  }

  return {
    sub: payload.sub ? String(payload.sub) : undefined,
    sid: payload.sid ? String(payload.sid) : undefined,
    jti: payload.jti ? String(payload.jti) : undefined,
    rawClaims: payload
  };
}

export function extractClaimByPath(claims: Record<string, any>, pathExpression?: string): any {
  if (!pathExpression) return undefined;
  const parts = pathExpression.split('.');
  let curr: any = claims;
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined;
    }
    curr = curr[part];
  }
  return curr;
}
