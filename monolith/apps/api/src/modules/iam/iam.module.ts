import { Router } from 'express';
import { PostgresUserRepository } from './infrastructure/persistence/postgres-user.repository.js';
import { RegisterUserUseCase } from './application/commands/register-user.use-case.js';
import { LoginUserUseCase } from './application/commands/login-user.use-case.js';
import { GetUserByIdQuery } from './application/queries/get-user-by-id.query.js';
import { IamController } from './presentation/http/iam.controller.js';
import { createIamRouter } from './presentation/http/iam.routes.js';
import { cryptoService } from '../../shared/infrastructure/crypto.service.js';
import { eventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { UserDto } from '@monolith/contracts';

export interface IIamModulePublicApi {
  getUserById(id: string): Promise<UserDto | null>;
}

export class IamModule {
  public static init(): { router: Router; publicApi: IIamModulePublicApi } {
    const userRepository = new PostgresUserRepository();
    const registerUserUseCase = new RegisterUserUseCase(userRepository, cryptoService, eventBus);
    const loginUserUseCase = new LoginUserUseCase(userRepository, cryptoService);
    const getUserByIdQuery = new GetUserByIdQuery(userRepository);

    const controller = new IamController(registerUserUseCase, loginUserUseCase, getUserByIdQuery);
    const router = createIamRouter(controller);

    const publicApi: IIamModulePublicApi = {
      getUserById: async (id: string) => {
        const result = await getUserByIdQuery.execute({ id });
        return result.isSuccess ? result.getValue() : null;
      }
    };

    container.register('IIamModulePublicApi', publicApi);

    return { router, publicApi };
  }
}
