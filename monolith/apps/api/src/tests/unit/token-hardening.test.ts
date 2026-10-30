import { describe, it, expect } from 'vitest';
import { tokenService, ClientContext } from '../../shared/infrastructure/token.service.js';
import { UnauthorizedError } from '../../shared/presentation/error-handler.middleware.js';
import jwt from 'jsonwebtoken';

describe('Token Hardening & Anti-Session Hijacking Engine', () => {
  const mockUser = {
    id: 'user-sec-999',
    email: 'hardened@monolith.local',
    name: 'Hardened Tester',
    role: 'USER' as const
  };

  const clientContextBrowserA: ClientContext = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ip: '192.168.1.50',
    deviceFingerprint: 'browser-a-fingerprint-unique'
  };

  const clientContextBrowserB: ClientContext = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    ip: '203.0.113.195',
    deviceFingerprint: 'browser-b-attacker-machine'
  };

  it('generates accessToken, refreshToken, and idToken', () => {
    const tokens = tokenService.generateTokens(mockUser, clientContextBrowserA);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.idToken).toBeDefined();
  });

  it('encrypts accessToken and refreshToken with AES-256-GCM so they cannot be decoded or inspected', () => {
    const tokens = tokenService.generateTokens(mockUser, clientContextBrowserA);

    // 1. Formats start with opaque prefixes
    expect(tokens.accessToken.startsWith('enc.')).toBe(true);
    expect(tokens.refreshToken.startsWith('ref.')).toBe(true);

    // 2. Cannot be parsed as standard JWT
    expect(jwt.decode(tokens.accessToken)).toBeNull();
    expect(jwt.decode(tokens.refreshToken)).toBeNull();

    // 3. Raw ciphertext is encrypted binary and does not contain plain email or user ID
    expect(tokens.accessToken).not.toContain(mockUser.email);
    expect(tokens.accessToken).not.toContain(mockUser.id);
    expect(tokens.refreshToken).not.toContain(mockUser.email);
    expect(tokens.refreshToken).not.toContain(mockUser.id);
  });

  it('generates a valid, verifiable OIDC idToken for client identity rendering', () => {
    const tokens = tokenService.generateTokens(mockUser, clientContextBrowserA);

    const decoded = jwt.verify(tokens.idToken, tokenService.getPublicKeyPem(), { algorithms: ['RS256'] }) as any;
    expect(decoded.sub).toBe(mockUser.id);
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.name).toBe(mockUser.name);
    expect(decoded.role).toBe(mockUser.role);
    expect(decoded.iss).toBe('monolith-iam');
    expect(decoded.aud).toBe('monolith-client');
  });

  it('successfully verifies accessToken when used from the same browser/client context', () => {
    const tokens = tokenService.generateTokens(mockUser, clientContextBrowserA);

    const verified = tokenService.verifyAccessToken(tokens.accessToken, clientContextBrowserA);
    expect(verified.id).toBe(mockUser.id);
    expect(verified.email).toBe(mockUser.email);
    expect(verified.role).toBe(mockUser.role);
  });

  it('strictly rejects accessToken with Session Hijacking error when replayed from a different browser/system', () => {
    const tokens = tokenService.generateTokens(mockUser, clientContextBrowserA);

    // Attacker tries to use victim token from Browser B / System B
    expect(() => {
      tokenService.verifyAccessToken(tokens.accessToken, clientContextBrowserB);
    }).toThrow(UnauthorizedError);

    try {
      tokenService.verifyAccessToken(tokens.accessToken, clientContextBrowserB);
    } catch (err: any) {
      expect(err.message).toContain('Session hijacking detected');
    }
  });

  it('strictly rejects refreshToken with Session Hijacking error when replayed from a different device', () => {
    const tokens = tokenService.generateTokens(mockUser, clientContextBrowserA);

    // Attacker tries to refresh tokens from another machine
    expect(() => {
      tokenService.verifyRefreshToken(tokens.refreshToken, clientContextBrowserB);
    }).toThrow(UnauthorizedError);

    try {
      tokenService.verifyRefreshToken(tokens.refreshToken, clientContextBrowserB);
    } catch (err: any) {
      expect(err.message).toContain('Session hijacking detected');
    }
  });

  it('successfully validates and rotates refreshToken on the legitimate device', () => {
    const tokens = tokenService.generateTokens(mockUser, clientContextBrowserA);

    const claims = tokenService.verifyRefreshToken(tokens.refreshToken, clientContextBrowserA);
    expect(claims.id).toBe(mockUser.id);
    expect(claims.role).toBe(mockUser.role);
    expect(claims.jti).toBeDefined();
  });

  it('embeds and propagates multi-tenant tenantId across token claims', () => {
    const tenantUser = {
      ...mockUser,
      tenantId: 'tenant-prestige-group-001'
    };
    const tokens = tokenService.generateTokens(tenantUser, clientContextBrowserA);

    const accessClaims = tokenService.verifyAccessToken(tokens.accessToken, clientContextBrowserA);
    expect(accessClaims.tenantId).toBe('tenant-prestige-group-001');

    const refreshClaims = tokenService.verifyRefreshToken(tokens.refreshToken, clientContextBrowserA);
    expect(refreshClaims.tenantId).toBe('tenant-prestige-group-001');

    const idClaims = jwt.verify(tokens.idToken, tokenService.getPublicKeyPem(), { algorithms: ['RS256'] }) as any;
    expect(idClaims.tenant_id).toBe('tenant-prestige-group-001');
  });

  it('generates and verifies Asymmetric RS256 Access Tokens for microservices & third-party tenants', () => {
    const asymToken = tokenService.generateAsymmetricAccessToken(
      { ...mockUser, tenantId: 'tenant-acme-corp' },
      clientContextBrowserA
    );

    expect(asymToken).toBeDefined();
    // Verify using only the public key
    const verified = tokenService.verifyAsymmetricToken(asymToken, clientContextBrowserA);
    expect(verified.id).toBe(mockUser.id);
    expect(verified.email).toBe(mockUser.email);
    expect(verified.tenantId).toBe('tenant-acme-corp');
  });

  it('strictly rejects Asymmetric RS256 token with Session Hijacking error when replayed on a different device', () => {
    const asymToken = tokenService.generateAsymmetricAccessToken(mockUser, clientContextBrowserA);

    expect(() => {
      tokenService.verifyAsymmetricToken(asymToken, clientContextBrowserB);
    }).toThrow(UnauthorizedError);
  });

  it('exports RFC 7517 compliant JWKS and SPKI PEM for decentralized public key distribution', () => {
    const jwks = tokenService.getJwks();
    expect(jwks.keys).toBeDefined();
    expect(jwks.keys.length).toBeGreaterThan(0);
    const firstKey = jwks.keys[0]!;
    expect(firstKey.kty).toBe('RSA');
    expect(firstKey.alg).toBe('RS256');
    expect(firstKey.use).toBe('sig');
    expect(firstKey.kid).toBe('monolith-iam-key-1');
    expect(firstKey.n).toBeDefined();
    expect(firstKey.e).toBe('AQAB');

    const pem = tokenService.getPublicKeyPem();
    expect(pem.includes('BEGIN PUBLIC KEY')).toBe(true);
    expect(pem.includes('END PUBLIC KEY')).toBe(true);
  });
});

