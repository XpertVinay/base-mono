import { v4 as uuidv4 } from 'uuid';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface IamAuditLogEntry {
  id: string;
  userId?: string | null;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, any>;
  status: 'SUCCESS' | 'FAILURE';
  createdAt: Date;
}

export interface IIamAuditRepository {
  log(entry: Omit<IamAuditLogEntry, 'id' | 'createdAt'>): Promise<IamAuditLogEntry>;
  findRecent(filters?: { userId?: string; eventType?: string; status?: 'SUCCESS' | 'FAILURE'; limit?: number; offset?: number }): Promise<IamAuditLogEntry[]>;
}

export class PostgresIamAuditRepository implements IIamAuditRepository {
  private fallbackLogs: IamAuditLogEntry[] = [];
  private maxFallbackLogs = 1000;

  async log(entry: Omit<IamAuditLogEntry, 'id' | 'createdAt'>): Promise<IamAuditLogEntry> {
    const fullEntry: IamAuditLogEntry = {
      id: uuidv4(),
      userId: entry.userId || null,
      eventType: entry.eventType,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      details: entry.details || {},
      status: entry.status,
      createdAt: new Date()
    };

    // Keep in in-memory fallback list
    this.fallbackLogs.unshift(fullEntry);
    if (this.fallbackLogs.length > this.maxFallbackLogs) {
      this.fallbackLogs.pop();
    }

    // Always emit structured audit log
    logger.info(`[IAM AUDIT] ${fullEntry.eventType} - ${fullEntry.status}`, {
      auditId: fullEntry.id,
      userId: fullEntry.userId || undefined,
      eventType: fullEntry.eventType,
      status: fullEntry.status,
      ip: fullEntry.ipAddress,
      details: fullEntry.details
    });

    try {
      await dbPool.query(
        `INSERT INTO iam.audit_logs (id, user_id, event_type, ip_address, user_agent, details, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          fullEntry.id,
          fullEntry.userId,
          fullEntry.eventType,
          fullEntry.ipAddress,
          fullEntry.userAgent,
          JSON.stringify(fullEntry.details),
          fullEntry.status,
          fullEntry.createdAt
        ]
      );
    } catch (err) {
      logger.warn('Failed to insert audit log into PostgreSQL, persisted in fallback memory', {
        auditId: fullEntry.id,
        eventType: fullEntry.eventType
      });
    }

    return fullEntry;
  }

  async findRecent(filters?: {
    userId?: string;
    eventType?: string;
    status?: 'SUCCESS' | 'FAILURE';
    limit?: number;
    offset?: number;
  }): Promise<IamAuditLogEntry[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (filters?.userId) {
        conditions.push(`user_id = $${idx++}`);
        params.push(filters.userId);
      }
      if (filters?.eventType) {
        conditions.push(`event_type = $${idx++}`);
        params.push(filters.eventType);
      }
      if (filters?.status) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit);
      const limitParamIdx = idx++;
      params.push(offset);
      const offsetParamIdx = idx++;

      const res = await dbPool.query(
        `SELECT id, user_id, event_type, ip_address, user_agent, details, status, created_at
         FROM iam.audit_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
        params
      );

      if (res.rows.length === 0 && this.fallbackLogs.length > 0) {
        return this.filterFallback(filters, limit, offset);
      }

      return res.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        eventType: r.event_type,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
        status: r.status,
        createdAt: new Date(r.created_at)
      }));
    } catch (err) {
      logger.warn('Database query failed in PostgresIamAuditRepository.findRecent, using fallback logs');
      return this.filterFallback(filters, limit, offset);
    }
  }

  private filterFallback(
    filters?: { userId?: string; eventType?: string; status?: 'SUCCESS' | 'FAILURE' },
    limit = 50,
    offset = 0
  ): IamAuditLogEntry[] {
    let list = this.fallbackLogs;
    if (filters?.userId) {
      list = list.filter(l => l.userId === filters.userId);
    }
    if (filters?.eventType) {
      list = list.filter(l => l.eventType === filters.eventType);
    }
    if (filters?.status) {
      list = list.filter(l => l.status === filters.status);
    }
    return list.slice(offset, offset + limit);
  }
}
