import { Property } from '../entities/property.entity.js';

export interface IPropertyRepository {
  findById(id: string): Promise<Property | null>;
  findByOwnerId(ownerId: string): Promise<Property[]>;
  findAll(): Promise<Property[]>;
  save(property: Property): Promise<void>;
  update(property: Property): Promise<void>;
  delete(id: string): Promise<void>;
}
