import crypto from 'crypto';
import zlib from 'zlib';
import jwt from 'jsonwebtoken';
import {
  BuildAuthUrlParams,
  BuildLogoutUrlParams,
  ExchangeCodeParams,
  ExtractOAuth2ClaimsParams,
  NormalizedOidcClaims,
  OidcDiscoveryMetadata,
  OidcTokenSet,
  VerifyIdTokenParams
} from '../../application/ports/oidc-provider-adapter.port.js';
import { OidcProviderType } from '../../shared/contracts/index.js';
import { GenericOidcAdapter, parseEmailVerifiedClaim } from './generic-oidc.adapter.js';
import { extractClaimByPath } from './oidc-crypto.util.js';

export class GoogleOidcAdapter extends GenericOidcAdapter {
  override readonly providerType: OidcProviderType = 'GOOGLE';

  override async buildAuthorizationUrl(params: BuildAuthUrlParams): Promise<string> {
    const url = new URL(await super.buildAuthorizationUrl(params));
    if (!url.searchParams.has('access_type')) {
      url.searchParams.set('access_type', 'offline');
    }
    if (params.provider.allowedDomains.length === 1 && !url.searchParams.has('hd')) {
      url.searchParams.set('hd', params.provider.allowedDomains[0]);
    }
    return url.toString();
  }

  override async buildLogoutUrl(params: BuildLogoutUrlParams): Promise<string | undefined> {
    const configured = await super.buildLogoutUrl(params);
    if (configured) return configured;
    // Google OIDC discovery does not expose end_session_endpoint, provide safe token revocation / logout redirect fallback
    if (params.postLogoutRedirectUri) {
      return params.postLogoutRedirectUri;
    }
    return undefined;
  }
}

export class EntraIdOidcAdapter extends GenericOidcAdapter {
  override readonly providerType: OidcProviderType = 'ENTRA_ID';

  override async buildAuthorizationUrl(params: BuildAuthUrlParams): Promise<string> {
    const url = new URL(await super.buildAuthorizationUrl(params));
    if (!url.searchParams.has('response_mode')) {
      url.searchParams.set('response_mode', 'query');
    }
    return url.toString();
  }

  protected override extractEmail(claims: Record<string, any>, mapping: Record<string, string>): string {
    const primary = super.extractEmail(claims, mapping);
    if (primary) return primary;
    const fallback = claims.preferred_username || claims.upn || claims.unique_name;
    return fallback ? String(fallback).trim().toLowerCase() : '';
  }

  protected override extractExternalRoles(claims: Record<string, any>, mapping: Record<string, string>): string[] {
    const base = super.extractExternalRoles(claims, mapping);
    const wids = Array.isArray(claims.wids) ? claims.wids.map(String) : [];
    return Array.from(new Set([...base, ...wids]));
  }
}

export class OktaOidcAdapter extends GenericOidcAdapter {
  override readonly providerType: OidcProviderType = 'OKTA';
}

export class KeycloakOidcAdapter extends GenericOidcAdapter {
  override readonly providerType: OidcProviderType = 'KEYCLOAK';

  protected override extractExternalRoles(claims: Record<string, any>, mapping: Record<string, string>): string[] {
    const base = super.extractExternalRoles(claims, mapping);
    const realmRoles: string[] = Array.isArray(claims.realm_access?.roles) ? claims.realm_access.roles : [];
    const resourceRoles: string[] = [];
    if (claims.resource_access && typeof claims.resource_access === 'object') {
      for (const clientAccess of Object.values(claims.resource_access) as any[]) {
        if (Array.isArray(clientAccess?.roles)) {
          resourceRoles.push(...clientAccess.roles);
        }
      }
    }
    return Array.from(new Set([...base, ...realmRoles, ...resourceRoles]));
  }
}

export class GenericOAuth2Adapter extends GenericOidcAdapter {
  override readonly providerType: OidcProviderType = 'GENERIC_OAUTH2';

