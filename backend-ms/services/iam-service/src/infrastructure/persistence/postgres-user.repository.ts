import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import { PasswordVO } from '../../domain/value-objects/password.vo.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const res = await dbPool.query(
      'SELECT id, email, password_hash, name, role, is_active, created_at, updated_at FROM iam.users WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const res = await dbPool.query(
      'SELECT id, email, password_hash, name, role, is_active, created_at, updated_at FROM iam.users WHERE email = $1',
      [email]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async save(user: User): Promise<void> {
    await dbPool.query(
      `INSERT INTO iam.users (id, email, password_hash, name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        user.email,
        user.passwordHash.value,
        user.name,
        user.role,
        user.isActive,
        user.createdAt,
        user.updatedAt
      ]
    );
  }

  async update(user: User): Promise<void> {
    await dbPool.query(
      `UPDATE iam.users 
       SET email = $2, password_hash = $3, name = $4, role = $5, is_active = $6, updated_at = $7
       WHERE id = $1`,
      [
        user.id,
        user.email,
        user.passwordHash.value,
        user.name,
        user.role,
        user.isActive,
        user.updatedAt
      ]
    );
  }

  private mapToDomain(row: any): User {
    return User.reconstitute(
      {
        email: row.email,
        passwordHash: PasswordVO.fromHash(row.password_hash),
        name: row.name,
        role: row.role,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }
}
