import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export interface MfaProtectedRoute {
  id: string;
  method: string;
  pathPattern: string;
  description?: string;
  reverificationMode: 'SESSION_24H' | 'EVERY_TIME';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMfaProtectedRouteRepository {
  getAllActive(): Promise<MfaProtectedRoute[]>;
  getAll(): Promise<MfaProtectedRoute[]>;
  save(route: MfaProtectedRoute): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export class PostgresMfaProtectedRouteRepository implements IMfaProtectedRouteRepository {
  private fallbackStore: Map<string, MfaProtectedRoute> = new Map();

  constructor() {
    // Seed in-memory defaults
    const defaults: MfaProtectedRoute[] = [
      {
        id: 'mfa-route-sensitive-op',
        method: '*',
        pathPattern: '/api/iam/mfa/sensitive-operation',
        description: 'High-security operation requiring active 24h MFA verification',
        reverificationMode: 'SESSION_24H',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'mfa-route-strict-action',
        method: '*',
        pathPattern: '/api/iam/mfa/strict-action',
        description: 'Critical administrative action requiring immediate MFA re-authentication every time',
        reverificationMode: 'EVERY_TIME',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'mfa-route-pwd',
        method: 'POST',
        pathPattern: '/api/iam/me/password',
        description: 'Credential and password alteration',
        reverificationMode: 'EVERY_TIME',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'mfa-route-mfa-disable',
        method: 'POST',
        pathPattern: '/api/iam/mfa/disable',
        description: 'MFA deactivation requires immediate re-authentication',
        reverificationMode: 'EVERY_TIME',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const d of defaults) {
      this.fallbackStore.set(d.id, d);
    }
  }

  async getAllActive(): Promise<MfaProtectedRoute[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, method, path_pattern, description, reverification_mode, is_active, created_at, updated_at
         FROM iam.mfa_protected_routes
         WHERE is_active = TRUE
         ORDER BY path_pattern ASC`
      );

      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(r => r.isActive);
      }

      return res.rows.map(this.mapToEntity);
    } catch (err) {
      logger.warn('Database query failed in PostgresMfaProtectedRouteRepository.getAllActive, using fallback cache');
      return Array.from(this.fallbackStore.values()).filter(r => r.isActive);
    }
  }

  async getAll(): Promise<MfaProtectedRoute[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, method, path_pattern, description, reverification_mode, is_active, created_at, updated_at
         FROM iam.mfa_protected_routes
         ORDER BY path_pattern ASC`
      );

      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values());
      }

      return res.rows.map(this.mapToEntity);
    } catch (err) {
      logger.warn('Database query failed in PostgresMfaProtectedRouteRepository.getAll, using fallback cache');
      return Array.from(this.fallbackStore.values());
    }
  }

  async save(route: MfaProtectedRoute): Promise<void> {
    this.fallbackStore.set(route.id, route);
    try {
      await dbPool.query(
        `INSERT INTO iam.mfa_protected_routes (id, method, path_pattern, description, reverification_mode, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (path_pattern) DO UPDATE SET
           method = EXCLUDED.method,
           description = EXCLUDED.description,
           reverification_mode = EXCLUDED.reverification_mode,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [
          route.id,
          route.method,
          route.pathPattern,
          route.description || null,
          route.reverificationMode,
          route.isActive,
          route.createdAt,
          route.updatedAt
        ]
      );
    } catch (err) {
      logger.warn('Database upsert failed in PostgresMfaProtectedRouteRepository.save, persisted in fallback cache', { id: route.id });
    }
  }

  async delete(id: string): Promise<boolean> {
    this.fallbackStore.delete(id);
    try {
      const res = await dbPool.query('DELETE FROM iam.mfa_protected_routes WHERE id = $1', [id]);
      return (res.rowCount || 0) > 0;
    } catch (err) {
      logger.warn('Database delete failed in PostgresMfaProtectedRouteRepository.delete', { id });
      return true;
    }
  }

  private mapToEntity(row: any): MfaProtectedRoute {
    return {
      id: row.id,
      method: row.method,
      pathPattern: row.path_pattern,
      description: row.description,
      reverificationMode: row.reverification_mode,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
