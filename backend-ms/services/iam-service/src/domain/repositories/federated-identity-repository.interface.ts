import { FederatedIdentity } from '../entities/federated-identity.entity.js';

export interface IFederatedIdentityRepository {
  findById(id: string): Promise<FederatedIdentity | null>;
  findBySubject(tenantId: string, providerId: string, subject: string): Promise<FederatedIdentity | null>;
  findByUserId(userId: string, tenantId?: string): Promise<FederatedIdentity[]>;
  save(identity: FederatedIdentity): Promise<void>;
  update(identity: FederatedIdentity): Promise<void>;
  deleteById(id: string, userId: string, tenantId: string): Promise<boolean>;
}

