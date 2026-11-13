import { ISearchRepository, ListSearchDocumentsOptions } from '../../domain/repositories/search-repository.interface.js';
import { SearchDocument } from '../../domain/entities/search-document.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresSearchRepository implements ISearchRepository {
  async findById(id: string): Promise<SearchDocument | null> {
    const res = await dbPool.query(
      'SELECT id, document_type, title, description, metadata, created_at FROM search.search_index WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return SearchDocument.create(row.id, {
      documentType: row.document_type,
      title: row.title,
      description: row.description,
      metadata: row.metadata,
      createdAt: new Date(row.created_at)
    });
  }

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

  async listAll(options: ListSearchDocumentsOptions = {}): Promise<{ documents: SearchDocument[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.type) {
      params.push(options.type.toUpperCase());
      conditions.push(`UPPER(document_type) = $${params.length}`);
    }

    if (options.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length} OR id ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await dbPool.query(
      `SELECT COUNT(*) as count FROM search.search_index ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const res = await dbPool.query(
      `SELECT id, document_type, title, description, metadata, created_at
       FROM search.search_index
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const documents = res.rows.map(row =>
      SearchDocument.create(row.id, {
        documentType: row.document_type,
        title: row.title,
        description: row.description,
        metadata: row.metadata,
        createdAt: new Date(row.created_at)
      })
    );

    return { documents, total };
  }

  async remove(id: string): Promise<boolean> {
    const res = await dbPool.query('DELETE FROM search.search_index WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}
