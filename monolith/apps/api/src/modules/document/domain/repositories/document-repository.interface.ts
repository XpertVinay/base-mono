import { PropertyDocument } from '../entities/property-document.entity.js';

export interface IDocumentRepository {
  save(doc: PropertyDocument): Promise<void>;
  update(doc: PropertyDocument): Promise<void>;
  findById(id: string): Promise<PropertyDocument | null>;
  findByPropertyId(propertyId: string): Promise<PropertyDocument[]>;
  delete(id: string): Promise<void>;
}
