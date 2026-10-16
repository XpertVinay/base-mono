import jwt from 'jsonwebtoken';
import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { ICryptoService } from '../../../../shared/infrastructure/crypto.service.js';
import { securityConfig } from '../../../../config/security.js';
import { LoginRequestDto, AuthTokensDto } from '@monolith/contracts';
import { UnauthorizedError } from '../../../../shared/presentation/error-handler.middleware.js';

export class LoginUserUseCase implements IUseCase<LoginRequestDto, AuthTokensDto> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cryptoService: ICryptoService
  ) {}

  async execute(input: LoginRequestDto): Promise<Result<AuthTokensDto, Error>> {
    try {
      const user = await this.userRepository.findByEmail(input.email);
      if (!user) {
        return Result.fail(new UnauthorizedError('Invalid email or password'));
      }

      const isMatch = await this.cryptoService.comparePassword(input.password, user.password.value);
      if (!isMatch) {
        return Result.fail(new UnauthorizedError('Invalid email or password'));
      }

      if (!user.isActive) {
        return Result.fail(new UnauthorizedError('Account is inactive'));
      }

      // Generate access & refresh tokens
      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role
      };

      const accessToken = jwt.sign(tokenPayload, securityConfig.jwt.secret, {
        expiresIn: securityConfig.jwt.expiresIn as any
      });

      const refreshToken = jwt.sign(tokenPayload, securityConfig.jwt.refreshSecret, {
        expiresIn: securityConfig.jwt.refreshExpiresIn as any
      });

      const tokensDto: AuthTokensDto = {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        }
      };

      return Result.ok(tokensDto);
    } catch (error: any) {
      return Result.fail(error);
    }
  }
}
