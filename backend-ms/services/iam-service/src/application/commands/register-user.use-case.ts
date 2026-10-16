import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import { PasswordVO } from '../../domain/value-objects/password.vo.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { UserDto } from '../../shared/contracts/index.js';

export interface RegisterUserCommand {
  email: string;
  password: string;
  name: string;
  role?: 'USER' | 'ADMIN' | 'SUPPORT';
}

export class RegisterUserUseCase implements UseCase<RegisterUserCommand, UserDto> {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(command: RegisterUserCommand): Promise<Result<UserDto>> {
    const existing = await this.userRepo.findByEmail(command.email);
    if (existing) {
      return Result.fail('A user with this email address already exists');
    }

    const passwordHash = await PasswordVO.create(command.password);
    const user = User.create({
      email: command.email,
      passwordHash,
      name: command.name,
      role: command.role || 'USER'
    });

    await this.userRepo.save(user);

    // Publish event via RabbitMQ
    await rabbitmq.publish('iam.user_registered', {
      id: crypto.randomUUID(),
      eventName: 'iam.user_registered',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      version: 1
    });

    return Result.ok({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    });
  }
}
