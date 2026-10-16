import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { AppConfig } from '../../domain/entities/config.entity.js';
import { AppConfigDto, SetConfigRequestDto } from '@monolith/contracts';

export class GetConfigQuery implements IQuery<{ key: string }, AppConfigDto | null> {
  constructor(private readonly configRepository: IConfigRepository) {}

  async execute({ key }: { key: string }): Promise<Result<AppConfigDto | null, Error>> {
    try {
      const cfg = await this.configRepository.findByKey(key);
      if (!cfg) return Result.ok(null);

      return Result.ok({
        key: cfg.key,
        value: cfg.value,
        description: cfg.description,
        isEncrypted: cfg.isEncrypted,
        updatedAt: cfg.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListConfigsQuery implements IQuery<void, AppConfigDto[]> {
  constructor(private readonly configRepository: IConfigRepository) {}

  async execute(): Promise<Result<AppConfigDto[], Error>> {
    try {
      const configs = await this.configRepository.findAll();
      return Result.ok(configs.map(cfg => ({
        key: cfg.key,
        value: cfg.isEncrypted ? '********' : cfg.value,
        description: cfg.description,
        isEncrypted: cfg.isEncrypted,
        updatedAt: cfg.updatedAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class SetConfigUseCase implements IUseCase<SetConfigRequestDto, AppConfigDto> {
  constructor(private readonly configRepository: IConfigRepository) {}

  async execute(input: SetConfigRequestDto): Promise<Result<AppConfigDto, Error>> {
    try {
      const config = AppConfig.create(input.key, input.value, input.description, input.isEncrypted);
      await this.configRepository.save(config);

      return Result.ok({
        key: config.key,
        value: config.value,
        description: config.description,
        isEncrypted: config.isEncrypted,
        updatedAt: config.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
