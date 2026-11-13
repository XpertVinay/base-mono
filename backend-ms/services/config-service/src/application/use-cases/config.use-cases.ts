import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { ConfigSetting } from '../../domain/entities/config.entity.js';
import { ConfigDto } from '../../shared/contracts/index.js';
import { CryptoService } from '../../shared/infrastructure/crypto.service.js';

export interface GetConfigInput {
  key: string;
  tenantId?: string;
  defaultValue?: string;
  decrypt?: boolean;
}

export class GetConfigQuery implements UseCase<GetConfigInput, ConfigDto> {
  constructor(private readonly repo: IConfigRepository) {}

  async execute(input: GetConfigInput): Promise<Result<ConfigDto>> {
    const setting = await this.repo.getByKey(input.key, input.tenantId);
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

    let val = setting.value;
    if (setting.isEncrypted) {
      if (input.decrypt) {
        try {
          val = CryptoService.decrypt(setting.value);
        } catch {
          // If not in encrypted v1 format, return as is
        }
      } else {
        val = '********';
      }
    }

    return Result.ok({
      key: setting.key,
      value: val,
      description: setting.description,
      isEncrypted: setting.isEncrypted,
      updatedAt: setting.updatedAt.toISOString()
    });
  }
}

export interface SetConfigInput {
  key: string;
  value: string;
  tenantId?: string;
  description?: string;
  isEncrypted?: boolean;
}

export class SetConfigUseCase implements UseCase<SetConfigInput, ConfigDto> {
  constructor(private readonly repo: IConfigRepository) {}

  async execute(input: SetConfigInput): Promise<Result<ConfigDto>> {
    const isEncrypted = Boolean(input.isEncrypted);
    const storedValue = isEncrypted ? CryptoService.encrypt(input.value) : input.value;

    const setting = ConfigSetting.create(input.key, {
      tenantId: input.tenantId || 'default',
      value: storedValue,
      description: input.description,
      isEncrypted
    });

    await this.repo.save(setting);

    return Result.ok({
      key: setting.key,
      value: isEncrypted ? '********' : setting.value,
      description: setting.description,
      isEncrypted: setting.isEncrypted,
      updatedAt: setting.updatedAt.toISOString()
    });
  }
}

export class ListConfigsQuery implements UseCase<{ tenantId?: string }, ConfigDto[]> {
  constructor(private readonly repo: IConfigRepository) {}

  async execute(input?: { tenantId?: string }): Promise<Result<ConfigDto[]>> {
    const settings = await this.repo.getAll(input?.tenantId);
    return Result.ok(
      settings.map(s => ({
        key: s.key,
        value: s.isEncrypted ? '********' : s.value,
        description: s.description,
        isEncrypted: s.isEncrypted,
        updatedAt: s.updatedAt.toISOString()
      }))
    );
  }
}

export class DeleteConfigUseCase implements UseCase<{ key: string; tenantId?: string }, boolean> {
  constructor(private readonly repo: IConfigRepository) {}

  async execute(input: { key: string; tenantId?: string }): Promise<Result<boolean>> {
    const deleted = await this.repo.delete(input.key, input.tenantId);
    if (!deleted) {
      return Result.fail('Configuration setting not found');
    }
    return Result.ok(true);
  }
}
