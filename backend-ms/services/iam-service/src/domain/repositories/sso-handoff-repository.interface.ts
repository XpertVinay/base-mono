import { SsoHandoffCode } from '../entities/sso-handoff-code.entity.js';

export interface ISsoHandoffRepository {
  save(handoff: SsoHandoffCode): Promise<void>;
  consume(code: string): Promise<SsoHandoffCode | null>;
  pruneExpired(): Promise<number>;
}

