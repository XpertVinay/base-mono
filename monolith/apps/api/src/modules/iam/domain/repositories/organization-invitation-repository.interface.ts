import { OrganizationInvitation } from '../entities/organization-invitation.entity.js';

export interface IOrganizationInvitationRepository {
  findById(id: string): Promise<OrganizationInvitation | null>;
  findByToken(token: string): Promise<OrganizationInvitation | null>;
  findByOrganizationId(organizationId: string): Promise<OrganizationInvitation[]>;
  findByEmail(email: string): Promise<OrganizationInvitation[]>;
  save(invitation: OrganizationInvitation): Promise<void>;
  delete(id: string): Promise<void>;
}