  protected override async resolveEndpoints(provider: BuildAuthUrlParams['provider']): Promise<OidcDiscoveryMetadata> {
    if (provider.authorizationEndpoint && provider.tokenEndpoint) {
      return {
        issuer: provider.issuerUrl,
        authorizationEndpoint: provider.authorizationEndpoint,
        tokenEndpoint: provider.tokenEndpoint,
        userinfoEndpoint: provider.userinfoEndpoint,
        jwksUri: provider.jwksUri,
        endSessionEndpoint: provider.endSessionEndpoint
      };
    }
    return super.resolveEndpoints(provider);
  }

  override async buildAuthorizationUrl(params: BuildAuthUrlParams): Promise<string> {
    const endpoints = await this.resolveEndpoints(params.provider);
    const url = new URL(endpoints.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', params.provider.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('scope', params.provider.scopes || 'read:user user:email');
    url.searchParams.set('state', params.state);

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

  override async extractClaimsFromAccessToken(params: ExtractOAuth2ClaimsParams): Promise<NormalizedOidcClaims> {
    const endpoints = await this.resolveEndpoints(params.provider);
    if (!endpoints.userinfoEndpoint) {
      throw new Error('OAuth2 provider is missing userinfoEndpoint');
    }
    const userInfo = await this.fetchUserInfo(endpoints.userinfoEndpoint, params.accessToken);
    const mapping = params.provider.claimMapping || {};
    const normalized = this.normalizeClaimsObject(userInfo, mapping);
    if (!normalized.subject) {
      throw new Error('OAuth2 userinfo response missing subject/id claim');
    }
    return normalized;
  }
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractXmlTagText(xml: string, localName: string): string | undefined {
  const re = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${localName}>`, 'i');
  const match = xml.match(re);
  return match ? decodeXmlEntities(match[1].trim()) : undefined;
}

function extractXmlAttribute(xml: string, tagName: string, attrName: string): string | undefined {
  const tagRe = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}\\b([^>]*)>`, 'i');
  const tagMatch = xml.match(tagRe);
  if (!tagMatch) return undefined;
  const attrRe = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']+)["']`, 'i');
  const attrMatch = tagMatch[1].match(attrRe);
  return attrMatch ? decodeXmlEntities(attrMatch[1]) : undefined;
}

function extractSamlAttributes(xml: string): Record<string, string | string[]> {
  const attrs: Record<string, string | string[]> = {};
  const attrRe = /<(?:[a-zA-Z0-9_-]+:)?Attribute\b[^>]*\bName\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?Attribute>/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(xml)) !== null) {
    const attrName = decodeXmlEntities(match[1]);
    const inner = match[2];
    const values: string[] = [];
    const valRe = /<(?:[a-zA-Z0-9_-]+:)?AttributeValue\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?AttributeValue>/gi;
    let valMatch: RegExpExecArray | null;
    while ((valMatch = valRe.exec(inner)) !== null) {
      const val = decodeXmlEntities(valMatch[1].trim());
      if (val) values.push(val);
    }
    if (values.length === 1) {
      attrs[attrName] = values[0];
    } else if (values.length > 1) {
      attrs[attrName] = values;
    }
  }
  return attrs;
}

export class SamlFederationAdapter extends GenericOidcAdapter {
  override readonly providerType: OidcProviderType = 'SAML';

  override async discover(issuerUrl: string): Promise<OidcDiscoveryMetadata> {
    const base = issuerUrl.replace(/\/+$/, '');
    return {
      issuer: base,
      authorizationEndpoint: `${base}/sso`,
      tokenEndpoint: `${base}/acs`,
      endSessionEndpoint: `${base}/slo`
    };
  }

  override async buildAuthorizationUrl(params: BuildAuthUrlParams): Promise<string> {
    const samlCfg = params.provider.samlConfig || {};
    const idpSsoUrl = samlCfg.idpSsoUrl || params.provider.authorizationEndpoint;
    if (!idpSsoUrl) {
      throw new Error('SAML provider requires samlConfig.idpSsoUrl or authorizationEndpoint');
    }

    const spEntityId = samlCfg.spEntityId || params.provider.clientId;
    const requestId = `_${params.state}`;
    const issueInstant = new Date().toISOString();
    const nameIdFormat = samlCfg.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';

    const authnRequestXml = [
      `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
      ` ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}"`,
      ` Destination="${idpSsoUrl}"`,
      ` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
      ` AssertionConsumerServiceURL="${params.redirectUri}">`,
      `<saml:Issuer>${spEntityId}</saml:Issuer>`,
      `<samlp:NameIDPolicy Format="${nameIdFormat}" AllowCreate="true"/>`,
      `</samlp:AuthnRequest>`
    ].join('');

    const deflated = zlib.deflateRawSync(Buffer.from(authnRequestXml, 'utf8')).toString('base64');
    const url = new URL(idpSsoUrl);
    url.searchParams.set('SAMLRequest', deflated);
    url.searchParams.set('RelayState', params.state);
    return url.toString();
  }

  override async exchangeCode(params: ExchangeCodeParams): Promise<OidcTokenSet> {
    // For SAML, `params.code` carries the base64-encoded SAMLResponse from the ACS POST callback
    const xml = Buffer.from(params.code, 'base64').toString('utf8');
    if (!xml.includes('Response') && !xml.includes('Assertion')) {
      throw new Error('Malformed SAMLResponse payload');
    }

    const samlCfg = params.provider.samlConfig || {};
    const statusValue = extractXmlAttribute(xml, 'StatusCode', 'Value');
    if (statusValue && !statusValue.endsWith(':Success')) {
      throw new Error(`SAML authentication failed with status: ${statusValue}`);
    }

    const expectedIssuer = samlCfg.idpEntityId || params.provider.issuerUrl;
    const issuer = extractXmlTagText(xml, 'Issuer');
    if (expectedIssuer && issuer && issuer.replace(/\/+$/, '').toLowerCase() !== expectedIssuer.replace(/\/+$/, '').toLowerCase()) {
      throw new Error(`SAML Issuer mismatch: expected '${expectedIssuer}', got '${issuer}'`);
    }

    const expectedAudience = samlCfg.spEntityId || params.provider.clientId;
    const audience = extractXmlTagText(xml, 'Audience');
    if (expectedAudience && audience && audience !== expectedAudience) {
      throw new Error(`SAML Audience mismatch: expected '${expectedAudience}', got '${audience}'`);
    }

    const inResponseTo = extractXmlAttribute(xml, 'Response', 'InResponseTo') || extractXmlAttribute(xml, 'SubjectConfirmationData', 'InResponseTo');
    if (params.expectedState && inResponseTo && inResponseTo !== `_${params.expectedState}` && inResponseTo !== params.expectedState) {
      throw new Error('SAML InResponseTo does not match active authentication state');
    }

    const notBefore = extractXmlAttribute(xml, 'Conditions', 'NotBefore');
    const notOnOrAfter = extractXmlAttribute(xml, 'Conditions', 'NotOnOrAfter');
    const now = Date.now();
    const skewMs = 60 * 1000;
    if (notBefore && new Date(notBefore).getTime() - skewMs > now) {
      throw new Error('SAML assertion is not yet valid (NotBefore)');
    }
    if (notOnOrAfter && new Date(notOnOrAfter).getTime() + skewMs < now) {
      throw new Error('SAML assertion has expired (NotOnOrAfter)');
    }

    // Verify SAML Signature if IdP certificate is configured
    if (samlCfg.idpCertificatePem) {
      const sigValueB64 = extractXmlTagText(xml, 'SignatureValue');
      const signedInfoMatch = xml.match(/<((?:[a-zA-Z0-9_-]+:)?SignedInfo)\b[^>]*>[\s\S]*?<\/\1>/i);
      if (!sigValueB64 || !signedInfoMatch) {
        throw new Error('SAMLResponse missing XML Signature required by provider certificate configuration');
      }
      const sigMethodAlg = extractXmlAttribute(signedInfoMatch[0], 'SignatureMethod', 'Algorithm') || '';
      const hashAlg = sigMethodAlg.toLowerCase().includes('sha1') ? 'RSA-SHA1' : 'RSA-SHA256';
      const signatureBuf = Buffer.from(sigValueB64.replace(/\s+/g, ''), 'base64');
      const verifier = crypto.createVerify(hashAlg);
      verifier.update(signedInfoMatch[0], 'utf8');
      let verified = verifier.verify(samlCfg.idpCertificatePem, signatureBuf);
      if (!verified) {
        // Fallback: verify against normalized whitespace canonical SignedInfo
        const normalizedSignedInfo = signedInfoMatch[0].replace(/>\s+</g, '><').trim();
        const verifierNorm = crypto.createVerify(hashAlg);
        verifierNorm.update(normalizedSignedInfo, 'utf8');
        verified = verifierNorm.verify(samlCfg.idpCertificatePem, signatureBuf);
      }
      if (!verified) {
        throw new Error('SAMLResponse XML signature verification failed');
      }
    }

    const nameId = extractXmlTagText(xml, 'NameID');
    if (!nameId) {
      throw new Error('SAMLResponse missing NameID subject');
    }

    const attrs = extractSamlAttributes(xml);
    const mapping = params.provider.claimMapping || {};
    const emailAttr = attrs[mapping.email || 'email'] || attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || (nameId.includes('@') ? nameId : undefined);
    const nameAttr = attrs[mapping.name || 'name'] || attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || attrs.displayName;
    const roleAttr = attrs[mapping.role || 'role'] || attrs[mapping.groups || 'groups'] || attrs['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

    const assertionToken = jwt.sign(
      {
        iss: expectedIssuer,
        aud: expectedAudience,
        sub: nameId,
        email: Array.isArray(emailAttr) ? emailAttr[0] : emailAttr,
        email_verified: true,
        name: Array.isArray(nameAttr) ? nameAttr[0] : nameAttr,
        role: roleAttr,
        saml_attributes: attrs
      },
      params.clientSecret || process.env.JWT_SECRET || 'dev-saml-bridge-secret',
      { algorithm: 'HS256', expiresIn: '2m' }
    );

    return {
      accessToken: `saml_assertion_${crypto.randomUUID()}`,
      idToken: assertionToken,
      tokenType: 'SAML2'
    };
  }

  override async verifyIdTokenAndExtractClaims(params: VerifyIdTokenParams): Promise<NormalizedOidcClaims> {
    const decoded = jwt.verify(
      params.idToken,
      params.clientSecret || process.env.JWT_SECRET || 'dev-saml-bridge-secret',
      { algorithms: ['HS256'] }
    ) as Record<string, any>;

    const mapping = params.provider.claimMapping || {};
    return this.normalizeClaimsObject(decoded, mapping, String(decoded.sub));
  }

  override async buildLogoutUrl(params: BuildLogoutUrlParams): Promise<string | undefined> {
    const samlCfg = params.provider.samlConfig || {};
    const idpSloUrl = samlCfg.idpSloUrl || params.provider.endSessionEndpoint;
    if (!idpSloUrl) return undefined;

    const spEntityId = samlCfg.spEntityId || params.provider.clientId;
    const reqId = `_${crypto.randomUUID()}`;
    const issueInstant = new Date().toISOString();
    const logoutReqXml = [
      `<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
      ` ID="${reqId}" Version="2.0" IssueInstant="${issueInstant}" Destination="${idpSloUrl}">`,
      `<saml:Issuer>${spEntityId}</saml:Issuer>`,
      `<saml:NameID>${params.subject || ''}</saml:NameID>`,
      `</samlp:LogoutRequest>`
    ].join('');

