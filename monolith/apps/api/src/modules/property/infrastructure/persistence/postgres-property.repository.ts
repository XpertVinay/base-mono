import { IPropertyRepository } from '../../domain/repositories/property-repository.interface.js';
import { Property } from '../../domain/entities/property.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresPropertyRepository implements IPropertyRepository {
  private fallbackStore: Map<string, Property> = new Map();

  async findById(id: string): Promise<Property | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, owner_id, title, description, category, property_type, status,
                address, area_sq_ft, amenities, emergency_contact, emergency_float_limit,
                created_at, updated_at
         FROM property.properties WHERE id = $1`,
        [id]
      );
      if (res.rows.length === 0) return this.fallbackStore.get(id) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByOwnerId(ownerId: string): Promise<Property[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, owner_id, title, description, category, property_type, status,
                address, area_sq_ft, amenities, emergency_contact, emergency_float_limit,
                created_at, updated_at
         FROM property.properties WHERE owner_id = $1 ORDER BY created_at DESC`,
        [ownerId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(p => p.ownerId === ownerId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(p => p.ownerId === ownerId);
    }
  }

  async findAll(): Promise<Property[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, owner_id, title, description, category, property_type, status,
                address, area_sq_ft, amenities, emergency_contact, emergency_float_limit,
                created_at, updated_at
         FROM property.properties ORDER BY created_at DESC`
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values());
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values());
    }
  }

  async save(property: Property): Promise<void> {
    this.fallbackStore.set(property.id, property);
    try {
      await dbPool.query(
        `INSERT INTO property.properties (
          id, owner_id, title, description, category, property_type, status,
          address, area_sq_ft, amenities, emergency_contact, emergency_float_limit,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          address = EXCLUDED.address,
          area_sq_ft = EXCLUDED.area_sq_ft,
          amenities = EXCLUDED.amenities,
          emergency_contact = EXCLUDED.emergency_contact,
          emergency_float_limit = EXCLUDED.emergency_float_limit,
          updated_at = EXCLUDED.updated_at`,
        [
          property.id,
          property.ownerId,
          property.title,
          property.description,
          property.category,
          property.propertyType,
          property.status,
          JSON.stringify(property.address),
          property.areaSqFt,
          JSON.stringify(property.amenities),
          JSON.stringify(property.emergencyContact),
          property.emergencyFloatLimit,
          property.createdAt,
          property.updatedAt
        ]
      );
    } catch {
      logger.warn('Database save failed in PostgresPropertyRepository, saved to fallback store', { propertyId: property.id });
    }
  }

  async update(property: Property): Promise<void> {
    await this.save(property);
  }

  async delete(id: string): Promise<void> {
    this.fallbackStore.delete(id);
    try {
      await dbPool.query('DELETE FROM property.properties WHERE id = $1', [id]);
    } catch {
      logger.warn('Database delete failed in PostgresPropertyRepository, deleted from fallback store', { propertyId: id });
    }
  }

  private mapToDomain(row: any): Property {
    const address = typeof row.address === 'string' ? JSON.parse(row.address) : row.address;
    const amenities = typeof row.amenities === 'string' ? JSON.parse(row.amenities) : (row.amenities || []);
    const emergencyContact = typeof row.emergency_contact === 'string' ? JSON.parse(row.emergency_contact) : row.emergency_contact;

    return Property.reconstruct({
      id: row.id,
      ownerId: row.owner_id,
      title: row.title,
      description: row.description,
      category: row.category,
      propertyType: row.property_type,
      status: row.status,
      address,
      areaSqFt: Number(row.area_sq_ft),
      amenities,
      emergencyContact,
      emergencyFloatLimit: Number(row.emergency_float_limit || 5000),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
