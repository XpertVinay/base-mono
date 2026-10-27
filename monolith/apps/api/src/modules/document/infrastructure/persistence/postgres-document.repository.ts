import { IDocumentRepository } from '../../domain/repositories/document-repository.interface.js';
import { PropertyDocument } from '../../domain/entities/property-document.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresDocumentRepository implements IDocumentRepository {
  private fallbackStore: Map<string, PropertyDocument> = new Map();

  async save(doc: PropertyDocument): Promise<void> {
    this.fallbackStore.set(doc.id, doc);
    try {
      await dbPool.query(
        `INSERT INTO document.documents (id, property_id, uploader_id, document_type, title, file_url, mime_type, size_bytes, verification_status, verified_by, verified_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           verification_status = EXCLUDED.verification_status,
           verified_by = EXCLUDED.verified_by,
           verified_at = EXCLUDED.verified_at`,
        [
          doc.id,
          doc.propertyId,
          doc.uploaderId,
          doc.documentType,
          doc.title,
          doc.fileUrl,
          doc.mimeType,
          doc.sizeBytes,
          doc.verificationStatus,
          doc.verifiedBy,
          doc.verifiedAt,
          doc.createdAt
        ]
      );
    } catch {
      logger.warn('Database save failed in PostgresDocumentRepository, using fallback store', { docId: doc.id });
    }
  }

  async update(doc: PropertyDocument): Promise<void> {
    await this.save(doc);
  }

  async findById(id: string): Promise<PropertyDocument | null> {
    try {
      const res = await dbPool.query('SELECT * FROM document.documents WHERE id = $1', [id]);
      if (res.rows.length === 0) return this.fallbackStore.get(id) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByPropertyId(propertyId: string): Promise<PropertyDocument[]> {
    try {
      const res = await dbPool.query('SELECT * FROM document.documents WHERE property_id = $1 ORDER BY created_at DESC', [propertyId]);
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(d => d.propertyId === propertyId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(d => d.propertyId === propertyId);
    }
  }

  async delete(id: string): Promise<void> {
    this.fallbackStore.delete(id);
    try {
      await dbPool.query('DELETE FROM document.documents WHERE id = $1', [id]);
    } catch {
      logger.warn('Database delete failed in PostgresDocumentRepository', { docId: id });
    }
  }

  private mapToDomain(row: any): PropertyDocument {
    return PropertyDocument.reconstruct({
      id: row.id,
      propertyId: row.property_id,
      uploaderId: row.uploader_id,
      documentType: row.document_type,
      title: row.title,
      fileUrl: row.file_url,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      verificationStatus: row.verification_status,
      verifiedBy: row.verified_by || null,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      createdAt: new Date(row.created_at)
    });
  }
}
