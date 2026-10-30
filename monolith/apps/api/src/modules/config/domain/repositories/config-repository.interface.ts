import { AppConfig, ConfigTarget } from '../entities/config.entity.js';

export interface IConfigRepository {
  findByKey(key: string, tenantId?: string): Promise<AppConfig | null>;
  findAll(): Promise<AppConfig[]>;
  findByTarget(target: ConfigTarget): Promise<AppConfig[]>;
  save(config: AppConfig, tenantId?: string): Promise<void>;
  findTenantSection(tenantId: string, section: string): Promise<Record<string, any> | null>;
  saveTenantSection(tenantId: string, section: string, data: Record<string, any>, isEncrypted?: boolean): Promise<void>;
  findAllTenantSections(tenantId: string): Promise<Record<string, Record<string, any>>>;
}
