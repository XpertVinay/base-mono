import { AppConfig } from '../entities/config.entity.js';

export interface IConfigRepository {
  findByKey(key: string): Promise<AppConfig | null>;
  findAll(): Promise<AppConfig[]>;
  save(config: AppConfig): Promise<void>;
}
