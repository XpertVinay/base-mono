import { AuditLog } from '../entities/audit-log.entity.js';

export interface AuditQueryFilter {
  actorId?: string;
  resource?: string;
  action?: string;
  severity?: string;
  limit?: number;
}

export interface IAuditRepository {
  save(log: AuditLog): Promise<void>;
  findById(id: string): Promise<AuditLog | null>;
  query(filter: AuditQueryFilter): Promise<AuditLog[]>;
}
