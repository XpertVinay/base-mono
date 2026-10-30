import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { AppConfig, ConfigTarget } from '../../domain/entities/config.entity.js';
import { AppConfigDto, SetConfigRequestDto, ClientConfigMapDto, ConfigSection } from '@monolith/contracts';
import { CachedConfigRepository } from '../../infrastructure/persistence/cached-config.repository.js';
import { SectionConfigService } from '../services/section-config.service.js';

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
        target: cfg.target,
        updatedAt: cfg.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListConfigsQuery implements IQuery<{ target?: ConfigTarget } | void, AppConfigDto[]> {
  constructor(private readonly configRepository: IConfigRepository) {}

  async execute(input?: { target?: ConfigTarget }): Promise<Result<AppConfigDto[], Error>> {
    try {
      let configs: AppConfig[];
      if (input && input.target) {
        configs = await this.configRepository.findByTarget(input.target);
      } else {
        configs = await this.configRepository.findAll();
      }

      return Result.ok(configs.map(cfg => ({
        key: cfg.key,
        value: cfg.isEncrypted ? '********' : cfg.value,
        description: cfg.description,
        isEncrypted: cfg.isEncrypted,
        target: cfg.target,
        updatedAt: cfg.updatedAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetClientConfigsQuery implements IQuery<void, ClientConfigMapDto> {
  constructor(private readonly configRepository: IConfigRepository) {}

  async execute(): Promise<Result<ClientConfigMapDto, Error>> {
    try {
      const configs = await this.configRepository.findAll();
      const clientMap: ClientConfigMapDto = {};

      for (const cfg of configs) {
        if (cfg.isClientAccessible()) {
          const k = cfg.key.toUpperCase();
          // Never expose private keys, secrets, or internal credential parameters to clients
          if (
            k.includes('PRIVATE') ||
            k.includes('SECRET') ||
            k.includes('PASSWORD') ||
            k.includes('TOKEN') ||
            k.includes('INTERNAL')
          ) {
            continue;
          }
          clientMap[cfg.key] = cfg.value;
        }
      }

      return Result.ok(clientMap);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}


export class SetConfigUseCase implements IUseCase<SetConfigRequestDto, AppConfigDto> {
  constructor(private readonly configRepository: IConfigRepository) {}

  async execute(input: SetConfigRequestDto): Promise<Result<AppConfigDto, Error>> {
    try {
      const config = AppConfig.create(
        input.key,
        input.value,
        input.description,
        input.isEncrypted ?? false,
        input.target ?? 'ALL'
      );
      await this.configRepository.save(config);

      return Result.ok({
        key: config.key,
        value: config.value,
        description: config.description,
        isEncrypted: config.isEncrypted,
        target: config.target,
        updatedAt: config.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetConfigCacheStatsQuery implements IQuery<void, any> {
  constructor(private readonly cachedRepo?: CachedConfigRepository) {}

  async execute(): Promise<Result<any, Error>> {
    try {
      if (!this.cachedRepo) {
        return Result.ok({ enabled: false, message: 'Cache not attached' });
      }
      const stats = this.cachedRepo.getCache().getStats();
      return Result.ok({ enabled: true, ...stats });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class InvalidateConfigCacheUseCase implements IUseCase<{ key?: string }, { success: boolean; invalidatedKey?: string }> {
  constructor(private readonly cachedRepo?: CachedConfigRepository) {}

  async execute(input: { key?: string }): Promise<Result<{ success: boolean; invalidatedKey?: string }, Error>> {
    try {
      if (this.cachedRepo) {
        this.cachedRepo.invalidate(input.key);
      }
      return Result.ok({ success: true, invalidatedKey: input.key ?? 'ALL' });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

// Modular Section Use Cases
export class GetSectionConfigQuery implements IQuery<{ section: ConfigSection; tenantId?: string }, any> {
  constructor(private readonly sectionService: SectionConfigService) {}

  async execute(input: { section: ConfigSection; tenantId?: string }): Promise<Result<any, Error>> {
    try {
      const sectionConfig = await this.sectionService.getSanitizedSection(input.section, input.tenantId);
      return Result.ok(sectionConfig);
    } catch (err: any) {
      return Result.fail(err);
    }
  }

}

export class UpdateSectionConfigUseCase implements IUseCase<{ section: ConfigSection; payload: any; tenantId?: string }, any> {
  constructor(private readonly sectionService: SectionConfigService) {}

  async execute(input: { section: ConfigSection; payload: any; tenantId?: string }): Promise<Result<any, Error>> {
    try {
      const updated = await this.sectionService.updateSection(input.section, input.payload, input.tenantId);
      return Result.ok(updated);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListSectionsSummaryQuery implements IQuery<{ tenantId?: string } | void, Record<ConfigSection, any>> {
  constructor(private readonly sectionService: SectionConfigService) {}

  async execute(input?: { tenantId?: string }): Promise<Result<Record<ConfigSection, any>, Error>> {
    try {
      const summary = await this.sectionService.getAllSectionsSummary(input?.tenantId);
      return Result.ok(summary);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
