import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../../domain/entities/user.entity.js';
import { AuthTokensDto, ServiceProviderTokenDto } from '../../shared/contracts/index.js';
import {
  DecodedRefreshToken,
  ITokenService,
  ServiceTokenIssueMetadata,
  TokenIssueMetadata
} from '../../application/ports/token-service.port.js';

export class JwtTokenService implements ITokenService {
  private getSecret(): string {
    return process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
  }

  issueTokens(user: User, meta: TokenIssueMetadata): AuthTokensDto {
    const secret = this.getSecret();
    const expiresIn = meta.expiresInSeconds || parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);
    const accessJti = crypto.randomUUID();
    const refreshJti = meta.refreshTokenJti || crypto.randomUUID();

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: meta.tenantId,
        tenantSlug: meta.tenantSlug,
        authMethod: meta.authMethod,
        aud: meta.audience || 'platform-api',
        jti: accessJti,
        ...(meta.sessionId ? { sid: meta.sessionId } : {}),
        ...(meta.scope ? { scope: meta.scope } : {}),
        ...(meta.provider ? { provider: meta.provider } : {}),
        ...(meta.federatedSub ? { federatedSub: meta.federatedSub } : {})
      },
      secret,
      { expiresIn }
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        tenantId: meta.tenantId,
        tenantSlug: meta.tenantSlug,
        authMethod: meta.authMethod,
        jti: refreshJti,
        ...(meta.sessionId ? { sid: meta.sessionId } : {}),
        ...(meta.provider ? { provider: meta.provider } : {}),
        type: 'refresh'
      },
      secret,
      { expiresIn: '7d' }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      ...(meta.sessionId ? { sessionId: meta.sessionId } : {}),
      audience: meta.audience || 'platform-api',
      tenantId: meta.tenantId,
      tenantSlug: meta.tenantSlug,
      authMethod: meta.authMethod,
      ...(meta.provider ? { provider: meta.provider } : {}),
      ...(meta.isNewUser !== undefined ? { isNewUser: meta.isNewUser } : {}),
      ...(meta.redirectUrl ? { redirectUrl: meta.redirectUrl } : {}),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        authMethod: user.authMethod,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    };
  }

  issueServiceToken(user: User, meta: ServiceTokenIssueMetadata): ServiceProviderTokenDto {
    const secret = this.getSecret();
    const expiresIn = meta.expiresInSeconds || 300;
    const jti = crypto.randomUUID();

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: meta.tenantId,
        tenantSlug: meta.tenantSlug,
        authMethod: meta.authMethod,
        sid: meta.sessionId,
        aud: meta.audience,
        jti,
        tokenUse: 'service-sso',
        ...(meta.scope ? { scope: meta.scope } : {}),
        ...(meta.provider ? { provider: meta.provider } : {})
      },
      secret,
      { expiresIn }
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      audience: meta.audience,
      ...(meta.scope ? { scope: meta.scope } : {}),
      tenantId: meta.tenantId,
      tenantSlug: meta.tenantSlug,
      sessionId: meta.sessionId,
      authMethod: meta.authMethod,
      ...(meta.provider ? { provider: meta.provider } : {})
    };
  }

  verifyRefreshToken(token: string): DecodedRefreshToken {
    const decoded = jwt.verify(token, this.getSecret()) as any;
    if (decoded.type !== 'refresh' || !decoded.sub) {
      throw new Error('Token is not a valid refresh token');
    }
    return {
      sub: decoded.sub,
      tenantId: decoded.tenantId || decoded.tid || process.env.DEFAULT_TENANT_ID || 'default',
      tenantSlug: decoded.tenantSlug,
      authMethod: decoded.authMethod,
      provider: decoded.provider,
      sid: decoded.sid,
      jti: decoded.jti,
      type: 'refresh'
    };
  }
}
