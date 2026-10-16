import { IAuditRepository, AuditQueryFilter } from '../../domain/repositories/audit-repository.interface.js';
import { AuditLog, AuditSeverity } from '../../domain/entities/audit-log.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresAuditRepository implements IAuditRepository {
  async save(log: AuditLog): Promise<void> {
    await dbPool.query(
      `INSERT INTO audit.audit_logs (
        id, actor_id, actor_email, action, resource, resource_id, severity, details, ip_address, correlation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        log.id,
        log.actorId || null,
        log.actorEmail || null,
        log.action,
        log.resource,
        log.resourceId || null,
        log.severity,
        JSON.stringify(log.details || {}),
        log.ipAddress || null,
        log.correlationId || null,
        log.createdAt
      ]
    );
  }

  async findById(id: string): Promise<AuditLog | null> {
    const res = await dbPool.query(
      `SELECT id, actor_id, actor_email, action, resource, resource_id, severity, details, ip_address, correlation_id, created_at
       FROM audit.audit_logs WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async query(filter: AuditQueryFilter): Promise<AuditLog[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.actorId) {
      params.push(filter.actorId);
      conditions.push(`actor_id = $${params.length}`);
    }

    if (filter.resource) {
      params.push(filter.resource);
      conditions.push(`resource = $${params.length}`);
    }

    if (filter.action) {
      params.push(filter.action);
      conditions.push(`action = $${params.length}`);
    }

    if (filter.severity) {
      params.push(filter.severity);
      conditions.push(`severity = $${params.length}`);
    }

    let sql = `SELECT id, actor_id, actor_email, action, resource, resource_id, severity, details, ip_address, correlation_id, created_at
               FROM audit.audit_logs`;

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const limit = filter.limit ? Math.min(filter.limit, 100) : 50;
    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const res = await dbPool.query(sql, params);
    return res.rows.map(row => this.mapToDomain(row));
  }

  private mapToDomain(row: any): AuditLog {
    return AuditLog.reconstitute(
      {
        actorId: row.actor_id,
        actorEmail: row.actor_email,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        severity: row.severity as AuditSeverity,
        details: row.details,
        ipAddress: row.ip_address,
        correlationId: row.correlation_id,
        createdAt: new Date(row.created_at)
      },
      row.id
    );
  }
}
