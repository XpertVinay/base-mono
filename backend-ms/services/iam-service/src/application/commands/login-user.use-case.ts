import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import jwt from 'jsonwebtoken';
import { AuthTokensDto } from '../../shared/contracts/index.js';

export interface LoginUserCommand {
  email: string;
  password: string;
}

export class LoginUserUseCase implements UseCase<LoginUserCommand, AuthTokensDto> {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(command: LoginUserCommand): Promise<Result<AuthTokensDto>> {
    const user = await this.userRepo.findByEmail(command.email);
    if (!user) {
      return Result.fail('Invalid email or password credentials');
    }

    if (!user.isActive) {
      return Result.fail('User account has been disabled');
    }

    const isMatch = await user.passwordHash.compare(command.password);
    if (!isMatch) {
      return Result.fail('Invalid email or password credentials');
    }

    const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
    const expiresIn = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      secret,
      { expiresIn }
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        type: 'refresh'
      },
      secret,
      { expiresIn: '7d' }
    );

    return Result.ok({
      accessToken,
      refreshToken,
      expiresIn
    });
  }
}
