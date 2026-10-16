import { Router } from 'express';
import { PostgresConfigRepository } from './infrastructure/persistence/postgres-config.repository.js';
import { GetConfigQuery, ListConfigsQuery, SetConfigUseCase } from './application/use-cases/config.use-cases.js';
import { ConfigController } from './presentation/http/config.controller.js';
import { createConfigRouter } from './presentation/http/config.routes.js';
import { container } from '../../bootstrap/container.js';

export interface IConfigModulePublicApi {
  get(key: string, defaultValue?: string): Promise<string>;
  getBoolean(key: string, defaultValue?: boolean): Promise<boolean>;
}

export class ConfigModule {
  public static init(): { router: Router; publicApi: IConfigModulePublicApi } {
    const repository = new PostgresConfigRepository();
    const getConfigQuery = new GetConfigQuery(repository);
    const listConfigsQuery = new ListConfigsQuery(repository);
    const setConfigUseCase = new SetConfigUseCase(repository);

    const controller = new ConfigController(getConfigQuery, listConfigsQuery, setConfigUseCase);
    const router = createConfigRouter(controller);

    const publicApi: IConfigModulePublicApi = {
      get: async (key: string, defaultValue = '') => {
        const res = await getConfigQuery.execute({ key });
        return (res.isSuccess && res.getValue()?.value) || defaultValue;
      },
      getBoolean: async (key: string, defaultValue = false) => {
        const res = await getConfigQuery.execute({ key });
        if (!res.isSuccess || !res.getValue()) return defaultValue;
        return res.getValue()!.value.toLowerCase() === 'true';
      }
    };

    container.register('IConfigModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
