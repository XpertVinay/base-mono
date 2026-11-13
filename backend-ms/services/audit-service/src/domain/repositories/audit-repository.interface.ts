import { AuditLog } from '../entities/audit-log.entity.js';

export interface AuditQueryFilter {
  actorId?: string;
  resource?: string;
  action?: string;
  severity?: string;
  limit?: number;
  tenantId?: string;
}

export interface IAuditRepository {
  save(log: AuditLog): Promise<void>;
  findById(id: string, tenantId?: string): Promise<AuditLog | null>;
  query(filter: AuditQueryFilter): Promise<AuditLog[]>;
}
