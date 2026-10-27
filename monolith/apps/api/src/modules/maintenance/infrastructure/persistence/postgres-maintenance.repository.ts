import { IMaintenanceRepository } from '../../domain/repositories/maintenance-repository.interface.js';
import { MaintenanceRequest } from '../../domain/entities/maintenance-request.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresMaintenanceRepository implements IMaintenanceRepository {
  private fallbackStore: Map<string, MaintenanceRequest> = new Map();

  async save(request: MaintenanceRequest): Promise<void> {
    this.fallbackStore.set(request.id, request);
    try {
      await dbPool.query(
        `INSERT INTO maintenance.requests (
          id, property_id, reporter_id, reporter_role, category, priority, status,
          title, description, photo_urls, sla, is_emergency_float_covered,
          emergency_amount_drawn, quotations, selected_quotation, proof_of_work,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO UPDATE SET
          priority = EXCLUDED.priority,
          status = EXCLUDED.status,
          quotations = EXCLUDED.quotations,
          selected_quotation = EXCLUDED.selected_quotation,
          proof_of_work = EXCLUDED.proof_of_work,
          updated_at = EXCLUDED.updated_at`,
        [
          request.id,
          request.propertyId,
          request.reporterId,
          request.reporterRole,
          request.category,
          request.priority,
          request.status,
          request.title,
          request.description,
          JSON.stringify(request.photoUrls),
          JSON.stringify(request.sla),
          request.isEmergencyFloatCovered,
          request.emergencyAmountDrawn,
          JSON.stringify(request.quotations),
          request.selectedQuotation ? JSON.stringify(request.selectedQuotation) : null,
          request.proofOfWork ? JSON.stringify(request.proofOfWork) : null,
          request.createdAt,
          request.updatedAt
        ]
      );
    } catch {
      logger.warn('Database save failed in PostgresMaintenanceRepository, using fallback store', { requestId: request.id });
    }
  }

  async update(request: MaintenanceRequest): Promise<void> {
    await this.save(request);
  }

  async findById(id: string): Promise<MaintenanceRequest | null> {
    try {
      const res = await dbPool.query('SELECT * FROM maintenance.requests WHERE id = $1', [id]);
      if (res.rows.length === 0) return this.fallbackStore.get(id) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByPropertyId(propertyId: string): Promise<MaintenanceRequest[]> {
    try {
      const res = await dbPool.query('SELECT * FROM maintenance.requests WHERE property_id = $1 ORDER BY created_at DESC', [propertyId]);
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(r => r.propertyId === propertyId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(r => r.propertyId === propertyId);
    }
  }

  async findByReporterId(reporterId: string): Promise<MaintenanceRequest[]> {
    try {
      const res = await dbPool.query('SELECT * FROM maintenance.requests WHERE reporter_id = $1 ORDER BY created_at DESC', [reporterId]);
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(r => r.reporterId === reporterId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(r => r.reporterId === reporterId);
    }
  }

  async findAll(): Promise<MaintenanceRequest[]> {
    try {
      const res = await dbPool.query('SELECT * FROM maintenance.requests ORDER BY created_at DESC');
      if (res.rows.length === 0) return Array.from(this.fallbackStore.values());
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values());
    }
  }

  private mapToDomain(row: any): MaintenanceRequest {
    const photoUrls = typeof row.photo_urls === 'string' ? JSON.parse(row.photo_urls) : (row.photo_urls || []);
    const sla = typeof row.sla === 'string' ? JSON.parse(row.sla) : row.sla;
    const quotations = typeof row.quotations === 'string' ? JSON.parse(row.quotations) : (row.quotations || []);
    const selectedQuotation = row.selected_quotation
      ? (typeof row.selected_quotation === 'string' ? JSON.parse(row.selected_quotation) : row.selected_quotation)
      : null;
    const proofOfWork = row.proof_of_work
      ? (typeof row.proof_of_work === 'string' ? JSON.parse(row.proof_of_work) : row.proof_of_work)
      : null;

    return MaintenanceRequest.reconstruct({
      id: row.id,
      propertyId: row.property_id,
      reporterId: row.reporter_id,
      reporterRole: row.reporter_role,
      category: row.category,
      priority: row.priority,
      status: row.status,
      title: row.title,
      description: row.description,
      photoUrls,
      sla,
      isEmergencyFloatCovered: Boolean(row.is_emergency_float_covered),
      emergencyAmountDrawn: Number(row.emergency_amount_drawn || 0),
      quotations,
      selectedQuotation,
      proofOfWork,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
