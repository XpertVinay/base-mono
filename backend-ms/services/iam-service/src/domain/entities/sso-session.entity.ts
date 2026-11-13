import crypto from 'crypto';
import { Entity } from '../../shared/domain/entity.js';
import { AuthMethod } from './user.entity.js';

export interface SsoSessionProps {
  tenantId: string;
  tenantSlug?: string;
  userId: string;
  authMethod: AuthMethod;
  providerId?: string;
  providerSlug?: string;
  federatedSub?: string;
  idTokenHintEncrypted?: string;
  refreshTokenJti: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  lastActivityAt: Date;
  createdAt?: Date;
}

export class SsoSession extends Entity<SsoSessionProps> {
  private constructor(props: SsoSessionProps, id?: string) {
    super(props, id);
  }

  public static create(
    props: Omit<SsoSessionProps, 'refreshTokenJti' | 'lastActivityAt' | 'createdAt'> & {
      refreshTokenJti?: string;
    },
    id?: string
  ): SsoSession {
    return new SsoSession(
      {
        ...props,
        refreshTokenJti: props.refreshTokenJti || crypto.randomUUID(),
        lastActivityAt: new Date(),
        createdAt: new Date()
      },
      id || `sid_${crypto.randomUUID()}`
    );
  }

  public static reconstitute(props: SsoSessionProps, id: string): SsoSession {
    return new SsoSession(props, id);
  }

  get tenantId(): string { return this.props.tenantId; }
  get tenantSlug(): string | undefined { return this.props.tenantSlug; }
  get userId(): string { return this.props.userId; }
  get authMethod(): AuthMethod { return this.props.authMethod; }
  get providerId(): string | undefined { return this.props.providerId; }
  get providerSlug(): string | undefined { return this.props.providerSlug; }
  get federatedSub(): string | undefined { return this.props.federatedSub; }
  get idTokenHintEncrypted(): string | undefined { return this.props.idTokenHintEncrypted; }
  get refreshTokenJti(): string { return this.props.refreshTokenJti; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get revokedAt(): Date | undefined { return this.props.revokedAt; }
  get revokedReason(): string | undefined { return this.props.revokedReason; }
  get lastActivityAt(): Date { return this.props.lastActivityAt; }
  get createdAt(): Date { return this.props.createdAt!; }

  public isActive(): boolean {
    if (this.props.revokedAt) return false;
    return this.props.expiresAt.getTime() > Date.now();
  }

  public rotateRefreshToken(newJti: string): void {
    this.props.refreshTokenJti = newJti;
    this.props.lastActivityAt = new Date();
  }

  public revoke(reason: string = 'User initiated logout'): void {
    if (!this.props.revokedAt) {
      this.props.revokedAt = new Date();
      this.props.revokedReason = reason;
    }
  }
}

