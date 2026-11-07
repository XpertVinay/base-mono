import { ISearchRepository } from '../../domain/repositories/search-repository.interface.js';
import { SearchDocument } from '../../domain/entities/search-document.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresSearchRepository implements ISearchRepository {
  private fallbackStore: Map<string, SearchDocument> = new Map();

  async index(document: SearchDocument): Promise<void> {
    this.fallbackStore.set(document.id, this.cloneDocument(document));
    try {
      await dbPool.query(
        `INSERT INTO search.search_index (id, tenant_id, document_type, title, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id,
           document_type = EXCLUDED.document_type,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           metadata = EXCLUDED.metadata`,
        [
          document.id,
          document.tenantId || null,
          document.documentType,
          document.title,
          document.description || null,
          JSON.stringify(document.metadata || {}),
          document.createdAt
        ]
      );
    } catch (err) {
      logger.warn('Failed to persist search document in PostgreSQL, saved in fallback store', { id: document.id });
    }
  }

  async search(query: string, type?: string, limit = 20, tenantId?: string): Promise<SearchDocument[]> {
    const q = `%${query.toLowerCase().trim()}%`;
    try {
      let sql = 'SELECT id, tenant_id, document_type, title, description, metadata, created_at FROM search.search_index WHERE (LOWER(title) LIKE $1 OR LOWER(description) LIKE $1)';
      const params: any[] = [q];

      if (tenantId) {
        sql += ` AND tenant_id = $${params.length + 1}`;
        params.push(tenantId);
      }

      if (type) {
        sql += ` AND document_type = $${params.length + 1}`;
        params.push(type);
      }

      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.searchFallback(query, type, limit, tenantId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return this.searchFallback(query, type, limit, tenantId);
    }
  }

  async findById(id: string, tenantId?: string): Promise<SearchDocument | null> {
    try {
      let sql = 'SELECT id, tenant_id, document_type, title, description, metadata, created_at FROM search.search_index WHERE id = $1';
      const params: any[] = [id];

      if (tenantId) {
        sql += ' AND tenant_id = $2';
        params.push(tenantId);
      }

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.getFallbackById(id, tenantId);
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.getFallbackById(id, tenantId);
    }
  }

  async delete(id: string, tenantId?: string): Promise<void> {
    const doc = this.fallbackStore.get(id);
    if (doc && (!tenantId || doc.tenantId === tenantId)) {
      this.fallbackStore.delete(id);
    }
    try {
      let sql = 'DELETE FROM search.search_index WHERE id = $1';
      const params: any[] = [id];
      if (tenantId) {
        sql += ' AND tenant_id = $2';
        params.push(tenantId);
      }
      await dbPool.query(sql, params);
    } catch (err) {
      logger.warn('Failed to delete search document in PostgreSQL', { id });
    }
  }

  private searchFallback(query: string, type?: string, limit = 20, tenantId?: string): SearchDocument[] {
    const q = query.toLowerCase().trim();
    return Array.from(this.fallbackStore.values())
      .filter(d => {
        if (tenantId && d.tenantId !== tenantId) return false;
        if (!tenantId && d.tenantId) return false;
        const matchesQuery = !q || d.title.toLowerCase().includes(q) || (d.description?.toLowerCase().includes(q) ?? false);
        const matchesType = !type || d.documentType === type;
        return matchesQuery && matchesType;
      })
      .slice(0, limit)
      .map(d => this.cloneDocument(d));
  }

  private getFallbackById(id: string, tenantId?: string): SearchDocument | null {
    const doc = this.fallbackStore.get(id);
    if (!doc) return null;
    if (tenantId && doc.tenantId !== tenantId) return null;
    return this.cloneDocument(doc);
  }

  private cloneDocument(doc: SearchDocument): SearchDocument {
    return SearchDocument.reconstitute(doc.id, {
      documentType: doc.documentType,
      title: doc.title,
      description: doc.description,
      metadata: doc.metadata ? JSON.parse(JSON.stringify(doc.metadata)) : undefined,
      tenantId: doc.tenantId,
      createdAt: new Date(doc.createdAt.getTime())
    });
  }

  private mapToDomain(row: any): SearchDocument {
    return SearchDocument.reconstitute(row.id, {
      documentType: row.document_type,
      title: row.title,
      description: row.description,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      tenantId: row.tenant_id || undefined,
      createdAt: new Date(row.created_at)
    });
  }
}
