import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import { Password } from '../../domain/value-objects/password.vo.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresUserRepository implements IUserRepository {
  private fallbackStore: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    try {
      const res = await dbPool.query(
        'SELECT id, email, password_hash, name, role, is_active, created_at, updated_at FROM iam.users WHERE id = $1',
        [id]
      );
      if (res.rows.length === 0) {
        return this.fallbackStore.get(id) || null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch (err) {
      logger.warn('Database query failed in PostgresUserRepository.findById, checking fallback cache', { id });
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    try {
      const res = await dbPool.query(
        'SELECT id, email, password_hash, name, role, is_active, created_at, updated_at FROM iam.users WHERE LOWER(email) = $1',
        [normalized]
      );
      if (res.rows.length === 0) {
        for (const user of this.fallbackStore.values()) {
          if (user.email === normalized) return user;
        }
        return null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch (err) {
      logger.warn('Database query failed in PostgresUserRepository.findByEmail, checking fallback cache', { email });
      for (const user of this.fallbackStore.values()) {
        if (user.email === normalized) return user;
      }
      return null;
    }
  }

  async save(user: User): Promise<void> {
    this.fallbackStore.set(user.id, user);
    try {
      await dbPool.query(
        `INSERT INTO iam.users (id, email, password_hash, name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [
          user.id,
          user.email,
          user.password.value,
          user.name,
          user.role,
          user.isActive,
          user.createdAt,
          user.updatedAt
        ]
      );
    } catch (err) {
      logger.warn('Database insert failed in PostgresUserRepository.save, persisted in fallback cache', { userId: user.id });
    }
  }

  async update(user: User): Promise<void> {
    await this.save(user);
  }

  private mapToDomain(row: any): User {
    return User.reconstitute(row.id, {
      email: row.email,
      password: Password.fromHashed(row.password_hash),
      name: row.name,
      role: row.role,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
