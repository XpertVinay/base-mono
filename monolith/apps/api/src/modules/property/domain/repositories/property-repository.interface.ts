import { Property } from '../entities/property.entity.js';
import { PropertyUnit } from '../entities/unit.entity.js';
import { OwnershipSplit } from '../entities/ownership-split.entity.js';

export interface IPropertyRepository {
  findById(id: string, tenantId?: string): Promise<Property | null>;
  findByOwnerId(ownerId: string, tenantId?: string): Promise<Property[]>;
  findAll(tenantId?: string): Promise<Property[]>;
  save(property: Property): Promise<void>;
  update(property: Property): Promise<void>;
  delete(id: string, tenantId?: string): Promise<void>;

  // Units
  addUnit(unit: PropertyUnit): Promise<void>;
  findUnitById(unitId: string, tenantId?: string): Promise<PropertyUnit | null>;
  findUnitsByProperty(propertyId: string, tenantId?: string): Promise<PropertyUnit[]>;
  updateUnit(unit: PropertyUnit): Promise<void>;

  // Ownership Splits
  setOwnershipSplits(propertyId: string, splits: OwnershipSplit[], tenantId?: string): Promise<void>;
  getOwnershipSplits(propertyId: string, tenantId?: string): Promise<OwnershipSplit[]>;
}
