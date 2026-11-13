import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import { PasswordVO } from '../../domain/value-objects/password.vo.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { UserDto } from '../../shared/contracts/index.js';
import { TenantResolverService } from '../services/tenant-resolver.service.js';

export interface RegisterUserCommand {
  email: string;
  password: string;
  name: string;
  role?: 'USER' | 'ADMIN' | 'SUPPORT';
  tenantId?: string;
  tenantSlug?: string;
}

export class RegisterUserUseCase implements UseCase<RegisterUserCommand, UserDto> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantResolver: TenantResolverService
  ) {}

  async execute(command: RegisterUserCommand): Promise<Result<UserDto>> {
    const tenant = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });

    if (!tenant) {
      return Result.fail('Tenant not found or invalid tenant identifier');
    }
    if (!tenant.isActive) {
      return Result.fail('Tenant account is inactive');
    }
    if (!tenant.config.allowLocalLogin) {
      return Result.fail('Local registration is disabled for this tenant; please use federated SSO');
    }
    if (!tenant.isEmailDomainAllowed(command.email)) {
      return Result.fail('Email domain is not permitted for this tenant');
    }

    const existing = await this.userRepo.findByEmail(command.email, tenant.id);
    if (existing) {
      return Result.fail('A user with this email address already exists in this tenant');
    }

    const passwordHash = await PasswordVO.create(command.password);
    const user = User.create({
      tenantId: tenant.id,
      email: command.email,
      passwordHash,
      name: command.name,
      role: command.role || tenant.config.defaultRole || 'USER',
      authMethod: 'LOCAL'
    });

    await this.userRepo.save(user);

    await rabbitmq.publish('iam.user_registered', {
      id: crypto.randomUUID(),
      eventName: 'iam.user_registered',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      tenantId: tenant.id,
      payload: {
        userId: user.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        email: user.email,
        name: user.name,
        role: user.role,
        authMethod: user.authMethod
      },
      version: 1
    });

    return Result.ok({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      authMethod: user.authMethod,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    });
  }
}
