import crypto from 'crypto';
import { Result } from '../../../../../shared/domain/result.js';
import { IUserRepository } from '../../../domain/repositories/user-repository.interface.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Password } from '../../../domain/value-objects/password.vo.js';
import { tokenService, ClientContext } from '../../../../../shared/infrastructure/token.service.js';
import {
  SsoInitiateRequestDto,
  SsoInitiateResponseDto,
  SsoCallbackRequestDto,
  LoginResultDto,
  AuthTokensDto,
  MfaChallengeResponseDto
} from '@monolith/contracts';
import { BadRequestError, UnauthorizedError } from '../../../../../shared/presentation/error-handler.middleware.js';
import { IIamAuditRepository } from '../../../infrastructure/persistence/iam-audit.repository.js';

export class SsoLoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditRepository?: IIamAuditRepository
  ) { }

  public async initiate(
    input: SsoInitiateRequestDto,
    clientContext?: ClientContext
  ): Promise<Result<SsoInitiateResponseDto, Error>> {
    try {
      const state = crypto.randomBytes(24).toString('hex');
      const nonce = crypto.randomBytes(16).toString('hex');

      const redirectUri = input.redirectUri || 'https://monolith.local/api/iam/sso/callback';
      let authorizationUrl = '';

      switch (input.provider) {
        case 'google':
          authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=monolith-google-client&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile&state=${state}&nonce=${nonce}`;
          break;
        case 'azure-ad':
          authorizationUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=monolith-azure-client&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile&state=${state}&nonce=${nonce}`;
          break;
        case 'okta':
          authorizationUrl = `https://monolith.okta.com/oauth2/v1/authorize?client_id=monolith-okta-client&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile&state=${state}&nonce=${nonce}`;
          break;
        case 'mock-sso':
        default:
          authorizationUrl = `https://sso.monolith.local/authorize?client_id=monolith-mock-sso&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile&state=${state}&nonce=${nonce}`;
          break;
      }

      await this.auditRepository?.log({
        userId: null,
        eventType: 'IAM_SSO_INITIATED',
        ipAddress: clientContext?.ip,
        userAgent: clientContext?.userAgent,
        details: { provider: input.provider, redirectUri },
        status: 'SUCCESS'
      });

      return Result.ok({
        authorizationUrl,
        state,
        nonce,
        provider: input.provider
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }

  public async callback(
    input: SsoCallbackRequestDto,
    clientContext?: ClientContext
  ): Promise<Result<LoginResultDto, Error>> {
    try {
      if (!input.provider || !input.state) {
        return Result.fail(new BadRequestError('Provider and state are required for SSO callback'));
      }

      // Resolve user identity from SSO assertion or mockProfile (for testing/local development)
      let email = input.mockProfile?.email;
      let name = input.mockProfile?.name || 'SSO User';
      let subjectId = input.mockProfile?.subjectId || `sso-sub-${crypto.randomBytes(8).toString('hex')}`;

      if (!email) {
        // Fallback for code-based or token-based simulation
        if (input.code) {
          email = `sso-user-${crypto.createHash('sha256').update(input.code).digest('hex').slice(0, 8)}@sso.platform.io`;
          subjectId = `sub-${input.code}`;
        } else {
          return Result.fail(new BadRequestError('Missing identity assertion or authorization code'));
        }
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Look up existing user by SSO identifier or email
      let user = await this.userRepository.findBySso(input.provider, subjectId);
      if (!user) {
        user = await this.userRepository.findByEmail(normalizedEmail);
      }

      if (!user) {
        // Auto-provision user account from SSO assertion
        const dummyPasswordHash = `$2a$12$SSO.AutoProvisioned.${crypto.randomBytes(16).toString('hex')}`;
        user = User.create(
          normalizedEmail,
          Password.fromHashed(dummyPasswordHash),
          name,
          'USER',
          undefined,
          input.provider,
          subjectId
        );
        await this.userRepository.save(user);

        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_SSO_USER_AUTOPROVISIONED',
          ipAddress: clientContext?.ip,
          userAgent: clientContext?.userAgent,
          details: { email: user.email, provider: input.provider, subjectId },
          status: 'SUCCESS'
        });
      } else {
        // Link SSO provider if not linked yet
        if (!user.ssoProvider || !user.ssoSubjectId) {
          user.setSso(input.provider, subjectId);
          await this.userRepository.save(user);
        }
      }

      if (!user.isActive) {
        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_SSO_LOGIN_FAILED',
          ipAddress: clientContext?.ip,
          userAgent: clientContext?.userAgent,
          details: { email: user.email, reason: 'Account inactive' },
          status: 'FAILURE'
        });
        return Result.fail(new UnauthorizedError('User account is inactive'));
      }

      // STRICT AUTHENTICATION: If user has MFA enabled, SSO cannot bypass it!
      if (user.mfaEnabled) {
        const challengeToken = tokenService.generateMfaChallengeToken(
          {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          clientContext,
          5 * 60 * 1000 // 5m challenge validity
        );

        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_SSO_MFA_CHALLENGE',
          ipAddress: clientContext?.ip,
          userAgent: clientContext?.userAgent,
          details: { email: user.email, provider: input.provider, methods: ['totp', 'backup_code'] },
          status: 'SUCCESS'
        });

        const challengeDto: MfaChallengeResponseDto = {
          mfaRequired: true,
          mfaChallengeToken: challengeToken,
          methods: ['totp', 'backup_code'],
          userId: user.id,
          email: user.email,
          expiresInSeconds: 300
        };

        return Result.ok(challengeDto);
      }

      // SSO without MFA: generate tokens
      const tokens = tokenService.generateTokens(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        clientContext,
        false
      );

      await this.auditRepository?.log({
        userId: user.id,
        eventType: 'IAM_SSO_LOGIN_SUCCESS',
        ipAddress: clientContext?.ip,
        userAgent: clientContext?.userAgent,
        details: { email: user.email, provider: input.provider },
        status: 'SUCCESS'
      });

      const tokensDto: AuthTokensDto = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          mfaEnabled: false,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        },
        mfaVerified: false
      };

      return Result.ok(tokensDto);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
