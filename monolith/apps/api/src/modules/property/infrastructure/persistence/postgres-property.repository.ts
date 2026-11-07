import { IPropertyRepository } from '../../domain/repositories/property-repository.interface.js';
import { Property } from '../../domain/entities/property.entity.js';
import { PropertyUnit } from '../../domain/entities/unit.entity.js';
import { OwnershipSplit } from '../../domain/entities/ownership-split.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresPropertyRepository implements IPropertyRepository {
  private fallbackStore: Map<string, Property> = new Map();
  private unitsFallbackStore: Map<string, PropertyUnit> = new Map();
  private ownershipSplitsFallbackStore: Map<string, OwnershipSplit[]> = new Map();

  async findById(id: string, tenantId?: string): Promise<Property | null> {
    try {
      let sql = `
        SELECT id, tenant_id, owner_id, title, description, category, property_type, status,
               address, area_sq_ft, amenities, emergency_contact, emergency_float_limit,
               created_at, updated_at
        FROM property.properties WHERE id = $1
      `;
      const params: any[] = [id];

      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) return this.getFromFallback(id, tenantId);
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.getFromFallback(id, tenantId);
    }
  }

  async findByOwnerId(ownerId: string, tenantId?: string): Promise<Property[]> {
    try {
      let sql = `
        SELECT id, tenant_id, owner_id, title, description, category, property_type, status,
               address, area_sq_ft, amenities, emergency_contact, emergency_float_limit,
               created_at, updated_at
        FROM property.properties WHERE owner_id = $1
      `;
      const params: any[] = [ownerId];

      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }

      sql += ' ORDER BY created_at DESC';

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.findByOwnerInFallback(ownerId, tenantId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return this.findByOwnerInFallback(ownerId, tenantId);
    }
  }

  async findAll(tenantId?: string): Promise<Property[]> {
    try {
      let sql = `
        SELECT id, tenant_id, owner_id, title, description, category, property_type, status,
               address, area_sq_ft, amenities, emergency_contact, emergency_float_limit,
               created_at, updated_at
        FROM property.properties
      `;
      const params: any[] = [];

      if (tenantId) {
        sql += ' WHERE (tenant_id = $1 OR tenant_id IS NULL)';
        params.push(tenantId);
      }

      sql += ' ORDER BY created_at DESC';

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.findAllInFallback(tenantId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return this.findAllInFallback(tenantId);
    }
  }

  async save(property: Property): Promise<void> {
    this.fallbackStore.set(property.id, this.cloneProperty(property));
    try {
      await dbPool.query(
        `INSERT INTO property.properties (
          id, tenant_id, owner_id, title, description, category, property_type, status,
          address, area_sq_ft, amenities, emergency_contact, emergency_float_limit,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
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
          property.tenantId || null,
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

  async delete(id: string, tenantId?: string): Promise<void> {
    const existing = this.fallbackStore.get(id);
    if (existing && (!tenantId || existing.tenantId === tenantId)) {
      this.fallbackStore.delete(id);
    }
    try {
      let sql = 'DELETE FROM property.properties WHERE id = $1';
      const params: any[] = [id];
      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }
      await dbPool.query(sql, params);
    } catch {
      logger.warn('Database delete failed in PostgresPropertyRepository, deleted from fallback store', { propertyId: id });
    }
  }

  // ---------------------------------------------------------------------------
  // UNITS
  // ---------------------------------------------------------------------------
  async addUnit(unit: PropertyUnit): Promise<void> {
    this.unitsFallbackStore.set(unit.id, this.cloneUnit(unit));
    try {
      await dbPool.query(
        `INSERT INTO property.units (id, property_id, tenant_id, unit_number, floor, status, rent_amount, deposit_amount, area_sq_ft, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           rent_amount = EXCLUDED.rent_amount,
           deposit_amount = EXCLUDED.deposit_amount,
           area_sq_ft = EXCLUDED.area_sq_ft`,
        [
          unit.id,
          unit.propertyId,
          unit.tenantId || null,
          unit.unitNumber,
          unit.floor,
          unit.status,
          unit.rentAmount,
          unit.depositAmount,
          unit.areaSqFt,
          unit.createdAt
        ]
      );
    } catch {
      logger.warn('Database insert failed for unit, stored in fallback store', { unitId: unit.id });
    }
  }

  async findUnitById(unitId: string, tenantId?: string): Promise<PropertyUnit | null> {
    try {
      let sql = 'SELECT id, property_id, tenant_id, unit_number, floor, status, rent_amount, deposit_amount, area_sq_ft, created_at FROM property.units WHERE id = $1';
      const params: any[] = [unitId];

      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) return this.getUnitFromFallback(unitId, tenantId);
      return this.mapUnitToDomain(res.rows[0]);
    } catch {
      return this.getUnitFromFallback(unitId, tenantId);
    }
  }

  async findUnitsByProperty(propertyId: string, tenantId?: string): Promise<PropertyUnit[]> {
    try {
      let sql = 'SELECT id, property_id, tenant_id, unit_number, floor, status, rent_amount, deposit_amount, area_sq_ft, created_at FROM property.units WHERE property_id = $1';
      const params: any[] = [propertyId];

      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }

      sql += ' ORDER BY unit_number ASC';

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.findUnitsByPropertyInFallback(propertyId, tenantId);
      }
      return res.rows.map(this.mapUnitToDomain);
    } catch {
      return this.findUnitsByPropertyInFallback(propertyId, tenantId);
    }
  }

  async updateUnit(unit: PropertyUnit): Promise<void> {
    await this.addUnit(unit);
  }

  // ---------------------------------------------------------------------------
  // OWNERSHIP SPLITS
  // ---------------------------------------------------------------------------
  async setOwnershipSplits(propertyId: string, splits: OwnershipSplit[], tenantId?: string): Promise<void> {
    this.ownershipSplitsFallbackStore.set(propertyId, splits.map(s => this.cloneSplit(s)));

    try {
      // Clear existing splits
      let deleteSql = 'DELETE FROM property.ownership_splits WHERE property_id = $1';
      const deleteParams: any[] = [propertyId];
      if (tenantId) {
        deleteSql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        deleteParams.push(tenantId);
      }
      await dbPool.query(deleteSql, deleteParams);

      for (const split of splits) {
        await dbPool.query(
          `INSERT INTO property.ownership_splits (id, property_id, tenant_id, owner_id, share_percentage, disbursement_account, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            split.id,
            split.propertyId,
            split.tenantId || null,
            split.ownerId,
            split.sharePercentage,
            split.disbursementAccount || null,
            split.createdAt
          ]
        );
      }
    } catch {
      logger.warn('Database save failed for ownership splits, stored in fallback store', { propertyId });
    }
  }

  async getOwnershipSplits(propertyId: string, tenantId?: string): Promise<OwnershipSplit[]> {
    try {
      let sql = 'SELECT id, property_id, tenant_id, owner_id, share_percentage, disbursement_account, created_at FROM property.ownership_splits WHERE property_id = $1';
      const params: any[] = [propertyId];

      if (tenantId) {
        sql += ' AND (tenant_id = $2 OR tenant_id IS NULL)';
        params.push(tenantId);
      }

      sql += ' ORDER BY share_percentage DESC';

      const res = await dbPool.query(sql, params);
      if (res.rows.length === 0) {
        return this.getOwnershipSplitsFromFallback(propertyId, tenantId);
      }
      return res.rows.map(r => OwnershipSplit.reconstruct({
        id: r.id,
        propertyId: r.property_id,
        tenantId: r.tenant_id || undefined,
        ownerId: r.owner_id,
        sharePercentage: Number(r.share_percentage),
        disbursementAccount: r.disbursement_account || undefined,
        createdAt: new Date(r.created_at)
      }));
    } catch {
      return this.getOwnershipSplitsFromFallback(propertyId, tenantId);
    }
  }

  // ---------------------------------------------------------------------------
  // FALLBACK HELPERS
  // ---------------------------------------------------------------------------
  private getFromFallback(id: string, tenantId?: string): Property | null {
    const item = this.fallbackStore.get(id);
    if (!item) return null;
    if (tenantId && item.tenantId && item.tenantId !== tenantId) return null;
    return this.cloneProperty(item);
  }

  private findByOwnerInFallback(ownerId: string, tenantId?: string): Property[] {
    const results: Property[] = [];
    for (const p of this.fallbackStore.values()) {
      if (p.ownerId === ownerId) {
        if (!tenantId || !p.tenantId || p.tenantId === tenantId) {
          results.push(this.cloneProperty(p));
        }
      }
    }
    return results;
  }

  private findAllInFallback(tenantId?: string): Property[] {
    const results: Property[] = [];
    for (const p of this.fallbackStore.values()) {
      if (!tenantId || !p.tenantId || p.tenantId === tenantId) {
        results.push(this.cloneProperty(p));
      }
    }
    return results;
  }

  private getUnitFromFallback(unitId: string, tenantId?: string): PropertyUnit | null {
    const unit = this.unitsFallbackStore.get(unitId);
    if (!unit) return null;
    if (tenantId && unit.tenantId && unit.tenantId !== tenantId) return null;
    return this.cloneUnit(unit);
  }

  private findUnitsByPropertyInFallback(propertyId: string, tenantId?: string): PropertyUnit[] {
    const results: PropertyUnit[] = [];
    for (const u of this.unitsFallbackStore.values()) {
      if (u.propertyId === propertyId) {
        if (!tenantId || !u.tenantId || u.tenantId === tenantId) {
          results.push(this.cloneUnit(u));
        }
      }
    }
    return results;
  }

  private getOwnershipSplitsFromFallback(propertyId: string, tenantId?: string): OwnershipSplit[] {
    const splits = this.ownershipSplitsFallbackStore.get(propertyId) || [];
    return splits
      .filter(s => !tenantId || !s.tenantId || s.tenantId === tenantId)
      .map(s => this.cloneSplit(s));
  }

  private cloneProperty(p: Property): Property {
    return Property.reconstruct({
      id: p.id,
      tenantId: p.tenantId,
      ownerId: p.ownerId,
      title: p.title,
      description: p.description,
      category: p.category,
      propertyType: p.propertyType,
      status: p.status,
      address: { ...p.address },
      areaSqFt: p.areaSqFt,
      amenities: [...p.amenities],
      emergencyContact: { ...p.emergencyContact },
      emergencyFloatLimit: p.emergencyFloatLimit,
      createdAt: new Date(p.createdAt.getTime()),
      updatedAt: new Date(p.updatedAt.getTime())
    });
  }

  private cloneUnit(u: PropertyUnit): PropertyUnit {
    return PropertyUnit.reconstruct({
      id: u.id,
      propertyId: u.propertyId,
      tenantId: u.tenantId,
      unitNumber: u.unitNumber,
      floor: u.floor,
      status: u.status,
      rentAmount: u.rentAmount,
      depositAmount: u.depositAmount,
      areaSqFt: u.areaSqFt,
      createdAt: new Date(u.createdAt.getTime())
    });
  }

  private cloneSplit(s: OwnershipSplit): OwnershipSplit {
    return OwnershipSplit.reconstruct({
      id: s.id,
      propertyId: s.propertyId,
      tenantId: s.tenantId,
      ownerId: s.ownerId,
      sharePercentage: s.sharePercentage,
      disbursementAccount: s.disbursementAccount,
      createdAt: new Date(s.createdAt.getTime())
    });
  }

  private mapToDomain(row: any): Property {
    const address = typeof row.address === 'string' ? JSON.parse(row.address) : row.address;
    const amenities = typeof row.amenities === 'string' ? JSON.parse(row.amenities) : (row.amenities || []);
    const emergencyContact = typeof row.emergency_contact === 'string' ? JSON.parse(row.emergency_contact) : row.emergency_contact;

    return Property.reconstruct({
      id: row.id,
      tenantId: row.tenant_id || undefined,
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

  private mapUnitToDomain(row: any): PropertyUnit {
    return PropertyUnit.reconstruct({
      id: row.id,
      propertyId: row.property_id,
      tenantId: row.tenant_id || undefined,
      unitNumber: row.unit_number,
      floor: Number(row.floor),
      status: row.status,
      rentAmount: Number(row.rent_amount),
      depositAmount: Number(row.deposit_amount),
      areaSqFt: Number(row.area_sq_ft),
      createdAt: new Date(row.created_at)
    });
  }
}
