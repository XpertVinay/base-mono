import { Router } from 'express';
import { PostgresConfigRepository } from './infrastructure/persistence/postgres-config.repository.js';
import { CachedConfigRepository } from './infrastructure/persistence/cached-config.repository.js';
import { ConfigCache } from './infrastructure/cache/config.cache.js';
import {
  GetConfigQuery,
  ListConfigsQuery,
  GetClientConfigsQuery,
  SetConfigUseCase,
  GetConfigCacheStatsQuery,
  InvalidateConfigCacheUseCase,
  GetSectionConfigQuery,
  UpdateSectionConfigUseCase,
  ListSectionsSummaryQuery
} from './application/use-cases/config.use-cases.js';
import { SectionConfigService } from './application/services/section-config.service.js';
import { piiCryptoService } from './infrastructure/security/pii-crypto.service.js';
import { ConfigController } from './presentation/http/config.controller.js';
import { createConfigRouter } from './presentation/http/config.routes.js';
import { container } from '../../bootstrap/container.js';
import { logger } from '../../shared/infrastructure/logger.js';
import {
  ConfigSection,
  TenantConfigDto,
  IamConfigDto,
  WhiteLabelConfigDto,
  AssetConfigDto,
  FinanceConfigDto,
  TransactionConfigDto,
  InventoryConfigDto,
  OrderConfigDto,
  PropertyConfigDto,
  SearchConfigDto,
  SchedulerConfigDto,
  SectionConfigMap
} from '@monolith/contracts';

export interface IConfigModulePublicApi {
  // Low-level key-value access
  get(key: string, defaultValue?: string): Promise<string>;
  getBoolean(key: string, defaultValue?: boolean): Promise<boolean>;
  getNumber(key: string, defaultValue?: number): Promise<number>;
  getJSON<T>(key: string, defaultValue?: T): Promise<T>;
  getCached(key: string): string | undefined;
  invalidate(key?: string): void;
  warmup(): Promise<void>;
  getClientConfigs(): Promise<Record<string, string>>;

  // Domain-specific modular configurations (inherited by dependent business modules)
  getTenantConfig(tenantId?: string): Promise<TenantConfigDto>;
  getIamConfig(tenantId?: string): Promise<IamConfigDto>;
  getWhiteLabelConfig(tenantId?: string): Promise<WhiteLabelConfigDto>;
  getAssetConfig(tenantId?: string): Promise<AssetConfigDto>;
  getFinanceConfig(tenantId?: string): Promise<FinanceConfigDto>;
  getTransactionConfig(tenantId?: string): Promise<TransactionConfigDto>;
  getInventoryConfig(tenantId?: string): Promise<InventoryConfigDto>;
  getOrderConfig(tenantId?: string): Promise<OrderConfigDto>;
  getPropertyConfig(tenantId?: string): Promise<PropertyConfigDto>;
  getSearchConfig(tenantId?: string): Promise<SearchConfigDto>;
  getSchedulerConfig(tenantId?: string): Promise<SchedulerConfigDto>;
  getSectionConfig<K extends ConfigSection>(section: K, tenantId?: string): Promise<SectionConfigMap[K]>;

  // PII cryptographic context service for safe on-the-fly transmission and data at rest
  createEncryptedTenantContext(payload: { tenantId: string; userId?: string; email?: string; orgId?: string; roles?: string[]; ttlMs?: number }): string;
  decryptTenantContext(token: string): any;
}

export class ConfigModule {
  public static init(): { router: Router; publicApi: IConfigModulePublicApi } {
    const persistentRepo = new PostgresConfigRepository();
    const configCache = new ConfigCache();
    const repository = new CachedConfigRepository(persistentRepo, configCache);
    const sectionService = new SectionConfigService(repository);

    // Asynchronously pre-warm the BE configuration cache
    repository.warmup().catch(err => {
      logger.warn('Initial config cache warmup encountered error:', { error: err?.message });
    });

    const getConfigQuery = new GetConfigQuery(repository);
    const listConfigsQuery = new ListConfigsQuery(repository);
    const getClientConfigsQuery = new GetClientConfigsQuery(repository);
    const setConfigUseCase = new SetConfigUseCase(repository);
    const getCacheStatsQuery = new GetConfigCacheStatsQuery(repository);
    const invalidateCacheUseCase = new InvalidateConfigCacheUseCase(repository);
    const getSectionConfigQuery = new GetSectionConfigQuery(sectionService);
    const updateSectionConfigUseCase = new UpdateSectionConfigUseCase(sectionService);
    const listSectionsSummaryQuery = new ListSectionsSummaryQuery(sectionService);

    const controller = new ConfigController(
      getConfigQuery,
      listConfigsQuery,
      getClientConfigsQuery,
      setConfigUseCase,
      getCacheStatsQuery,
      invalidateCacheUseCase,
      getSectionConfigQuery,
      updateSectionConfigUseCase,
      listSectionsSummaryQuery
    );
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
      },
      getNumber: async (key: string, defaultValue = 0) => {
        const res = await getConfigQuery.execute({ key });
        if (!res.isSuccess || !res.getValue()) return defaultValue;
        const parsed = Number(res.getValue()!.value);
        return isNaN(parsed) ? defaultValue : parsed;
      },
      getJSON: async <T>(key: string, defaultValue?: T): Promise<T> => {
        const res = await getConfigQuery.execute({ key });
        if (!res.isSuccess || !res.getValue()) return defaultValue as T;
        try {
          return JSON.parse(res.getValue()!.value) as T;
        } catch {
          return defaultValue as T;
        }
      },
      getCached: (key: string) => {
        const item = repository.getCache().get(key);
        return item ? item.value : undefined;
      },
      invalidate: (key?: string) => {
        repository.invalidate(key);
      },
      warmup: async () => {
        await repository.warmup();
      },
      getClientConfigs: async () => {
        const res = await getClientConfigsQuery.execute();
        return res.isSuccess ? res.getValue() : {};
      },

      // Typed Section getters for dependent modules
      getTenantConfig: (tenantId?: string) => sectionService.getTenantConfig(tenantId),
      getIamConfig: (tenantId?: string) => sectionService.getIamConfig(tenantId),
      getWhiteLabelConfig: (tenantId?: string) => sectionService.getWhiteLabelConfig(tenantId),
      getAssetConfig: (tenantId?: string) => sectionService.getAssetConfig(tenantId),
      getFinanceConfig: (tenantId?: string) => sectionService.getFinanceConfig(tenantId),
      getTransactionConfig: (tenantId?: string) => sectionService.getTransactionConfig(tenantId),
      getInventoryConfig: (tenantId?: string) => sectionService.getInventoryConfig(tenantId),
      getOrderConfig: (tenantId?: string) => sectionService.getOrderConfig(tenantId),
      getPropertyConfig: (tenantId?: string) => sectionService.getPropertyConfig(tenantId),
      getSearchConfig: (tenantId?: string) => sectionService.getSearchConfig(tenantId),
      getSchedulerConfig: (tenantId?: string) => sectionService.getSchedulerConfig(tenantId),
      getSectionConfig: <K extends ConfigSection>(section: K, tenantId?: string) =>
        sectionService.getSection(section, tenantId),

      createEncryptedTenantContext: (payload) => piiCryptoService.encryptPiiContext(payload),
      decryptTenantContext: (token: string) => piiCryptoService.decryptPiiContext(token)
    };

    container.register('IConfigModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
