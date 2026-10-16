import { ConfigSetting } from '../entities/config.entity.js';

export interface IConfigRepository {
  getByKey(key: string): Promise<ConfigSetting | null>;
  getAll(): Promise<ConfigSetting[]>;
  save(setting: ConfigSetting): Promise<void>;
  delete(key: string): Promise<boolean>;
}
