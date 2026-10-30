import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { ICryptoService } from '../../../../shared/infrastructure/crypto.service.js';
import { tokenService, ClientContext } from '../../../../shared/infrastructure/token.service.js';
import { LoginRequestDto, LoginResultDto, AuthTokensDto, MfaChallengeResponseDto } from '@monolith/contracts';
import { UnauthorizedError } from '../../../../shared/presentation/error-handler.middleware.js';
import { IIamAuditRepository } from '../../infrastructure/persistence/iam-audit.repository.js';

export interface LoginUseCaseInput extends LoginRequestDto {
  clientContext?: ClientContext;
}

export class LoginUserUseCase implements IUseCase<LoginUseCaseInput, LoginResultDto> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cryptoService: ICryptoService,
    private readonly auditRepository?: IIamAuditRepository
  ) { }

  async execute(input: LoginUseCaseInput): Promise<Result<LoginResultDto, Error>> {
    try {
      const user = await this.userRepository.findByEmail(input.email);
      if (!user) {
        await this.auditRepository?.log({
          userId: null,
          eventType: 'IAM_LOGIN_FAILED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { email: input.email, reason: 'User not found' },
          status: 'FAILURE'
        });
        return Result.fail(new UnauthorizedError('Invalid email or password'));
      }

      const isMatch = await this.cryptoService.comparePassword(input.password, user.password.value);
      if (!isMatch) {
        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_LOGIN_FAILED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { email: input.email, reason: 'Password mismatch' },
          status: 'FAILURE'
        });
        return Result.fail(new UnauthorizedError('Invalid email or password'));
      }

      if (!user.isActive) {
        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_LOGIN_FAILED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { email: input.email, reason: 'Account inactive' },
          status: 'FAILURE'
        });
        return Result.fail(new UnauthorizedError('Account is inactive'));
      }

      // Check if user requires MFA challenge
      if (user.mfaEnabled) {
        const challengeToken = tokenService.generateMfaChallengeToken(
          {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          input.clientContext,
          5 * 60 * 1000 // 5 minutes validity
        );

        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_MFA_CHALLENGE_ISSUED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { email: user.email, methods: ['totp', 'backup_code'] },
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

      // Generate hardened, encrypted, and device-bound tokens (accessToken, refreshToken, idToken)
      const tenantId = user.tenantId || input.tenantId || input.clientContext?.tenantId;
      const tokens = tokenService.generateTokens(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId
        },
        input.clientContext,
        false
      );

      await this.auditRepository?.log({
        userId: user.id,
        eventType: 'IAM_LOGIN_SUCCESS',
        ipAddress: input.clientContext?.ip,
        userAgent: input.clientContext?.userAgent,
        details: { email: user.email, mfaEnforced: false, tenantId },
        status: 'SUCCESS'
      });

      const tokensDto: AuthTokensDto = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken,
        tenantId,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId || tenantId,
          isActive: user.isActive,
          mfaEnabled: user.mfaEnabled,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        },
        mfaVerified: false
      };

      return Result.ok(tokensDto);
    } catch (error: any) {
      return Result.fail(error);
    }
  }
}
