import { Organization } from '../entities/organization.entity.js';

export interface IOrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  findByOwnerId(ownerUserId: string): Promise<Organization[]>;
  save(organization: Organization): Promise<void>;
  delete(id: string): Promise<void>;
}