    const deflated = zlib.deflateRawSync(Buffer.from(logoutReqXml, 'utf8')).toString('base64');
    const url = new URL(idpSloUrl);
    url.searchParams.set('SAMLRequest', deflated);
    if (params.state) {
      url.searchParams.set('RelayState', params.state);
    }
    return url.toString();
  }
}

/**
 * Deterministic Mock OIDC Adapter for local development, CI, and integration testing
 * without requiring external IdP connectivity.
 */
export class MockOidcAdapter extends GenericOidcAdapter {
  override readonly providerType: OidcProviderType = 'MOCK';

  private getMockSigningSecret(clientSecret?: string): string {
    return (
      clientSecret ||
      process.env.MOCK_OIDC_SECRET ||
      process.env.JWT_SECRET ||
      'dev-mock-oidc-signing-secret-32-chars'
    );
  }

  override async discover(issuerUrl: string): Promise<OidcDiscoveryMetadata> {
    const base = issuerUrl.replace(/\/+$/, '');
    return {
      issuer: base,
      authorizationEndpoint: `${base}/authorize`,
      tokenEndpoint: `${base}/token`,
      userinfoEndpoint: `${base}/userinfo`,
      jwksUri: `${base}/.well-known/jwks.json`,
      endSessionEndpoint: `${base}/logout`
    };
  }

