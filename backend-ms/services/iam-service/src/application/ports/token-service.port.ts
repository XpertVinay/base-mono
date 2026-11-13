import { User } from '../../domain/entities/user.entity.js';
import { AuthTokensDto, ServiceProviderTokenDto } from '../../shared/contracts/index.js';

export interface TokenIssueMetadata {
  tenantId: string;
  tenantSlug?: string;
  authMethod: 'LOCAL' | 'OIDC' | 'HYBRID';
  provider?: string;
  federatedSub?: string;
  sessionId?: string;
  refreshTokenJti?: string;
  audience?: string;
  scope?: string;
  expiresInSeconds?: number;
  isNewUser?: boolean;
  redirectUrl?: string;
}

export interface ServiceTokenIssueMetadata {
  tenantId: string;
  tenantSlug?: string;
  authMethod: 'LOCAL' | 'OIDC' | 'HYBRID';
  provider?: string;
  sessionId: string;
  audience: string;
  scope?: string;
  expiresInSeconds?: number;
}

export interface DecodedRefreshToken {
  sub: string;
  tenantId: string;
  tenantSlug?: string;
  authMethod?: string;
  provider?: string;
  sid?: string;
  jti?: string;
  type: 'refresh';
}

export interface ITokenService {
  issueTokens(user: User, meta: TokenIssueMetadata): AuthTokensDto;
  issueServiceToken?(user: User, meta: ServiceTokenIssueMetadata): ServiceProviderTokenDto;
  verifyRefreshToken(token: string): DecodedRefreshToken;
}
