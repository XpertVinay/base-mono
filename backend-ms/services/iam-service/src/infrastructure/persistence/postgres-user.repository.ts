import {
  IUserRepository,
  UserFilterParams,
  PaginatedUsersResult
} from '../../domain/repositories/user-repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import { PasswordVO } from '../../domain/value-objects/password.vo.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresUserRepository implements IUserRepository {
  async findById(id: string, tenantId?: string): Promise<User | null> {
    const res = tenantId
      ? await dbPool.query(
          `SELECT id, tenant_id, email, password_hash, name, role, auth_method, is_active, created_at, updated_at
           FROM iam.users WHERE id = $1 AND tenant_id = $2`,
          [id, tenantId]
        )
      : await dbPool.query(
          `SELECT id, tenant_id, email, password_hash, name, role, auth_method, is_active, created_at, updated_at
           FROM iam.users WHERE id = $1`,
          [id]
        );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findByEmail(email: string, tenantId?: string): Promise<User | null> {
    const resolvedTenantId = tenantId || process.env.DEFAULT_TENANT_ID || 'default';
    const res = await dbPool.query(
      `SELECT id, tenant_id, email, password_hash, name, role, auth_method, is_active, created_at, updated_at
       FROM iam.users WHERE LOWER(email) = LOWER($1) AND tenant_id = $2`,
      [email, resolvedTenantId]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findMany(filters: UserFilterParams): Promise<PaginatedUsersResult> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      values.push(filters.tenantId);
    }

    if (filters.role) {
      conditions.push(`UPPER(role) = UPPER($${paramIndex++})`);
      values.push(filters.role);
    }

    if (filters.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(filters.isActive);
    }

    if (filters.authMethod) {
      conditions.push(`UPPER(auth_method) = UPPER($${paramIndex++})`);
      values.push(filters.authMethod);
    }

    if (filters.search && filters.search.trim().length > 0) {
      const searchPattern = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(email) LIKE $${paramIndex})`);
      values.push(searchPattern);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching
    const countQuery = `SELECT COUNT(*)::int AS total FROM iam.users ${whereClause}`;
    const countRes = await dbPool.query(countQuery, values);
    const total = countRes.rows[0]?.total ?? 0;

    // Sorting
    const sortFieldMap: Record<string, string> = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      email: 'email',
      name: 'name',
      role: 'role'
    };
    const sortCol = (filters.sortBy && sortFieldMap[filters.sortBy]) || 'created_at';
    const sortDir = filters.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Pagination
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const offset = (page - 1) * limit;

    const dataQuery = `
      SELECT id, tenant_id, email, password_hash, name, role, auth_method, is_active, created_at, updated_at
      FROM iam.users
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataValues = [...values, limit, offset];
    const dataRes = await dbPool.query(dataQuery, dataValues);

    return {
      users: dataRes.rows.map((row) => this.mapToDomain(row)),
      total
    };
  }

  async save(user: User): Promise<void> {
    await dbPool.query(
      `INSERT INTO iam.users (id, tenant_id, email, password_hash, name, role, auth_method, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        user.id,
        user.tenantId,
        user.email,
        user.passwordHash ? user.passwordHash.value : null,
        user.name,
        user.role,
        user.authMethod,
        user.isActive,
        user.createdAt,
        user.updatedAt
      ]
    );
  }

  async update(user: User): Promise<void> {
    await dbPool.query(
      `UPDATE iam.users
       SET email = $2, password_hash = $3, name = $4, role = $5, auth_method = $6, is_active = $7, updated_at = $8
       WHERE id = $1 AND tenant_id = $9`,
      [
        user.id,
        user.email,
        user.passwordHash ? user.passwordHash.value : null,
        user.name,
        user.role,
        user.authMethod,
        user.isActive,
        user.updatedAt,
        user.tenantId
      ]
    );
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const res = tenantId
      ? await dbPool.query(
          'DELETE FROM iam.users WHERE id = $1 AND tenant_id = $2',
          [id, tenantId]
        )
      : await dbPool.query(
          'DELETE FROM iam.users WHERE id = $1',
          [id]
        );
    return (res.rowCount ?? 0) > 0;
  }

  async countByRole(role: string, tenantId?: string): Promise<number> {
    const res = tenantId
      ? await dbPool.query(
          'SELECT COUNT(*)::int AS count FROM iam.users WHERE UPPER(role) = UPPER($1) AND is_active = TRUE AND tenant_id = $2',
          [role, tenantId]
        )
      : await dbPool.query(
          'SELECT COUNT(*)::int AS count FROM iam.users WHERE UPPER(role) = UPPER($1) AND is_active = TRUE',
          [role]
        );
    return res.rows[0]?.count ?? 0;
  }

  private mapToDomain(row: any): User {
    return User.reconstitute(
      {
        tenantId: row.tenant_id || 'default',
        email: row.email,
        passwordHash: row.password_hash ? PasswordVO.fromHash(row.password_hash) : undefined,
        name: row.name,
        role: row.role,
        authMethod: row.auth_method || (row.password_hash ? 'LOCAL' : 'OIDC'),
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }
}
