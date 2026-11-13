import { ConfigSetting } from '../entities/config.entity.js';

export interface IConfigRepository {
  getByKey(key: string, tenantId?: string): Promise<ConfigSetting | null>;
  getAll(tenantId?: string): Promise<ConfigSetting[]>;
  save(setting: ConfigSetting): Promise<void>;
  delete(key: string, tenantId?: string): Promise<boolean>;
}
