import { ISsoSessionRepository } from '../../domain/repositories/sso-session-repository.interface.js';
import { SsoSession } from '../../domain/entities/sso-session.entity.js';
import { ISsoHandoffRepository } from '../../domain/repositories/sso-handoff-repository.interface.js';
import { SsoHandoffCode } from '../../domain/entities/sso-handoff-code.entity.js';

export class InMemorySsoSessionRepository implements ISsoSessionRepository {
  private readonly items = new Map<string, SsoSession>();

  async save(session: SsoSession): Promise<void> {
    this.items.set(session.id, session);
  }

  async findById(sid: string): Promise<SsoSession | null> {
    return this.items.get(sid) || null;
  }

  async update(session: SsoSession): Promise<void> {
    this.items.set(session.id, session);
  }

  async revokeById(sid: string, reason = 'User initiated logout'): Promise<boolean> {
    const session = this.items.get(sid);
    if (!session || session.revokedAt) return false;
    session.revoke(reason);
    return true;
  }

  async revokeByUser(userId: string, tenantId: string, reason = 'User initiated global logout'): Promise<number> {
    let count = 0;
    for (const s of this.items.values()) {
      if (s.userId === userId && s.tenantId === tenantId && !s.revokedAt) {
        s.revoke(reason);
        count++;
      }
    }
    return count;
  }

  async revokeByFederatedSubject(
    tenantId: string,
    providerId: string,
    subject: string,
    reason = 'IdP back-channel logout'
  ): Promise<number> {
    let count = 0;
    for (const s of this.items.values()) {
      if (
        s.tenantId === tenantId &&
        s.providerId === providerId &&
        s.federatedSub === subject &&
        !s.revokedAt
      ) {
        s.revoke(reason);
        count++;
      }
    }
    return count;
  }

  async isRevoked(sid: string): Promise<boolean> {
    const session = this.items.get(sid);
    if (!session) return false;
    return !session.isActive();
  }

  async listActiveByUser(userId: string, tenantId: string): Promise<SsoSession[]> {
    return Array.from(this.items.values()).filter(
      (s) => s.userId === userId && s.tenantId === tenantId && s.isActive()
    );
  }
}

export class InMemorySsoHandoffRepository implements ISsoHandoffRepository {
  private readonly items = new Map<string, SsoHandoffCode>();

  async save(handoff: SsoHandoffCode): Promise<void> {
    this.items.set(handoff.code, handoff);
  }

  async consume(code: string): Promise<SsoHandoffCode | null> {
    const item = this.items.get(code);
    if (!item || item.consumedAt) return null;
    item.consumedAt = new Date();
    return item;
  }

  async pruneExpired(): Promise<number> {
    const now = Date.now();
    let count = 0;
    for (const [k, v] of this.items.entries()) {
      if (v.expiresAt.getTime() < now) {
        this.items.delete(k);
        count++;
      }
    }
    return count;
  }
}

