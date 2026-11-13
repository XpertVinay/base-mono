import { SsoSession } from '../entities/sso-session.entity.js';

export interface ISsoSessionRepository {
  save(session: SsoSession): Promise<void>;
  findById(sid: string): Promise<SsoSession | null>;
  update(session: SsoSession): Promise<void>;
  revokeById(sid: string, reason?: string): Promise<boolean>;
  revokeByUser(userId: string, tenantId: string, reason?: string): Promise<number>;
  revokeByFederatedSubject(
    tenantId: string,
    providerId: string,
    subject: string,
    reason?: string
  ): Promise<number>;
  isRevoked(sid: string): Promise<boolean>;
  listActiveByUser(userId: string, tenantId: string): Promise<SsoSession[]>;
}

