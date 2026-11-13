import { OrganizationMember } from '../../domain/entities/organization-member.entity.js';
import {
  FindMembersFilter,
  IOrganizationMemberRepository
} from '../../domain/repositories/organization-member-repository.interface.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';
import { MemberRole, MemberStatus } from '../../shared/contracts/index.js';

interface MemberDbRow {
  id: string;
  organization_id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  joined_at: Date;
  created_at: Date;
  updated_at: Date;
}

export class PostgresOrganizationMemberRepository implements IOrganizationMemberRepository {
  private toEntity(row: MemberDbRow): OrganizationMember {
    return OrganizationMember.reconstitute(
      {
        organizationId: row.organization_id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role as MemberRole,
        status: row.status as MemberStatus,
        joinedAt: new Date(row.joined_at),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }

  async save(member: OrganizationMember): Promise<void> {
    return this.saveMember(member);
  }

  async saveMember(member: OrganizationMember): Promise<void> {
    const query = `
      INSERT INTO organizations.organization_members (
        id, organization_id, user_id, email, name, role, status, joined_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `;

    const values = [
      member.id,
      member.organizationId,
      member.userId,
      member.email,
      member.name,
      member.role,
      member.status,
      member.joinedAt,
      member.createdAt,
      member.updatedAt
    ];

    await dbPool.query(query, values);
  }

  async findById(id: string): Promise<OrganizationMember | null> {
    const query = `
      SELECT * FROM organizations.organization_members
      WHERE id = $1
      LIMIT 1
    `;
    const res = await dbPool.query<MemberDbRow>(query, [id]);
    if (res.rows.length === 0) return null;
    return this.toEntity(res.rows[0]);
  }

  async findByOrgAndUser(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    const query = `
      SELECT * FROM organizations.organization_members
      WHERE organization_id = $1 AND user_id = $2
      LIMIT 1
    `;
    const res = await dbPool.query<MemberDbRow>(query, [organizationId, userId]);
    if (res.rows.length === 0) return null;
    return this.toEntity(res.rows[0]);
  }

  async findAllByOrg(
    organizationId: string,
    filter: FindMembersFilter
  ): Promise<{ items: OrganizationMember[]; total: number }> {
    const conditions: string[] = ['organization_id = $1'];
    const values: any[] = [organizationId];
    let idx = 2;

    if (filter.role) {
      conditions.push(`role = $${idx}`);
      values.push(filter.role);
      idx++;
    }

    if (filter.status) {
      conditions.push(`status = $${idx}`);
      values.push(filter.status);
      idx++;
    }

    if (filter.search) {
      conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
      values.push(`%${filter.search}%`);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countQuery = `
      SELECT COUNT(*) as total FROM organizations.organization_members
      ${whereClause}
    `;
    const countRes = await dbPool.query<{ total: string }>(countQuery, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const page = Math.max(1, filter.page || 1);
    const offset = (page - 1) * limit;

    const dataQuery = `
      SELECT * FROM organizations.organization_members
      ${whereClause}
      ORDER BY created_at ASC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await dbPool.query<MemberDbRow>(dataQuery, values);
    return {
      items: res.rows.map((r) => this.toEntity(r)),
      total
    };
  }

  async delete(id: string): Promise<boolean> {
    const res = await dbPool.query(
      `DELETE FROM organizations.organization_members WHERE id = $1`,
      [id]
    );
    return (res.rowCount || 0) > 0;
  }

  async deleteByOrg(organizationId: string): Promise<number> {
    const res = await dbPool.query(
      `DELETE FROM organizations.organization_members WHERE organization_id = $1`,
      [organizationId]
    );
    return res.rowCount || 0;
  }

  async countByOrg(organizationId: string): Promise<number> {
    const res = await dbPool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM organizations.organization_members WHERE organization_id = $1`,
      [organizationId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }
}
