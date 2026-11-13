import { OidcProvider } from '../../domain/entities/oidc-provider.entity.js';
import { OidcProviderType } from '../../shared/contracts/index.js';

export interface OidcDiscoveryMetadata {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
}

export interface BuildAuthUrlParams {
  provider: OidcProvider;
  state: string;
  nonce: string;
  codeChallenge?: string;
  redirectUri: string;
  loginHint?: string;
}

export interface ExchangeCodeParams {
  provider: OidcProvider;
  code: string;
  codeVerifier?: string;
  redirectUri: string;
  clientSecret?: string;
  nonce?: string;
  expectedState?: string;
}

export interface OidcTokenSet {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface VerifyIdTokenParams {
  provider: OidcProvider;
  idToken: string;
  expectedNonce?: string;
  accessToken?: string;
  clientSecret?: string;
}

export interface ExtractOAuth2ClaimsParams {
  provider: OidcProvider;
  accessToken: string;
}

export interface BuildLogoutUrlParams {
  provider: OidcProvider;
  idTokenHint?: string;
  postLogoutRedirectUri?: string;
  state?: string;
  subject?: string;
}

export interface NormalizedOidcClaims {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
  externalRoles: string[];
  rawClaims: Record<string, any>;
}

export interface IOidcProviderAdapter {
  readonly providerType: OidcProviderType;
  discover(issuerUrl: string): Promise<OidcDiscoveryMetadata>;
  buildAuthorizationUrl(params: BuildAuthUrlParams): Promise<string>;
  exchangeCode(params: ExchangeCodeParams): Promise<OidcTokenSet>;
  verifyIdTokenAndExtractClaims(params: VerifyIdTokenParams): Promise<NormalizedOidcClaims>;
  extractClaimsFromAccessToken?(params: ExtractOAuth2ClaimsParams): Promise<NormalizedOidcClaims>;
  buildLogoutUrl?(params: BuildLogoutUrlParams): Promise<string | undefined>;
}

export interface IOidcProviderRegistry {
  getAdapter(providerType: OidcProviderType): IOidcProviderAdapter;
  register(adapter: IOidcProviderAdapter): void;
  listSupportedTypes(): OidcProviderType[];
}
