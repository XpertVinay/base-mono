import { Organization } from '../entities/organization.entity.js';
import { OrganizationStatus, OrganizationTier } from '../../shared/contracts/index.js';

export interface FindOrganizationsFilter {
  search?: string;
  status?: OrganizationStatus;
  tier?: OrganizationTier;
  industry?: string;
  page?: number;
  limit?: number;
}

export interface IOrganizationRepository {
  save(org: Organization): Promise<void>;
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  findAll(filter: FindOrganizationsFilter): Promise<{ items: Organization[]; total: number }>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
}
