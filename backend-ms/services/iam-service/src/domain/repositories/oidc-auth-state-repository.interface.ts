import { OidcAuthState } from '../entities/oidc-auth-state.entity.js';

export interface IOidcAuthStateRepository {
  save(state: OidcAuthState): Promise<void>;
  consume(stateValue: string): Promise<OidcAuthState | null>;
  pruneExpired(): Promise<number>;
}

