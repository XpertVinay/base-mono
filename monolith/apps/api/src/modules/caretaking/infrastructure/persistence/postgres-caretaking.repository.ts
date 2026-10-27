import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerProfile } from '../../domain/entities/caretaker-profile.entity.js';
import { CaretakerAssignment } from '../../domain/entities/caretaker-assignment.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresCaretakingRepository implements ICaretakingRepository {
  private profileStore: Map<string, CaretakerProfile> = new Map();
  private assignmentStore: Map<string, CaretakerAssignment> = new Map();

  async saveProfile(profile: CaretakerProfile): Promise<void> {
    this.profileStore.set(profile.id, profile);
    try {
      await dbPool.query(
        `INSERT INTO caretaking.profiles (id, user_id, phone, experience_years, service_cities, skills, kyc_status, rating_average, completed_tasks_count, is_available, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
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

  async findProfileById(id: string): Promise<CaretakerProfile | null> {
    try {
      const res = await dbPool.query('SELECT * FROM caretaking.profiles WHERE id = $1', [id]);
      if (res.rows.length === 0) return this.profileStore.get(id) || null;
      return this.mapProfileToDomain(res.rows[0]);
    } catch {
      return this.profileStore.get(id) || null;
    }
  }

  async findProfileByUserId(userId: string): Promise<CaretakerProfile | null> {
    try {
      const res = await dbPool.query('SELECT * FROM caretaking.profiles WHERE user_id = $1', [userId]);
      if (res.rows.length === 0) {
        return Array.from(this.profileStore.values()).find(p => p.userId === userId) || null;
      }
      return this.mapProfileToDomain(res.rows[0]);
    } catch {
      return Array.from(this.profileStore.values()).find(p => p.userId === userId) || null;
    }
  }

  async findAllProfiles(): Promise<CaretakerProfile[]> {
    try {
      const res = await dbPool.query('SELECT * FROM caretaking.profiles ORDER BY rating_average DESC');
      if (res.rows.length === 0) return Array.from(this.profileStore.values());
      return res.rows.map(this.mapProfileToDomain);
    } catch {
      return Array.from(this.profileStore.values());
    }
  }

  async saveAssignment(assignment: CaretakerAssignment): Promise<void> {
    this.assignmentStore.set(assignment.id, assignment);
    try {
      await dbPool.query(
        `INSERT INTO caretaking.assignments (id, property_id, caretaker_id, owner_id, status, start_date, end_date, monthly_fee, allowed_permissions, spending_threshold_limit, accepted_at, terminated_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           allowed_permissions = EXCLUDED.allowed_permissions,
           spending_threshold_limit = EXCLUDED.spending_threshold_limit,
           accepted_at = EXCLUDED.accepted_at,
           terminated_at = EXCLUDED.terminated_at,
           updated_at = EXCLUDED.updated_at`,
        [
          assignment.id,
          assignment.propertyId,
          assignment.caretakerId,
          assignment.ownerId,
          assignment.status,
          assignment.startDate,
          assignment.endDate,
          assignment.monthlyFee,
          JSON.stringify(assignment.allowedPermissions),
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

  async findAssignmentById(id: string): Promise<CaretakerAssignment | null> {
    try {
      const res = await dbPool.query('SELECT * FROM caretaking.assignments WHERE id = $1', [id]);
      if (res.rows.length === 0) return this.assignmentStore.get(id) || null;
      return this.mapAssignmentToDomain(res.rows[0]);
    } catch {
      return this.assignmentStore.get(id) || null;
    }
  }

  async findAssignmentsByPropertyId(propertyId: string): Promise<CaretakerAssignment[]> {
    try {
      const res = await dbPool.query('SELECT * FROM caretaking.assignments WHERE property_id = $1', [propertyId]);
      if (res.rows.length === 0) {
        return Array.from(this.assignmentStore.values()).filter(a => a.propertyId === propertyId);
      }
      return res.rows.map(this.mapAssignmentToDomain);
    } catch {
      return Array.from(this.assignmentStore.values()).filter(a => a.propertyId === propertyId);
    }
  }

  async findActiveAssignmentByPropertyId(propertyId: string): Promise<CaretakerAssignment | null> {
    try {
      const res = await dbPool.query("SELECT * FROM caretaking.assignments WHERE property_id = $1 AND status = 'ACTIVE' LIMIT 1", [propertyId]);
      if (res.rows.length === 0) {
        return Array.from(this.assignmentStore.values()).find(a => a.propertyId === propertyId && a.status === 'ACTIVE') || null;
      }
      return this.mapAssignmentToDomain(res.rows[0]);
    } catch {
      return Array.from(this.assignmentStore.values()).find(a => a.propertyId === propertyId && a.status === 'ACTIVE') || null;
    }
  }

  async findAssignmentsByCaretakerId(caretakerId: string): Promise<CaretakerAssignment[]> {
    try {
      const res = await dbPool.query('SELECT * FROM caretaking.assignments WHERE caretaker_id = $1', [caretakerId]);
      if (res.rows.length === 0) {
        return Array.from(this.assignmentStore.values()).filter(a => a.caretakerId === caretakerId);
      }
      return res.rows.map(this.mapAssignmentToDomain);
    } catch {
      return Array.from(this.assignmentStore.values()).filter(a => a.caretakerId === caretakerId);
    }
  }

  async findAssignmentsByOwnerId(ownerId: string): Promise<CaretakerAssignment[]> {
    try {
      const res = await dbPool.query('SELECT * FROM caretaking.assignments WHERE owner_id = $1', [ownerId]);
      if (res.rows.length === 0) {
        return Array.from(this.assignmentStore.values()).filter(a => a.ownerId === ownerId);
      }
      return res.rows.map(this.mapAssignmentToDomain);
    } catch {
      return Array.from(this.assignmentStore.values()).filter(a => a.ownerId === ownerId);
    }
  }

  private mapProfileToDomain(row: any): CaretakerProfile {
    const serviceCities = typeof row.service_cities === 'string' ? JSON.parse(row.service_cities) : (row.service_cities || []);
    const skills = typeof row.skills === 'string' ? JSON.parse(row.skills) : (row.skills || []);

    return CaretakerProfile.reconstruct({
      id: row.id,
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
    const permissions = typeof row.allowed_permissions === 'string' ? JSON.parse(row.allowed_permissions) : (row.allowed_permissions || []);

    return CaretakerAssignment.reconstruct({
      id: row.id,
      propertyId: row.property_id,
      caretakerId: row.caretaker_id,
      ownerId: row.owner_id,
      status: row.status,
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : null,
      monthlyFee: Number(row.monthly_fee),
      allowedPermissions: permissions,
      spendingThresholdLimit: Number(row.spending_threshold_limit || 0),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
      terminatedAt: row.terminated_at ? new Date(row.terminated_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
