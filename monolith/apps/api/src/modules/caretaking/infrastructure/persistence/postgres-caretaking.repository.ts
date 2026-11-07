import { ICaretakingRepository, AssignmentFilter } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerProfile } from '../../domain/entities/caretaker-profile.entity.js';
import { CaretakerAssignment } from '../../domain/entities/caretaker-assignment.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresCaretakingRepository implements ICaretakingRepository {
  private profileStore: Map<string, CaretakerProfile> = new Map();
  private assignmentStore: Map<string, CaretakerAssignment> = new Map();

  async saveProfile(profile: CaretakerProfile): Promise<void> {
    this.profileStore.set(profile.id, this.cloneProfile(profile));
    try {
      await dbPool.query(
        `INSERT INTO caretaking.profiles (
           id, tenant_id, user_id, phone, experience_years, service_cities, skills,
           kyc_status, rating_average, completed_tasks_count, is_available, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id,
           phone = EXCLUDED.phone,
           experience_years = EXCLUDED.experience_years,
           service_cities = EXCLUDED.service_cities,
           skills = EXCLUDED.skills,
           kyc_status = EXCLUDED.kyc_status,
           rating_average = EXCLUDED.rating_average,
           completed_tasks_count = EXCLUDED.completed_tasks_count,
           is_available = EXCLUDED.is_available,
           updated_at = EXCLUDED.updated_at`,
        [
          profile.id,
          profile.tenantId || null,
          profile.userId,
          profile.phone,
          profile.experienceYears,
          JSON.stringify(profile.serviceCities),
          JSON.stringify(profile.skills),
          profile.kycStatus,
          profile.ratingAverage,
          profile.completedTasksCount,
          profile.isAvailable,
          profile.createdAt,
          profile.updatedAt
        ]
      );
    } catch {
      logger.warn('Database saveProfile failed in PostgresCaretakingRepository, using fallback store', { profileId: profile.id });
    }
  }

  async findProfileById(id: string, tenantId?: string): Promise<CaretakerProfile | null> {
    try {
      let sql = 'SELECT * FROM caretaking.profiles WHERE id = $1';
      const params: any[] = [id];
      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }
      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) return this.getProfileFromFallback(id, tenantId);
      return this.mapProfileToDomain(res.rows[0]);
    } catch {
      return this.getProfileFromFallback(id, tenantId);
    }
  }

  async findProfileByUserId(userId: string, tenantId?: string): Promise<CaretakerProfile | null> {
    try {
      let sql = 'SELECT * FROM caretaking.profiles WHERE user_id = $1';
      const params: any[] = [userId];
      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }
      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.getProfileByUserIdFromFallback(userId, tenantId);
      }
      return this.mapProfileToDomain(res.rows[0]);
    } catch {
      return this.getProfileByUserIdFromFallback(userId, tenantId);
    }
  }

  async findAllProfiles(tenantId?: string): Promise<CaretakerProfile[]> {
    try {
      let sql = 'SELECT * FROM caretaking.profiles';
      const params: any[] = [];
      if (tenantId) {
        sql += ' WHERE (tenant_id = $1 OR tenant_id IS NULL)';
        params.push(tenantId);
      }
      sql += ' ORDER BY rating_average DESC';

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) return this.getAllProfilesFromFallback(tenantId);
      return res.rows.map(row => this.mapProfileToDomain(row));
    } catch {
      return this.getAllProfilesFromFallback(tenantId);
    }
  }

  async saveAssignment(assignment: CaretakerAssignment): Promise<void> {
    this.assignmentStore.set(assignment.id, this.cloneAssignment(assignment));
    try {
      await dbPool.query(
        `INSERT INTO caretaking.assignments (
           id, tenant_id, property_id, caretaker_id, owner_id, status, start_date, end_date,
           monthly_fee, permission_scopes, allowed_permissions, spending_limit, spending_threshold_limit,
           accepted_at, terminated_at, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id,
           status = EXCLUDED.status,
           permission_scopes = EXCLUDED.permission_scopes,
           allowed_permissions = EXCLUDED.allowed_permissions,
           spending_limit = EXCLUDED.spending_limit,
           spending_threshold_limit = EXCLUDED.spending_threshold_limit,
           accepted_at = EXCLUDED.accepted_at,
           terminated_at = EXCLUDED.terminated_at,
           updated_at = EXCLUDED.updated_at`,
        [
          assignment.id,
          assignment.tenantId || null,
          assignment.propertyId,
          assignment.caretakerId,
          assignment.ownerId,
          assignment.status,
          assignment.startDate,
          assignment.endDate,
          assignment.monthlyFee,
          JSON.stringify(assignment.allowedPermissions),
          JSON.stringify(assignment.allowedPermissions),
          assignment.spendingThresholdLimit,
          assignment.spendingThresholdLimit,
          assignment.acceptedAt,
          assignment.terminatedAt,
          assignment.createdAt,
          assignment.updatedAt
        ]
      );
    } catch {
      logger.warn('Database saveAssignment failed, using fallback store', { assignmentId: assignment.id });
    }
  }

  async updateAssignment(assignment: CaretakerAssignment): Promise<void> {
    await this.saveAssignment(assignment);
  }

  async findAssignmentById(id: string, tenantId?: string): Promise<CaretakerAssignment | null> {
    try {
      let sql = 'SELECT * FROM caretaking.assignments WHERE id = $1';
      const params: any[] = [id];
      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }
      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) return this.getAssignmentFromFallback(id, tenantId);
      return this.mapAssignmentToDomain(res.rows[0]);
    } catch {
      return this.getAssignmentFromFallback(id, tenantId);
    }
  }

  async findAssignmentsByPropertyId(propertyId: string, tenantId?: string): Promise<CaretakerAssignment[]> {
    return this.findAssignments({ propertyId, tenantId });
  }

  async findActiveAssignmentByPropertyId(propertyId: string, tenantId?: string): Promise<CaretakerAssignment | null> {
    try {
      let sql = "SELECT * FROM caretaking.assignments WHERE property_id = $1 AND status = 'ACTIVE'";
      const params: any[] = [propertyId];
      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }
      sql += ' LIMIT 1';

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.getActiveAssignmentByPropertyInFallback(propertyId, tenantId);
      }
      return this.mapAssignmentToDomain(res.rows[0]);
    } catch {
      return this.getActiveAssignmentByPropertyInFallback(propertyId, tenantId);
    }
  }

  async findAssignmentsByCaretakerId(caretakerId: string, tenantId?: string): Promise<CaretakerAssignment[]> {
    return this.findAssignments({ caretakerId, tenantId });
  }

  async findAssignmentsByOwnerId(ownerId: string, tenantId?: string): Promise<CaretakerAssignment[]> {
    return this.findAssignments({ ownerId, tenantId });
  }

  async findAssignments(filter: AssignmentFilter): Promise<CaretakerAssignment[]> {
    try {
      let sql = 'SELECT * FROM caretaking.assignments WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.tenantId) {
        sql += ` AND (tenant_id = $${paramIndex} OR tenant_id IS NULL)`;
        params.push(filter.tenantId);
        paramIndex++;
      }
      if (filter.propertyId) {
        sql += ` AND property_id = $${paramIndex}`;
        params.push(filter.propertyId);
        paramIndex++;
      }
      if (filter.caretakerId) {
        sql += ` AND caretaker_id = $${paramIndex}`;
        params.push(filter.caretakerId);
        paramIndex++;
      }
      if (filter.ownerId) {
        sql += ` AND owner_id = $${paramIndex}`;
        params.push(filter.ownerId);
        paramIndex++;
      }
      if (filter.status) {
        sql += ` AND status = $${paramIndex}`;
        params.push(filter.status);
        paramIndex++;
      }

      sql += ' ORDER BY created_at DESC';

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.findAssignmentsInFallback(filter);
      }
      return res.rows.map(row => this.mapAssignmentToDomain(row));
    } catch {
      return this.findAssignmentsInFallback(filter);
    }
  }

  // --- Fallback store helpers with snapshot cloning & tenant isolation ---

  private getProfileFromFallback(id: string, tenantId?: string): CaretakerProfile | null {
    const p = this.profileStore.get(id);
    if (!p) return null;
    if (tenantId && p.tenantId && p.tenantId !== tenantId) return null;
    return this.cloneProfile(p);
  }

  private getProfileByUserIdFromFallback(userId: string, tenantId?: string): CaretakerProfile | null {
    for (const p of this.profileStore.values()) {
      if (p.userId === userId) {
        if (!tenantId || !p.tenantId || p.tenantId === tenantId) {
          return this.cloneProfile(p);
        }
      }
    }
    return null;
  }

  private getAllProfilesFromFallback(tenantId?: string): CaretakerProfile[] {
    const list: CaretakerProfile[] = [];
    for (const p of this.profileStore.values()) {
      if (!tenantId || !p.tenantId || p.tenantId === tenantId) {
        list.push(this.cloneProfile(p));
      }
    }
    return list.sort((a, b) => b.ratingAverage - a.ratingAverage);
  }

  private getAssignmentFromFallback(id: string, tenantId?: string): CaretakerAssignment | null {
    const a = this.assignmentStore.get(id);
    if (!a) return null;
    if (tenantId && a.tenantId && a.tenantId !== tenantId) return null;
    return this.cloneAssignment(a);
  }

  private getActiveAssignmentByPropertyInFallback(propertyId: string, tenantId?: string): CaretakerAssignment | null {
    for (const a of this.assignmentStore.values()) {
      if (a.propertyId === propertyId && a.status === 'ACTIVE') {
        if (!tenantId || !a.tenantId || a.tenantId === tenantId) {
          return this.cloneAssignment(a);
        }
      }
    }
    return null;
  }

  private findAssignmentsInFallback(filter: AssignmentFilter): CaretakerAssignment[] {
    const results: CaretakerAssignment[] = [];
    for (const a of this.assignmentStore.values()) {
      if (filter.tenantId && a.tenantId && a.tenantId !== filter.tenantId) continue;
      if (filter.propertyId && a.propertyId !== filter.propertyId) continue;
      if (filter.caretakerId && a.caretakerId !== filter.caretakerId) continue;
      if (filter.ownerId && a.ownerId !== filter.ownerId) continue;
      if (filter.status && a.status !== filter.status) continue;
      results.push(this.cloneAssignment(a));
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private cloneProfile(p: CaretakerProfile): CaretakerProfile {
    return CaretakerProfile.reconstruct({
      id: p.id,
      tenantId: p.tenantId,
      userId: p.userId,
      phone: p.phone,
      experienceYears: p.experienceYears,
      serviceCities: [...p.serviceCities],
      skills: [...p.skills],
      kycStatus: p.kycStatus,
      ratingAverage: p.ratingAverage,
      completedTasksCount: p.completedTasksCount,
      isAvailable: p.isAvailable,
      createdAt: new Date(p.createdAt.getTime()),
      updatedAt: new Date(p.updatedAt.getTime())
    });
  }

  private cloneAssignment(a: CaretakerAssignment): CaretakerAssignment {
    return CaretakerAssignment.reconstruct({
      id: a.id,
      tenantId: a.tenantId,
      propertyId: a.propertyId,
      caretakerId: a.caretakerId,
      ownerId: a.ownerId,
      status: a.status,
      startDate: new Date(a.startDate.getTime()),
      endDate: a.endDate ? new Date(a.endDate.getTime()) : null,
      monthlyFee: a.monthlyFee,
      allowedPermissions: [...a.allowedPermissions],
      spendingThresholdLimit: a.spendingThresholdLimit,
      acceptedAt: a.acceptedAt ? new Date(a.acceptedAt.getTime()) : null,
      terminatedAt: a.terminatedAt ? new Date(a.terminatedAt.getTime()) : null,
      createdAt: new Date(a.createdAt.getTime()),
      updatedAt: new Date(a.updatedAt.getTime())
    });
  }

  private mapProfileToDomain(row: any): CaretakerProfile {
    const serviceCities = typeof row.service_cities === 'string' ? JSON.parse(row.service_cities) : (row.service_cities || []);
    const skills = typeof row.skills === 'string' ? JSON.parse(row.skills) : (row.skills || []);

    return CaretakerProfile.reconstruct({
      id: row.id,
      tenantId: row.tenant_id || undefined,
      userId: row.user_id,
      phone: row.phone,
      experienceYears: Number(row.experience_years),
      serviceCities,
      skills,
      kycStatus: row.kyc_status,
      ratingAverage: Number(row.rating_average || 5.0),
      completedTasksCount: Number(row.completed_tasks_count || 0),
      isAvailable: Boolean(row.is_available),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }

  private mapAssignmentToDomain(row: any): CaretakerAssignment {
    const rawPermissions = row.permission_scopes ?? row.allowed_permissions;
    const permissions = typeof rawPermissions === 'string' ? JSON.parse(rawPermissions) : (rawPermissions || []);
    const spendingLimit = row.spending_threshold_limit ?? row.spending_limit ?? 0;

    return CaretakerAssignment.reconstruct({
      id: row.id,
      tenantId: row.tenant_id || undefined,
      propertyId: row.property_id,
      caretakerId: row.caretaker_id,
      ownerId: row.owner_id,
      status: row.status,
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : null,
      monthlyFee: Number(row.monthly_fee),
      allowedPermissions: permissions,
      spendingThresholdLimit: Number(spendingLimit),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
      terminatedAt: row.terminated_at ? new Date(row.terminated_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
