import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { ConfigSetting } from '../../domain/entities/config.entity.js';
import { ConfigDto } from '../../shared/contracts/index.js';

export interface GetConfigInput {
  key: string;
  defaultValue?: string;
}

export class GetConfigQuery implements UseCase<GetConfigInput, ConfigDto> {
  constructor(private readonly repo: IConfigRepository) {}

  async execute(input: GetConfigInput): Promise<Result<ConfigDto>> {
    const setting = await this.repo.getByKey(input.key);
    if (!setting) {
      if (input.defaultValue !== undefined) {
        return Result.ok({
          key: input.key,
          value: input.defaultValue,
          isEncrypted: false,
          updatedAt: new Date().toISOString()
        });
      }
      return Result.fail(`Configuration key '${input.key}' not found`);
    }

    return Result.ok({
      key: setting.key,
      value: setting.value,
      description: setting.description,
      isEncrypted: setting.isEncrypted,
      updatedAt: setting.updatedAt.toISOString()
    });
  }
}

export interface SetConfigInput {
  key: string;
  value: string;
  description?: string;
  isEncrypted?: boolean;
}

export class SetConfigUseCase implements UseCase<SetConfigInput, ConfigDto> {
  constructor(private readonly repo: IConfigRepository) {}

  async execute(input: SetConfigInput): Promise<Result<ConfigDto>> {
    const setting = ConfigSetting.create(input.key, {
      value: input.value,
      description: input.description,
      isEncrypted: !!input.isEncrypted
    });

    await this.repo.save(setting);

    return Result.ok({
      key: setting.key,
      value: setting.value,
      description: setting.description,
      isEncrypted: setting.isEncrypted,
      updatedAt: setting.updatedAt.toISOString()
    });
  }
}

export class ListConfigsQuery implements UseCase<void, ConfigDto[]> {
  constructor(private readonly repo: IConfigRepository) {}

  async execute(): Promise<Result<ConfigDto[]>> {
    const settings = await this.repo.getAll();
    return Result.ok(
      settings.map(s => ({
        key: s.key,
        value: s.value,
        description: s.description,
        isEncrypted: s.isEncrypted,
        updatedAt: s.updatedAt.toISOString()
      }))
    );
  }
}

export class DeleteConfigUseCase implements UseCase<{ key: string }, boolean> {
  constructor(private readonly repo: IConfigRepository) {}

  async execute(input: { key: string }): Promise<Result<boolean>> {
    const deleted = await this.repo.delete(input.key);
    if (!deleted) {
      return Result.fail('Configuration setting not found');
    }
    return Result.ok(true);
  }
}
