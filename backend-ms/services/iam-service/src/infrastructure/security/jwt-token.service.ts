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
  private readonly rsaPrivateKey: string;
  private readonly rsaPublicKey: string;
  private readonly keyId: string;
  private readonly algorithm: 'RS256' | 'HS256';

  constructor() {
    this.keyId = process.env.JWT_KEY_ID || 'key-rs256-1';
    this.algorithm = process.env.JWT_ALGORITHM === 'HS256' ? 'HS256' : 'RS256';

    const envPrivKey = process.env.JWT_PRIVATE_KEY || process.env.IAM_JWT_PRIVATE_KEY;
    const envPubKey = process.env.JWT_PUBLIC_KEY || process.env.IAM_JWT_PUBLIC_KEY;

    if (envPrivKey && envPubKey) {
      this.rsaPrivateKey = envPrivKey.replace(/\\n/g, '\n');
      this.rsaPublicKey = envPubKey.replace(/\\n/g, '\n');
    } else {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      this.rsaPublicKey = publicKey;
      this.rsaPrivateKey = privateKey;
    }

    if (!process.env.JWT_PUBLIC_KEY) {
      process.env.JWT_PUBLIC_KEY = this.rsaPublicKey;
    }
    if (!process.env.JWT_PRIVATE_KEY) {
      process.env.JWT_PRIVATE_KEY = this.rsaPrivateKey;
    }
  }

  private getSecret(): string {
    return process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
  }

  public getPublicKeyPem(): string {
    return this.rsaPublicKey;
  }

  public getJwks(): { keys: Array<{ kty: string; use: string; alg: string; kid: string; n: string; e: string }> } {
    const keyObject = crypto.createPublicKey(this.rsaPublicKey);
    const jwk = keyObject.export({ format: 'jwk' }) as any;
    return {
      keys: [
        {
          kty: jwk.kty || 'RSA',
          use: 'sig',
          alg: 'RS256',
          kid: this.keyId,
          n: jwk.n || '',
          e: jwk.e || 'AQAB'
        }
      ]
    };
  }

  issueTokens(user: User, meta: TokenIssueMetadata): AuthTokensDto {
    const expiresIn = meta.expiresInSeconds || parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);
    const accessJti = crypto.randomUUID();
    const refreshJti = meta.refreshTokenJti || crypto.randomUUID();

    const accessPayload: Record<string, any> = {
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
      ...(meta.federatedSub ? { federatedSub: meta.federatedSub } : {}),
      ...(meta.deviceFingerprint ? { fgp: meta.deviceFingerprint } : {})
    };

    let accessToken: string;
    if (this.algorithm === 'RS256') {
      accessToken = jwt.sign(accessPayload, this.rsaPrivateKey, {
        algorithm: 'RS256',
        keyid: this.keyId,
        expiresIn
      });
    } else {
      accessToken = jwt.sign(accessPayload, this.getSecret(), {
        algorithm: 'HS256',
        expiresIn
      });
    }

    const refreshPayload: Record<string, any> = {
      sub: user.id,
      tenantId: meta.tenantId,
      tenantSlug: meta.tenantSlug,
      authMethod: meta.authMethod,
      jti: refreshJti,
      ...(meta.sessionId ? { sid: meta.sessionId } : {}),
      ...(meta.provider ? { provider: meta.provider } : {}),
      ...(meta.deviceFingerprint ? { fgp: meta.deviceFingerprint } : {}),
      type: 'refresh'
    };

    let refreshToken: string;
    if (this.algorithm === 'RS256') {
      refreshToken = jwt.sign(refreshPayload, this.rsaPrivateKey, {
        algorithm: 'RS256',
        keyid: this.keyId,
        expiresIn: '7d'
      });
    } else {
      refreshToken = jwt.sign(refreshPayload, this.getSecret(), {
        algorithm: 'HS256',
        expiresIn: '7d'
      });
    }

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
    const expiresIn = meta.expiresInSeconds || 300;
    const jti = crypto.randomUUID();

    const payload: Record<string, any> = {
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
    };

    let accessToken: string;
    if (this.algorithm === 'RS256') {
      accessToken = jwt.sign(payload, this.rsaPrivateKey, {
        algorithm: 'RS256',
        keyid: this.keyId,
        expiresIn
      });
    } else {
      accessToken = jwt.sign(payload, this.getSecret(), {
        algorithm: 'HS256',
        expiresIn
      });
    }

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

  verifyRefreshToken(token: string, deviceFingerprint?: string): DecodedRefreshToken {
    const decodedAny = jwt.decode(token, { complete: true }) as any;
    const alg = decodedAny?.header?.alg;

    let decoded: any;
    if (alg === 'RS256') {
      decoded = jwt.verify(token, this.rsaPublicKey, { algorithms: ['RS256'] });
    } else {
      decoded = jwt.verify(token, this.getSecret(), { algorithms: ['HS256'] });
    }

    if (decoded.type !== 'refresh' || !decoded.sub) {
      throw new Error('Token is not a valid refresh token');
    }

    if (decoded.fgp) {
      const clientFgp = deviceFingerprint?.trim();
      if (!clientFgp) {
        throw new Error('Session hijacking detected: device fingerprint required');
      }
      const hashedClientFgp = crypto.createHash('sha256').update(clientFgp).digest('hex');
      if (decoded.fgp !== clientFgp && decoded.fgp !== hashedClientFgp) {
        throw new Error('Session hijacking detected: device fingerprint mismatch');
      }
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
