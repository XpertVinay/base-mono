export interface OidcAuthState {
  state: string;
  tenantId: string;
  providerId: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  clientRedirectUrl?: string;
  linkUserId?: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
}