  override async buildAuthorizationUrl(params: BuildAuthUrlParams): Promise<string> {
    const authEndpoint = params.provider.authorizationEndpoint || `${params.provider.issuerUrl}/authorize`;
    const url = new URL(authEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', params.provider.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('scope', params.provider.scopes || 'openid profile email');
    url.searchParams.set('state', params.state);
    url.searchParams.set('nonce', params.nonce);
    if (params.codeChallenge) {
      url.searchParams.set('code_challenge', params.codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    return url.toString();
  }

  override async exchangeCode(params: ExchangeCodeParams): Promise<OidcTokenSet> {
    if (params.provider.tokenEndpoint && params.provider.tokenEndpoint.startsWith('http') && !params.code.startsWith('mock_code:')) {
      return super.exchangeCode(params);
    }

    const secret = this.getMockSigningSecret(params.clientSecret);
    let email = `federated.user@${params.provider.tenantId}.local`;
    let name = 'Federated Mock User';
    let role = 'USER';
    let sub = `mock-sub-${params.provider.tenantId}-default`;

    if (params.code.startsWith('mock_code:')) {
      const [, parsedEmail, parsedName, parsedRole, parsedSub] = params.code.split(':');
      if (parsedEmail) email = parsedEmail;
      if (parsedName) name = parsedName;
      if (parsedRole) role = parsedRole;
      sub = parsedSub || `mock-sub-${Buffer.from(email).toString('base64url')}`;
    }

    const idToken = jwt.sign(
      {
        iss: params.provider.issuerUrl,
        aud: params.provider.clientId,
        sub,
        email,
        email_verified: true,
        name,
        role,
        ...(params.nonce ? { nonce: params.nonce } : {})
      },
      secret,
      { algorithm: 'HS256', expiresIn: '5m' }
    );

    return {
      accessToken: `mock_access_${crypto.randomUUID()}`,
      idToken,
      tokenType: 'Bearer',
      expiresIn: 300
    };
  }

  override async verifyIdTokenAndExtractClaims(params: VerifyIdTokenParams): Promise<NormalizedOidcClaims> {
    if (params.provider.jwksUri) {
      return super.verifyIdTokenAndExtractClaims(params);
    }

    const secret = this.getMockSigningSecret(params.clientSecret);
    const decoded = jwt.verify(params.idToken, secret, {
      algorithms: ['HS256'],
      issuer: params.provider.issuerUrl,
      audience: params.provider.clientId
    }) as Record<string, any>;

    if (params.expectedNonce && decoded.nonce !== params.expectedNonce) {
      throw new Error('ID token nonce mismatch');
    }

    const mapping = params.provider.claimMapping || {};
    const email = this.extractEmail(decoded, mapping);
    const rawName = extractClaimByPath(decoded, mapping.name || 'name');
    const name = rawName ? String(rawName) : (email ? email.split('@')[0] : 'Federated User');
    const externalRoles = this.extractExternalRoles(decoded, mapping);

    return {
      subject: String(extractClaimByPath(decoded, mapping.sub || 'sub') || decoded.sub),
      email,
      emailVerified: parseEmailVerifiedClaim(extractClaimByPath(decoded, mapping.emailVerified || 'email_verified'), false),
      name,
      externalRoles,
      rawClaims: decoded
    };
  }
}
