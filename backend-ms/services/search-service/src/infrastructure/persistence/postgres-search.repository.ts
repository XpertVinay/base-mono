import { ISearchRepository } from '../../domain/repositories/search-repository.interface.js';
import { SearchDocument } from '../../domain/entities/search-document.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresSearchRepository implements ISearchRepository {
  async index(doc: SearchDocument): Promise<void> {
    await dbPool.query(
      `INSERT INTO search.search_index (id, document_type, title, description, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET document_type = EXCLUDED.document_type,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           metadata = EXCLUDED.metadata`,
      [doc.id, doc.documentType, doc.title, doc.description, JSON.stringify(doc.metadata || {}), doc.createdAt]
    );
  }

  async search(query: string, type?: string): Promise<SearchDocument[]> {
    const params: any[] = [`%${query}%`];
    let sql = `SELECT id, document_type, title, description, metadata, created_at 
               FROM search.search_index 
               WHERE (title ILIKE $1 OR description ILIKE $1)`;

    if (type) {
      params.push(type.toUpperCase());
      sql += ` AND UPPER(document_type) = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const res = await dbPool.query(sql, params);
    return res.rows.map(row =>
      SearchDocument.create(row.id, {
        documentType: row.document_type,
        title: row.title,
        description: row.description,
        metadata: row.metadata,
        createdAt: new Date(row.created_at)
      })
    );
  }

  async remove(id: string): Promise<boolean> {
    const res = await dbPool.query('DELETE FROM search.search_index WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}
