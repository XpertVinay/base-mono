import { ISearchRepository } from '../../domain/repositories/search-repository.interface.js';
import { SearchDocument } from '../../domain/entities/search-document.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresSearchRepository implements ISearchRepository {
  private fallbackStore: Map<string, SearchDocument> = new Map();

  async index(document: SearchDocument): Promise<void> {
    this.fallbackStore.set(document.id, document);
    try {
      await dbPool.query(
        `INSERT INTO search.search_index (id, document_type, title, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           metadata = EXCLUDED.metadata`,
        [document.id, document.documentType, document.title, document.description || null, JSON.stringify(document.metadata || {}), document.createdAt]
      );
    } catch (err) {
      logger.warn('Failed to persist search document in PostgreSQL, saved in fallback store', { id: document.id });
    }
  }

  async search(query: string, type?: string, limit = 20): Promise<SearchDocument[]> {
    const q = `%${query.toLowerCase().trim()}%`;
    try {
      let sql = 'SELECT id, document_type, title, description, metadata, created_at FROM search.search_index WHERE (LOWER(title) LIKE $1 OR LOWER(description) LIKE $1)';
      const params: any[] = [q];

      if (type) {
        sql += ' AND document_type = $2';
        params.push(type);
      }

      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.searchFallback(query, type, limit);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return this.searchFallback(query, type, limit);
    }
  }

  private searchFallback(query: string, type?: string, limit = 20): SearchDocument[] {
    const q = query.toLowerCase().trim();
    return Array.from(this.fallbackStore.values())
      .filter(d => {
        const matchesQuery = d.title.toLowerCase().includes(q) || (d.description?.toLowerCase().includes(q) ?? false);
        const matchesType = !type || d.documentType === type;
        return matchesQuery && matchesType;
      })
      .slice(0, limit);
  }

  private mapToDomain(row: any): SearchDocument {
    return SearchDocument.reconstitute(row.id, {
      documentType: row.document_type,
      title: row.title,
      description: row.description,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: new Date(row.created_at)
    });
  }
}
