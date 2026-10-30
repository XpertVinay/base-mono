import { OrganizationMembership } from '../entities/organization-membership.entity.js';

export interface IOrganizationMembershipRepository {
  findById(id: string): Promise<OrganizationMembership | null>;
  findByOrgAndUser(organizationId: string, userId: string): Promise<OrganizationMembership | null>;
  findByUserId(userId: string): Promise<OrganizationMembership[]>;
  findByOrganizationId(organizationId: string): Promise<OrganizationMembership[]>;
  save(membership: OrganizationMembership): Promise<void>;
  delete(id: string): Promise<void>;
}

