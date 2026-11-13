import { OrganizationMember } from '../entities/organization-member.entity.js';
import { MemberRole, MemberStatus } from '../../shared/contracts/index.js';

export interface FindMembersFilter {
  role?: MemberRole;
  status?: MemberStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IOrganizationMemberRepository {
  save(member: OrganizationMember): Promise<void>;
  saveMember(member: OrganizationMember): Promise<void>;
  findById(id: string): Promise<OrganizationMember | null>;
  findByOrgAndUser(organizationId: string, userId: string): Promise<OrganizationMember | null>;
  findAllByOrg(organizationId: string, filter: FindMembersFilter): Promise<{ items: OrganizationMember[]; total: number }>;
  delete(id: string): Promise<boolean>;
  deleteByOrg(organizationId: string): Promise<number>;
  countByOrg(organizationId: string): Promise<number>;
}
