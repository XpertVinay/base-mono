import { IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { UserDto } from '@monolith/contracts';
import { NotFoundError } from '../../../../shared/presentation/error-handler.middleware.js';

export class GetUserByIdQuery implements IQuery<{ id: string }, UserDto> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute({ id }: { id: string }): Promise<Result<UserDto, Error>> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        return Result.fail(new NotFoundError(`User with id '${id}'`));
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
    } catch (error: any) {
      return Result.fail(error);
    }
  }
}
