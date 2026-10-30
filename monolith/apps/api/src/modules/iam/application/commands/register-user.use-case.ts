import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { ICryptoService } from '../../../../shared/infrastructure/crypto.service.js';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';
import { RegisterRequestDto, UserDto } from '@monolith/contracts';
import { ConflictError, ValidationError } from '../../../../shared/presentation/error-handler.middleware.js';

export class RegisterUserUseCase implements IUseCase<RegisterRequestDto, UserDto> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cryptoService: ICryptoService,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: RegisterRequestDto): Promise<Result<UserDto, Error>> {
    try {
      // 1. Check if user already exists
      const existing = await this.userRepository.findByEmail(input.email);
      if (existing) {
        return Result.fail(new ConflictError(`User with email '${input.email}' already exists`));
      }

      // 2. Validate & hash password
      let passwordVo: Password;
      try {
        passwordVo = Password.create(input.password);
      } catch (err: any) {
        return Result.fail(new ValidationError(err.message));
      }

      const passwordHash = await this.cryptoService.hashPassword(passwordVo.value);
      const hashedVo = Password.fromHashed(passwordHash);

      // 3. Create domain entity
      const user = User.create(
        input.email,
        hashedVo,
        input.name,
        input.role || 'USER',
        undefined,
        null,
        null,
        input.tenantId
      );

      // 4. Save through repository
      await this.userRepository.save(user);

      // 5. Dispatch domain events
      for (const event of user.domainEvents) {
        await this.eventBus.publish({
          id: event.id,
          eventName: event.eventName,
          aggregateId: event.aggregateId,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
          version: event.version
        });
      }
      user.clearEvents();

      const userDto: UserDto = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId || undefined,
        isActive: user.isActive,
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      };

      return Result.ok(userDto);
    } catch (error: any) {
      return Result.fail(error);
    }
  }
}
