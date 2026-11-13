import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Organization } from '../src/domain/entities/organization.entity.js';
import { OrganizationMember } from '../src/domain/entities/organization-member.entity.js';
import {
  FindOrganizationsFilter,
  IOrganizationRepository
} from '../src/domain/repositories/organization-repository.interface.js';
import {
  FindMembersFilter,
  IOrganizationMemberRepository
} from '../src/domain/repositories/organization-member-repository.interface.js';
import {
  CreateOrganizationUseCase,
  GetOrganizationQuery,
  ListOrganizationsQuery,
  UpdateOrganizationUseCase,
  UpdateOrganizationStatusUseCase,
  DeleteOrganizationUseCase,
  AddOrganizationMemberUseCase,
  ListOrganizationMembersQuery,
  UpdateOrganizationMemberRoleUseCase,
  RemoveOrganizationMemberUseCase
} from '../src/application/use-cases/organization.use-cases.js';
import { createApp } from '../src/app.js';

// In-Memory Mock Repositories for Isolated Testing
class MockOrganizationRepository implements IOrganizationRepository {
  public organizations = new Map<string, Organization>();

  async save(org: Organization): Promise<void> {
    this.organizations.set(org.id, org);
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const sanitized = Organization.sanitizeSlug(slug);
    for (const org of this.organizations.values()) {
      if (org.slug === sanitized) return org;
    }
    return null;
  }

  async findAll(filter: FindOrganizationsFilter): Promise<{ items: Organization[]; total: number }> {
    let list = Array.from(this.organizations.values());

    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.slug.toLowerCase().includes(q) ||
          o.contactEmail.toLowerCase().includes(q)
      );
    }

    if (filter.status) {
      list = list.filter((o) => o.status === filter.status);
    }

    if (filter.tier) {
      list = list.filter((o) => o.tier === filter.tier);
    }

    if (filter.industry) {
      list = list.filter((o) => o.industry === filter.industry);
    }

    const total = list.length;
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const offset = (page - 1) * limit;
    const items = list.slice(offset, offset + limit);

    return { items, total };
  }

  async delete(id: string): Promise<boolean> {
    return this.organizations.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.organizations.has(id);
  }

  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const sanitized = Organization.sanitizeSlug(slug);
    for (const org of this.organizations.values()) {
      if (org.slug === sanitized && org.id !== excludeId) return true;
    }
    return false;
  }
}

class MockOrganizationMemberRepository implements IOrganizationMemberRepository {
  public members = new Map<string, OrganizationMember>();

  async saveMember(member: OrganizationMember): Promise<void> {
    this.members.set(member.id, member);
  }

  async findById(id: string): Promise<OrganizationMember | null> {
    return this.members.get(id) || null;
  }

  async findByOrgAndUser(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    for (const m of this.members.values()) {
      if (m.organizationId === organizationId && m.userId === userId) return m;
    }
    return null;
  }

  async findAllByOrg(
    organizationId: string,
    filter: FindMembersFilter
  ): Promise<{ items: OrganizationMember[]; total: number }> {
    let list = Array.from(this.members.values()).filter((m) => m.organizationId === organizationId);

    if (filter.role) {
      list = list.filter((m) => m.role === filter.role);
    }

    if (filter.status) {
      list = list.filter((m) => m.status === filter.status);
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
    }

    const total = list.length;
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const offset = (page - 1) * limit;
    const items = list.slice(offset, offset + limit);

    return { items, total };
  }

  async delete(id: string): Promise<boolean> {
    return this.members.delete(id);
  }

  async deleteByOrg(organizationId: string): Promise<number> {
    let count = 0;
    for (const [id, m] of this.members.entries()) {
      if (m.organizationId === organizationId) {
        this.members.delete(id);
        count++;
      }
    }
    return count;
  }

  async countByOrg(organizationId: string): Promise<number> {
    let count = 0;
    for (const m of this.members.values()) {
      if (m.organizationId === organizationId) count++;
    }
    return count;
  }
}

