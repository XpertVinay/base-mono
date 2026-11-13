import { Organization } from '../../domain/entities/organization.entity.js';
import {
  FindOrganizationsFilter,
  IOrganizationRepository
} from '../../domain/repositories/organization-repository.interface.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';
import {
  OrganizationAddress,
  OrganizationSettings,
  OrganizationStatus,
  OrganizationTier
} from '../../shared/contracts/index.js';

interface OrganizationDbRow {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  status: string;
  tier: string;
  industry: string | null;
  tax_id: string | null;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  address: any;
  settings: any;
  max_users: number;
  created_at: Date;
  updated_at: Date;
}

export class PostgresOrganizationRepository implements IOrganizationRepository {
  private toEntity(row: OrganizationDbRow): Organization {
    const address: OrganizationAddress | undefined =
      typeof row.address === 'object' && row.address !== null ? row.address : undefined;
    const settings: OrganizationSettings =
      typeof row.settings === 'object' && row.settings !== null ? row.settings : {};

    return Organization.reconstitute(
      {
        slug: row.slug,
        name: row.name,
        legalName: row.legal_name || undefined,
        status: row.status as OrganizationStatus,
        tier: row.tier as OrganizationTier,
        industry: row.industry || undefined,
        taxId: row.tax_id || undefined,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone || undefined,
        website: row.website || undefined,
        address,
        settings,
        maxUsers: row.max_users,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }

  async save(org: Organization): Promise<void> {
    const query = `
      INSERT INTO organizations.organizations (
        id, slug, name, legal_name, status, tier, industry, tax_id,
        contact_email, contact_phone, website, address, settings, max_users, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        legal_name = EXCLUDED.legal_name,
        status = EXCLUDED.status,
        tier = EXCLUDED.tier,
        industry = EXCLUDED.industry,
        tax_id = EXCLUDED.tax_id,
        contact_email = EXCLUDED.contact_email,
        contact_phone = EXCLUDED.contact_phone,
        website = EXCLUDED.website,
        address = EXCLUDED.address,
        settings = EXCLUDED.settings,
        max_users = EXCLUDED.max_users,
        updated_at = EXCLUDED.updated_at
    `;

    const values = [
      org.id,
      org.slug,
      org.name,
      org.legalName || null,
      org.status,
      org.tier,
      org.industry || null,
      org.taxId || null,
      org.contactEmail,
      org.contactPhone || null,
      org.website || null,
      JSON.stringify(org.address || {}),
      JSON.stringify(org.settings || {}),
      org.maxUsers,
      org.createdAt,
      org.updatedAt
    ];

    await dbPool.query(query, values);
  }

  async findById(id: string): Promise<Organization | null> {
    const query = `
      SELECT * FROM organizations.organizations
      WHERE id = $1
      LIMIT 1
    `;
    const res = await dbPool.query<OrganizationDbRow>(query, [id]);
    if (res.rows.length === 0) return null;
    return this.toEntity(res.rows[0]);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const sanitized = Organization.sanitizeSlug(slug);
    const query = `
      SELECT * FROM organizations.organizations
      WHERE slug = $1
      LIMIT 1
    `;
    const res = await dbPool.query<OrganizationDbRow>(query, [sanitized]);
    if (res.rows.length === 0) return null;
    return this.toEntity(res.rows[0]);
  }

  async findAll(filter: FindOrganizationsFilter): Promise<{ items: Organization[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter.search) {
      conditions.push(`(name ILIKE $${idx} OR slug ILIKE $${idx} OR contact_email ILIKE $${idx})`);
      values.push(`%${filter.search}%`);
      idx++;
    }

    if (filter.status) {
      conditions.push(`status = $${idx}`);
      values.push(filter.status);
      idx++;
    }

    if (filter.tier) {
      conditions.push(`tier = $${idx}`);
      values.push(filter.tier);
      idx++;
    }

    if (filter.industry) {
      conditions.push(`industry = $${idx}`);
      values.push(filter.industry);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total FROM organizations.organizations
      ${whereClause}
    `;
    const countRes = await dbPool.query<{ total: string }>(countQuery, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const page = Math.max(1, filter.page || 1);
    const offset = (page - 1) * limit;

    const dataQuery = `
      SELECT * FROM organizations.organizations
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await dbPool.query<OrganizationDbRow>(dataQuery, values);
    return {
      items: res.rows.map((r) => this.toEntity(r)),
      total
    };
  }

  async delete(id: string): Promise<boolean> {
    const res = await dbPool.query(`DELETE FROM organizations.organizations WHERE id = $1`, [id]);
    return (res.rowCount || 0) > 0;
  }

  async exists(id: string): Promise<boolean> {
    const res = await dbPool.query(`SELECT 1 FROM organizations.organizations WHERE id = $1 LIMIT 1`, [id]);
    return res.rows.length > 0;
  }

  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const sanitized = Organization.sanitizeSlug(slug);
    if (excludeId) {
      const res = await dbPool.query(
        `SELECT 1 FROM organizations.organizations WHERE slug = $1 AND id <> $2 LIMIT 1`,
        [sanitized, excludeId]
      );
      return res.rows.length > 0;
    }
    const res = await dbPool.query(
      `SELECT 1 FROM organizations.organizations WHERE slug = $1 LIMIT 1`,
      [sanitized]
    );
    return res.rows.length > 0;
  }
}
