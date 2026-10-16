import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { UserDto } from '../../shared/contracts/index.js';

export interface GetUserByIdQueryInput {
  userId: string;
}

export class GetUserByIdQuery implements UseCase<GetUserByIdQueryInput, UserDto> {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(query: GetUserByIdQueryInput): Promise<Result<UserDto>> {
    const user = await this.userRepo.findById(query.userId);
    if (!user) {
      return Result.fail('User not found');
    }

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