describe('Organization & Tenant Service Domain & Use Cases', () => {
  let orgRepo: MockOrganizationRepository;
  let memberRepo: MockOrganizationMemberRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    memberRepo = new MockOrganizationMemberRepository();
  });

  describe('Organization Entity Unit Tests', () => {
    test('should create organization with sanitized slug and valid defaults', () => {
      const org = Organization.create({
        name: 'Acme Global Services',
        slug: ' Acme-Global_Services! ',
        contactEmail: 'admin@acmeglobal.com',
        tier: 'STARTER'
      });

      assert.strictEqual(org.name, 'Acme Global Services');
      assert.strictEqual(org.slug, 'acme-global-services');
      assert.strictEqual(org.status, 'ACTIVE');
      assert.strictEqual(org.tier, 'STARTER');
      assert.strictEqual(org.maxUsers, 50);
      assert.strictEqual(org.settings.branding?.primaryColor, '#2563eb');
    });

    test('should reject invalid slug or contact email', () => {
      assert.throws(() => {
        Organization.create({
          name: 'Invalid Org',
          slug: '!!!',
          contactEmail: 'admin@test.com'
        });
      }, /Organization slug must be non-empty/);

      assert.throws(() => {
        Organization.create({
          name: 'Invalid Org',
          slug: 'valid-slug',
          contactEmail: 'invalid-email-string'
        });
      }, /A valid contact email is required/);
    });

    test('should validate allowed email domains according to security policy', () => {
      const org = Organization.create({
        name: 'Enterprise Corp',
        slug: 'enterprise-corp',
        contactEmail: 'ops@enterprisecorp.com',
        settings: {
          security: {
            allowedEmailDomains: ['enterprisecorp.com', 'partner.io']
          }
        }
      });

      assert.strictEqual(org.isEmailAllowed('alice@enterprisecorp.com'), true);
      assert.strictEqual(org.isEmailAllowed('bob@partner.io'), true);
      assert.strictEqual(org.isEmailAllowed('eve@malicious.com'), false);
    });

    test('should update details, status and settings safely', () => {
      const org = Organization.create({
        name: 'StartUp Alpha',
        slug: 'startup-alpha',
        contactEmail: 'info@alpha.com'
      });

      org.updateDetails({
        name: 'StartUp Beta',
        legalName: 'StartUp Beta Holdings LLC',
        industry: 'proptech'
      });
      assert.strictEqual(org.name, 'StartUp Beta');
      assert.strictEqual(org.legalName, 'StartUp Beta Holdings LLC');
      assert.strictEqual(org.industry, 'proptech');

      org.updateStatus('SUSPENDED');
      assert.strictEqual(org.status, 'SUSPENDED');

      org.updateSettings({
        branding: { primaryColor: '#10b981' },
        features: { auditLogs: true, sso: true }
      });
      assert.strictEqual(org.settings.branding?.primaryColor, '#10b981');
      assert.strictEqual(org.settings.features?.sso, true);
    });
  });

  describe('Organization Member Entity Unit Tests', () => {
    test('should create member and allow role and status updates', () => {
      const member = OrganizationMember.create({
        organizationId: 'org-123',
        userId: 'usr-456',
        email: 'dev@acme.com',
        name: 'John Developer',
        role: 'MEMBER'
      });

      assert.strictEqual(member.role, 'MEMBER');
      assert.strictEqual(member.status, 'ACTIVE');

      member.updateRole('ADMIN');
      assert.strictEqual(member.role, 'ADMIN');

      member.updateStatus('SUSPENDED');
      assert.strictEqual(member.status, 'SUSPENDED');
    });
  });

  describe('Organization CRUD Use Cases', () => {
    test('CreateOrganizationUseCase creates organization and assigns initial owner', async () => {
      const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);

      const result = await createUseCase.execute({
        name: 'Starlight Tech',
        slug: 'starlight-tech',
        contactEmail: 'contact@starlight.io',
        tier: 'PROFESSIONAL',
        initialOwner: {
          userId: 'usr-owner-1',
          email: 'founder@starlight.io',
          name: 'Jane Founder'
        }
      });

      assert.strictEqual(result.isSuccess, true);
      const org = result.getValue();
      assert.strictEqual(org.slug, 'starlight-tech');
      assert.strictEqual(org.tier, 'PROFESSIONAL');
      assert.strictEqual(org.maxUsers, 250);

      // Verify owner was created in member repo
      const owner = await memberRepo.findByOrgAndUser(org.id, 'usr-owner-1');
      assert.notStrictEqual(owner, null);
      assert.strictEqual(owner?.role, 'OWNER');
      assert.strictEqual(owner?.email, 'founder@starlight.io');
    });

    test('CreateOrganizationUseCase rejects duplicate slug', async () => {
      const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);

      await createUseCase.execute({
        name: 'Original Org',
        slug: 'unique-slug',
        contactEmail: 'a@test.com'
      });

      const duplicate = await createUseCase.execute({
        name: 'Another Org',
        slug: 'unique-slug',
        contactEmail: 'b@test.com'
      });

      assert.strictEqual(duplicate.isFailure, true);
      assert.match(duplicate.getError(), /already taken/);
    });

    test('GetOrganizationQuery fetches by ID or by slug', async () => {
      const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);
      const getQuery = new GetOrganizationQuery(orgRepo);

      const created = (
        await createUseCase.execute({
          name: 'Quantum Corp',
          slug: 'quantum-corp',
          contactEmail: 'admin@quantum.com'
        })
      ).getValue();

      const byId = await getQuery.execute(created.id);
      assert.strictEqual(byId.isSuccess, true);
      assert.strictEqual(byId.getValue().name, 'Quantum Corp');

      const bySlug = await getQuery.execute('quantum-corp');
      assert.strictEqual(bySlug.isSuccess, true);
      assert.strictEqual(bySlug.getValue().id, created.id);

      const notFound = await getQuery.execute('non-existent-org');
      assert.strictEqual(notFound.isFailure, true);
    });

    test('ListOrganizationsQuery searches and paginates correctly', async () => {
      const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);
      const listQuery = new ListOrganizationsQuery(orgRepo);

      await createUseCase.execute({ name: 'Alpha Logistics', slug: 'alpha-log', contactEmail: 'a@log.com', status: 'ACTIVE' });
      await createUseCase.execute({ name: 'Beta Health', slug: 'beta-health', contactEmail: 'b@health.com', status: 'SUSPENDED' });
      await createUseCase.execute({ name: 'Gamma Retail', slug: 'gamma-ret', contactEmail: 'c@ret.com', status: 'ACTIVE' });

      const all = await listQuery.execute({ page: 1, limit: 10 });
      assert.strictEqual(all.isSuccess, true);
      assert.strictEqual(all.getValue().items.length, 3);
      assert.strictEqual(all.getValue().pagination.total, 3);

      const activeOnly = await listQuery.execute({ status: 'ACTIVE' });
      assert.strictEqual(activeOnly.getValue().items.length, 2);

      const searched = await listQuery.execute({ search: 'health' });
      assert.strictEqual(searched.getValue().items.length, 1);
      assert.strictEqual(searched.getValue().items[0].slug, 'beta-health');
    });

    test('UpdateOrganizationUseCase updates fields and settings', async () => {
      const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);
      const updateUseCase = new UpdateOrganizationUseCase(orgRepo);

      const created = (
        await createUseCase.execute({
          name: 'Old Name',
          slug: 'org-update-test',
          contactEmail: 'contact@test.com'
        })
      ).getValue();

      const updated = await updateUseCase.execute({
        id: created.id,
        name: 'Brand New Name',
        industry: 'fintech',
        settings: {
          features: { sso: true }
        }
      });

      assert.strictEqual(updated.isSuccess, true);
      assert.strictEqual(updated.getValue().name, 'Brand New Name');
      assert.strictEqual(updated.getValue().industry, 'fintech');
      assert.strictEqual(updated.getValue().settings.features?.sso, true);
    });

    test('UpdateOrganizationStatusUseCase changes organization lifecycle state', async () => {
      const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);
      const statusUseCase = new UpdateOrganizationStatusUseCase(orgRepo);

      const created = (
        await createUseCase.execute({
          name: 'Status Org',
          slug: 'status-org',
          contactEmail: 'status@test.com'
        })
      ).getValue();

      const suspended = await statusUseCase.execute({ id: created.id, status: 'SUSPENDED' });
      assert.strictEqual(suspended.isSuccess, true);
      assert.strictEqual(suspended.getValue().status, 'SUSPENDED');
    });

    test('DeleteOrganizationUseCase prevents deleting default organization and deletes custom org', async () => {
      const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);
      const deleteUseCase = new DeleteOrganizationUseCase(orgRepo, memberRepo);

      // Seed default
      const defaultOrg = Organization.create({
        name: 'Default Org',
        slug: 'default',
        contactEmail: 'admin@default.internal'
      }, 'default');
      await orgRepo.save(defaultOrg);

      const cantDeleteDefault = await deleteUseCase.execute('default');
      assert.strictEqual(cantDeleteDefault.isFailure, true);
      assert.match(cantDeleteDefault.getError(), /Cannot delete default/);

      // Create custom org and delete it
      const custom = (
        await createUseCase.execute({
          name: 'Custom Org',
          slug: 'custom-to-delete',
          contactEmail: 'custom@test.com'
        })
      ).getValue();

      const deleted = await deleteUseCase.execute(custom.id);
      assert.strictEqual(deleted.isSuccess, true);
      assert.strictEqual(await orgRepo.exists(custom.id), false);
    });
  });

  describe('Organization Member Management Use Cases', () => {
    test('AddOrganizationMemberUseCase enforces domain security and tier max users limit', async () => {
      const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);
      const addMemberUseCase = new AddOrganizationMemberUseCase(orgRepo, memberRepo);

      const org = (
        await createUseCase.execute({
          name: 'Tight Ship Ltd',
          slug: 'tight-ship',
          contactEmail: 'captain@tightship.com',
          maxUsers: 2,
          settings: {
            security: { allowedEmailDomains: ['tightship.com'] }
          }
        })
      ).getValue();

      // Reject non-allowed email domain
      const badDomain = await addMemberUseCase.execute({
        organizationId: org.id,
        userId: 'usr-1',
        email: 'intruder@external.com',
        name: 'External User'
      });
      assert.strictEqual(badDomain.isFailure, true);
      assert.match(badDomain.getError(), /not authorized by organization policy/);

      // Add valid member 1
      const m1 = await addMemberUseCase.execute({
        organizationId: org.id,
        userId: 'usr-1',
        email: 'crew1@tightship.com',
        name: 'Crew Member One',
        role: 'OWNER'
      });
      assert.strictEqual(m1.isSuccess, true);

      // Add valid member 2
      const m2 = await addMemberUseCase.execute({
        organizationId: org.id,
        userId: 'usr-2',
        email: 'crew2@tightship.com',
        name: 'Crew Member Two',
        role: 'MEMBER'
      });
      assert.strictEqual(m2.isSuccess, true);

      // Attempt to exceed max users (limit is 2)
      const m3 = await addMemberUseCase.execute({
        organizationId: org.id,
        userId: 'usr-3',
        email: 'crew3@tightship.com',
        name: 'Crew Member Three'
      });
      assert.strictEqual(m3.isFailure, true);
      assert.match(m3.getError(), /Member limit reached/);
    });

    test('RemoveOrganizationMemberUseCase prevents removing sole OWNER', async () => {
      const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);
      const addMemberUseCase = new AddOrganizationMemberUseCase(orgRepo, memberRepo);
      const removeMemberUseCase = new RemoveOrganizationMemberUseCase(memberRepo);

      const org = (
        await createUseCase.execute({
          name: 'Ownership Org',
          slug: 'ownership-org',
          contactEmail: 'admin@ownership.com'
        })
      ).getValue();

      const owner = (
        await addMemberUseCase.execute({
          organizationId: org.id,
          userId: 'usr-sole-owner',
          email: 'owner@ownership.com',
          name: 'Sole Owner',
          role: 'OWNER'
        })
      ).getValue();

      const cannotRemove = await removeMemberUseCase.execute({
        organizationId: org.id,
        memberId: owner.id
      });
      assert.strictEqual(cannotRemove.isFailure, true);
      assert.match(cannotRemove.getError(), /Cannot remove the sole OWNER/);
    });
  });

  describe('HTTP App Integration Probes', () => {
    test('HTTP app boots and serves health probes', async () => {
      const { app } = createApp({ orgRepo, memberRepo });

      const headers: Record<string, any> = {};
      let responseData: any = null;
      let statusCode = 200;

      const mockRes: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: any) {
          responseData = payload;
          return this;
        },
        send(payload: any) {
          responseData = payload;
          return this;
        },
        end() {
          return this;
        },
        setHeader(name: string, value: any) {
          headers[name.toLowerCase()] = value;
          return this;
        },
        getHeader(name: string) {
          return headers[name.toLowerCase()];
        },
        removeHeader(name: string) {
          delete headers[name.toLowerCase()];
          return this;
        }
      };

      const mockReq: any = {
        method: 'GET',
        url: '/health',
        headers: {},
        query: {},
        params: {},
        socket: { remoteAddress: '127.0.0.1' }
      };

      (app as any).handle(mockReq, mockRes);

      assert.strictEqual(responseData?.status, 'UP');
      assert.strictEqual(responseData?.service, 'organization-service');
      assert.strictEqual(statusCode, 200);
    });
  });
});
