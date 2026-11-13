import {
  BuildAuthUrlParams,
  BuildLogoutUrlParams,
  ExchangeCodeParams,
  ExtractOAuth2ClaimsParams,
  IOidcProviderAdapter,
  NormalizedOidcClaims,
  OidcDiscoveryMetadata,
  OidcTokenSet,
  VerifyIdTokenParams
} from '../../application/ports/oidc-provider-adapter.port.js';
import { OidcProviderType } from '../../shared/contracts/index.js';
import { extractClaimByPath, verifyOidcIdToken } from './oidc-crypto.util.js';

interface DiscoveryCacheItem {
  metadata: OidcDiscoveryMetadata;
  fetchedAt: number;
}

const discoveryCache = new Map<string, DiscoveryCacheItem>();
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

export function parseEmailVerifiedClaim(raw: unknown, defaultWhenMissing = false): boolean {
  if (raw === undefined || raw === null) {
    return defaultWhenMissing;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  const normalized = String(raw).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export class GenericOidcAdapter implements IOidcProviderAdapter {
  readonly providerType: OidcProviderType = 'GENERIC_OIDC';

  async discover(issuerUrl: string): Promise<OidcDiscoveryMetadata> {
    const normalized = issuerUrl.replace(/\/+$/, '');
    const cached = discoveryCache.get(normalized);
    if (cached && Date.now() - cached.fetchedAt < DISCOVERY_TTL_MS) {
      return cached.metadata;
    }

    const wellKnownUrl = `${normalized}/.well-known/openid-configuration`;
    const res = await fetch(wellKnownUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      throw new Error(`OIDC discovery failed at ${wellKnownUrl}: HTTP ${res.status}`);
    }

    const doc = (await res.json()) as Record<string, any>;
    if (!doc.authorization_endpoint || !doc.token_endpoint) {
      throw new Error('OIDC discovery document missing authorization_endpoint or token_endpoint');
    }

    const metadata: OidcDiscoveryMetadata = {
      issuer: String(doc.issuer || normalized),
      authorizationEndpoint: String(doc.authorization_endpoint),
      tokenEndpoint: String(doc.token_endpoint),
      userinfoEndpoint: doc.userinfo_endpoint ? String(doc.userinfo_endpoint) : undefined,
      jwksUri: doc.jwks_uri ? String(doc.jwks_uri) : undefined,
      endSessionEndpoint: doc.end_session_endpoint ? String(doc.end_session_endpoint) : undefined
    };

    discoveryCache.set(normalized, { metadata, fetchedAt: Date.now() });
    return metadata;
  }

  protected async resolveEndpoints(provider: BuildAuthUrlParams['provider']): Promise<OidcDiscoveryMetadata> {
    if (provider.authorizationEndpoint && provider.tokenEndpoint && provider.jwksUri) {
      return {
        issuer: provider.issuerUrl,
        authorizationEndpoint: provider.authorizationEndpoint,
        tokenEndpoint: provider.tokenEndpoint,
        userinfoEndpoint: provider.userinfoEndpoint,
        jwksUri: provider.jwksUri,
        endSessionEndpoint: provider.endSessionEndpoint
      };
    }

    const discovered = await this.discover(provider.issuerUrl);
    return {
      issuer: discovered.issuer || provider.issuerUrl,
      authorizationEndpoint: provider.authorizationEndpoint || discovered.authorizationEndpoint,
      tokenEndpoint: provider.tokenEndpoint || discovered.tokenEndpoint,
      userinfoEndpoint: provider.userinfoEndpoint || discovered.userinfoEndpoint,
      jwksUri: provider.jwksUri || discovered.jwksUri,
      endSessionEndpoint: provider.endSessionEndpoint || discovered.endSessionEndpoint
    };
  }

  async buildAuthorizationUrl(params: BuildAuthUrlParams): Promise<string> {
    const endpoints = await this.resolveEndpoints(params.provider);
    const url = new URL(endpoints.authorizationEndpoint);

    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', params.provider.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('scope', params.provider.scopes || 'openid profile email');
    url.searchParams.set('state', params.state);
    if (params.provider.protocol === 'OIDC') {
      url.searchParams.set('nonce', params.nonce);
    }

    if (params.codeChallenge && params.provider.usePkce) {
      url.searchParams.set('code_challenge', params.codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }

    if (params.loginHint) {
      url.searchParams.set('login_hint', params.loginHint);
    }

    for (const [k, v] of Object.entries(params.provider.extraAuthParams || {})) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }

    return url.toString();
  }

  protected parseTokenResponseBody(rawText: string): Record<string, any> {
    const trimmed = rawText.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as Record<string, any>;
    } catch {
      const params = new URLSearchParams(trimmed);
      const parsed: Record<string, any> = {};
      for (const [k, v] of params.entries()) {
        parsed[k] = v;
      }
      return parsed;
    }
  }

  async exchangeCode(params: ExchangeCodeParams): Promise<OidcTokenSet> {
    const endpoints = await this.resolveEndpoints(params.provider);

    const form = new URLSearchParams();
    form.set('grant_type', 'authorization_code');
    form.set('code', params.code);
    form.set('redirect_uri', params.redirectUri);
    form.set('client_id', params.provider.clientId);

    if (params.clientSecret) {
      form.set('client_secret', params.clientSecret);
    }
    if (params.codeVerifier) {
      form.set('code_verifier', params.codeVerifier);
    }

    const res = await fetch(endpoints.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: form.toString(),
      signal: AbortSignal.timeout(15000)
    });

    const rawText = await res.text();
    const data = this.parseTokenResponseBody(rawText);
    if (!res.ok) {
      throw new Error(
        `OIDC token exchange failed: ${data.error_description || data.error || res.statusText || `HTTP ${res.status}`}`
      );
    }

    return {
      accessToken: String(data.access_token || ''),
      idToken: data.id_token ? String(data.id_token) : undefined,
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      tokenType: data.token_type ? String(data.token_type) : undefined,
      expiresIn:
        typeof data.expires_in === 'number'
          ? data.expires_in
          : data.expires_in
            ? Number(data.expires_in) || undefined
            : undefined
    };
  }

  protected async fetchUserInfo(userinfoEndpoint: string, accessToken: string): Promise<Record<string, any>> {
    const res = await fetch(userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      throw new Error(`OIDC userinfo request failed: HTTP ${res.status}`);
    }

    return (await res.json()) as Record<string, any>;
  }

  protected extractEmail(claims: Record<string, any>, mapping: Record<string, string>): string {
    const emailPath = mapping.email || 'email';
    const raw = extractClaimByPath(claims, emailPath);
    return raw ? String(raw).trim().toLowerCase() : '';
  }

  protected extractSubject(claims: Record<string, any>, mapping: Record<string, string>, fallbackSub?: string): string {
    const subPath = mapping.sub || 'sub';
    const raw = extractClaimByPath(claims, subPath) ?? claims.sub ?? claims.id ?? fallbackSub;
    return raw !== undefined && raw !== null ? String(raw) : '';
  }

  protected normalizeClaimsObject(
    combinedClaims: Record<string, any>,
    mapping: Record<string, string>,
    fallbackSub?: string
  ): NormalizedOidcClaims {
    const subject = this.extractSubject(combinedClaims, mapping, fallbackSub);
    const email = this.extractEmail(combinedClaims, mapping);
    const rawName = extractClaimByPath(combinedClaims, mapping.name || 'name');
    const name = rawName ? String(rawName).trim() : (email ? email.split('@')[0] : 'Federated User');
    const emailVerifiedRaw = extractClaimByPath(combinedClaims, mapping.emailVerified || 'email_verified');
    const emailVerified = parseEmailVerifiedClaim(emailVerifiedRaw, false);
    const externalRoles = this.extractExternalRoles(combinedClaims, mapping);

    return {
      subject,
      email,
      emailVerified,
      name,
      externalRoles,
      rawClaims: combinedClaims
    };
  }

  async verifyIdTokenAndExtractClaims(params: VerifyIdTokenParams): Promise<NormalizedOidcClaims> {
    const endpoints = await this.resolveEndpoints(params.provider);

    const idClaims = await verifyOidcIdToken({
      idToken: params.idToken,
      expectedIssuer: endpoints.issuer || params.provider.issuerUrl,
      expectedAudience: params.provider.clientId,
      expectedNonce: params.expectedNonce,
      jwksUri: endpoints.jwksUri,
      clientSecret: params.clientSecret
    });

    let combinedClaims = { ...idClaims };
    const mapping = params.provider.claimMapping || {};

    // Fetch UserInfo if email or name is missing from ID Token
    if (
      (!this.extractEmail(combinedClaims, mapping) || !extractClaimByPath(combinedClaims, mapping.name || 'name')) &&
      endpoints.userinfoEndpoint &&
      params.accessToken
    ) {
      try {
        const userInfo = await this.fetchUserInfo(endpoints.userinfoEndpoint, params.accessToken);
        if (!userInfo.sub || userInfo.sub === idClaims.sub) {
          combinedClaims = { ...userInfo, ...combinedClaims };
        }
      } catch {
        // Non-fatal if ID token already contains required claims
      }
    }

    return this.normalizeClaimsObject(combinedClaims, mapping, String(idClaims.sub));
  }

  async extractClaimsFromAccessToken(params: ExtractOAuth2ClaimsParams): Promise<NormalizedOidcClaims> {
    const endpoints = await this.resolveEndpoints(params.provider);
    if (!endpoints.userinfoEndpoint) {
      throw new Error('OAuth2 provider does not define a userinfoEndpoint');
    }
    const userInfo = await this.fetchUserInfo(endpoints.userinfoEndpoint, params.accessToken);
    const mapping = params.provider.claimMapping || {};
    return this.normalizeClaimsObject(userInfo, mapping);
  }

  async buildLogoutUrl(params: BuildLogoutUrlParams): Promise<string | undefined> {
    let endSessionEndpoint = params.provider.endSessionEndpoint;
    if (!endSessionEndpoint) {
      try {
        const discovered = await this.discover(params.provider.issuerUrl);
        endSessionEndpoint = discovered.endSessionEndpoint;
      } catch {
        return undefined;
      }
    }
    if (!endSessionEndpoint) return undefined;

    const url = new URL(endSessionEndpoint);
    if (params.idTokenHint) {
      url.searchParams.set('id_token_hint', params.idTokenHint);
    }
    url.searchParams.set('client_id', params.provider.clientId);
    if (params.postLogoutRedirectUri) {
      url.searchParams.set('post_logout_redirect_uri', params.postLogoutRedirectUri);
    }
    if (params.state) {
      url.searchParams.set('state', params.state);
    }
    return url.toString();
  }

  protected extractExternalRoles(claims: Record<string, any>, mapping: Record<string, string>): string[] {
    const roles: string[] = [];
    const roleClaim = extractClaimByPath(claims, mapping.role || 'role');
    const groupsClaim = extractClaimByPath(claims, mapping.groups || 'groups');

    for (const val of [roleClaim, groupsClaim, claims.roles]) {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string') roles.push(item);
        }
      } else if (typeof val === 'string' && val.trim()) {
        roles.push(val.trim());
      }
    }

    return Array.from(new Set(roles));
  }
}
