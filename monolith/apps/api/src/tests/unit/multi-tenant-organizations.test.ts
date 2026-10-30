import { describe, it, expect, beforeEach } from 'vitest';
import { Organization } from '../../modules/iam/domain/entities/organization.entity.js';
import { OrganizationMembership } from '../../modules/iam/domain/entities/organization-membership.entity.js';
import { OrganizationInvitation } from '../../modules/iam/domain/entities/organization-invitation.entity.js';
import { PostgresOrganizationRepository } from '../../modules/iam/infrastructure/persistence/postgres-organization.repository.js';
import { PostgresOrganizationMembershipRepository } from '../../modules/iam/infrastructure/persistence/postgres-organization-membership.repository.js';
import { PostgresOrganizationInvitationRepository } from '../../modules/iam/infrastructure/persistence/postgres-organization-invitation.repository.js';
import { PostgresUserRepository } from '../../modules/iam/infrastructure/persistence/postgres-user.repository.js';
import { User } from '../../modules/iam/domain/entities/user.entity.js';
import { Password } from '../../modules/iam/domain/value-objects/password.vo.js';

import { CreateOrganizationUseCase } from '../../modules/iam/application/commands/organization/create-organization.use-case.js';
import { UpdateOrganizationUseCase } from '../../modules/iam/application/commands/organization/update-organization.use-case.js';
import { UpdateOrganizationStatusUseCase } from '../../modules/iam/application/commands/organization/update-organization-status.use-case.js';
import { InviteMemberUseCase } from '../../modules/iam/application/commands/organization/invite-member.use-case.js';
import { AcceptInvitationUseCase } from '../../modules/iam/application/commands/organization/accept-invitation.use-case.js';
import { RejectInvitationUseCase } from '../../modules/iam/application/commands/organization/reject-invitation.use-case.js';
import { RequestMembershipUseCase } from '../../modules/iam/application/commands/organization/request-membership.use-case.js';
import { UpdateMembershipUseCase } from '../../modules/iam/application/commands/organization/update-membership.use-case.js';
import { RemoveMemberUseCase } from '../../modules/iam/application/commands/organization/remove-member.use-case.js';
import { GetOrganizationQuery } from '../../modules/iam/application/queries/organization/get-organization.query.js';
import { ListUserOrganizationsQuery } from '../../modules/iam/application/queries/organization/list-user-organizations.query.js';
import { ListOrganizationMembersQuery } from '../../modules/iam/application/queries/organization/list-organization-members.query.js';
import { ListOrganizationInvitationsQuery } from '../../modules/iam/application/queries/organization/list-organization-invitations.query.js';
import { ValidateTenantContextQuery } from '../../modules/iam/application/queries/organization/validate-tenant-context.query.js';
import { requireTenantMembership, requireOrgAdmin } from '../../modules/iam/presentation/middleware/tenant-context.middleware.js';
import { ForbiddenError, ConflictError, BadRequestError } from '../../shared/presentation/error-handler.middleware.js';

describe('Sprint 03: Multi-Tenant Organization & Membership Management', () => {
  let orgRepo: PostgresOrganizationRepository;
  let membershipRepo: PostgresOrganizationMembershipRepository;
  let invitationRepo: PostgresOrganizationInvitationRepository;
  let userRepo: PostgresUserRepository;

  let createOrgUseCase: CreateOrganizationUseCase;
  let updateOrgUseCase: UpdateOrganizationUseCase;
  let updateOrgStatusUseCase: UpdateOrganizationStatusUseCase;
  let inviteMemberUseCase: InviteMemberUseCase;
  let acceptInvitationUseCase: AcceptInvitationUseCase;
  let rejectInvitationUseCase: RejectInvitationUseCase;
  let requestMembershipUseCase: RequestMembershipUseCase;
  let updateMembershipUseCase: UpdateMembershipUseCase;
  let removeMemberUseCase: RemoveMemberUseCase;

  let getOrgQuery: GetOrganizationQuery;
  let listUserOrgsQuery: ListUserOrganizationsQuery;
  let listOrgMembersQuery: ListOrganizationMembersQuery;
  let listOrgInvitationsQuery: ListOrganizationInvitationsQuery;
  let validateTenantContextQuery: ValidateTenantContextQuery;

  const testUserOwner = {
    id: 'user-org-owner-1',
    email: 'owner@estates.org',
    name: 'Alice Owner',
    role: 'OWNER' as const
  };

  const testUserMember = {
    id: 'user-org-member-2',
    email: 'bob.caretaker@estates.org',
    name: 'Bob Caretaker',
    role: 'CARETAKER' as const
  };

  const testUserExternal = {
    id: 'user-external-3',
    email: 'charlie.outsider@other.org',
    name: 'Charlie Outsider',
    role: 'USER' as const
  };

  beforeEach(async () => {
    orgRepo = new PostgresOrganizationRepository();
    membershipRepo = new PostgresOrganizationMembershipRepository();
    invitationRepo = new PostgresOrganizationInvitationRepository();
    userRepo = new PostgresUserRepository();

    // Seed mock users
    await userRepo.save(User.create(
      testUserOwner.email,
      Password.fromHashed('dummy-hash'),
      testUserOwner.name,
      testUserOwner.role,
      testUserOwner.id
    ));

    await userRepo.save(User.create(
      testUserMember.email,
      Password.fromHashed('dummy-hash'),
      testUserMember.name,
      testUserMember.role,
      testUserMember.id
    ));

    await userRepo.save(User.create(
      testUserExternal.email,
      Password.fromHashed('dummy-hash'),
      testUserExternal.name,
      testUserExternal.role,
      testUserExternal.id
    ));

    // Instantiate use cases and queries
    createOrgUseCase = new CreateOrganizationUseCase(orgRepo, membershipRepo);
    updateOrgUseCase = new UpdateOrganizationUseCase(orgRepo, membershipRepo);
    updateOrgStatusUseCase = new UpdateOrganizationStatusUseCase(orgRepo, membershipRepo);
    inviteMemberUseCase = new InviteMemberUseCase(orgRepo, membershipRepo, invitationRepo);
    acceptInvitationUseCase = new AcceptInvitationUseCase(invitationRepo, membershipRepo, orgRepo);
    rejectInvitationUseCase = new RejectInvitationUseCase(invitationRepo);
    requestMembershipUseCase = new RequestMembershipUseCase(orgRepo, membershipRepo);
    updateMembershipUseCase = new UpdateMembershipUseCase(orgRepo, membershipRepo);
    removeMemberUseCase = new RemoveMemberUseCase(orgRepo, membershipRepo);

    getOrgQuery = new GetOrganizationQuery(orgRepo, membershipRepo);
    listUserOrgsQuery = new ListUserOrganizationsQuery(membershipRepo, orgRepo);
    listOrgMembersQuery = new ListOrganizationMembersQuery(membershipRepo, userRepo);
    listOrgInvitationsQuery = new ListOrganizationInvitationsQuery(invitationRepo, membershipRepo);
    validateTenantContextQuery = new ValidateTenantContextQuery(orgRepo, membershipRepo);
  });

  describe('1. Organization Lifecycle & Administration', () => {
    it('creates an organization and automatically associates creator as an active ADMIN member', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Apex Real Estate Holdings',
        slug: 'apex-holdings',
        type: 'PROPERTY_MANAGEMENT',
        metadata: { licenseNumber: 'KA-RERA-2026-901' }
      });

      expect(org.id).toBeDefined();
      expect(org.name).toBe('Apex Real Estate Holdings');
      expect(org.slug).toBe('apex-holdings');
      expect(org.status).toBe('ACTIVE');
      expect(org.ownerUserId).toBe(testUserOwner.id);

      const orgEntity = await orgRepo.findById(org.id);
      expect(orgEntity).toBeInstanceOf(Organization);

      // Verify membership was created with ADMIN role and ACTIVE status
      const membership = await membershipRepo.findByOrgAndUser(org.id, testUserOwner.id);
      expect(membership).toBeDefined();
      expect(membership?.role).toBe('ADMIN');
      expect(membership?.status).toBe('ACTIVE');
      expect(membership?.joinedAt).toBeDefined();
    });

    it('rejects duplicate organization slugs', async () => {
      await createOrgUseCase.execute(testUserOwner.id, {
        name: 'First Org',
        slug: 'unique-slug'
      });

      await expect(
        createOrgUseCase.execute(testUserMember.id, {
          name: 'Second Org',
          slug: 'unique-slug'
        })
      ).rejects.toThrow(ConflictError);
    });

    it('allows organization admin to update organization profile', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Initial Name',
        slug: 'profile-org'
      });

      const updated = await updateOrgUseCase.execute(testUserOwner.id, org.id, {
        name: 'Updated Name',
        type: 'ENTERPRISE',
        metadata: { brandingColor: '#10B981' }
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.type).toBe('ENTERPRISE');
      expect(updated.metadata?.brandingColor).toBe('#10B981');
    });

    it('prevents non-admin member from modifying organization profile', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Protected Org',
        slug: 'protected-org'
      });

      // Add user as regular member
      await membershipRepo.save(new OrganizationMembership({
        id: 'mem-regular',
        organizationId: org.id,
        userId: testUserMember.id,
        role: 'MEMBER',
        status: 'ACTIVE'
      }));

      await expect(
        updateOrgUseCase.execute(testUserMember.id, org.id, { name: 'Hacked Name' })
      ).rejects.toThrow(ForbiddenError);
    });

    it('updates organization lifecycle status (ACTIVE -> SUSPENDED -> ARCHIVED)', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Lifecycle Org',
        slug: 'lifecycle-org'
      });

      const suspended = await updateOrgStatusUseCase.execute(testUserOwner.id, false, org.id, { status: 'SUSPENDED' });
      expect(suspended.status).toBe('SUSPENDED');

      const archived = await updateOrgStatusUseCase.execute(testUserOwner.id, false, org.id, { status: 'ARCHIVED' });
      expect(archived.status).toBe('ARCHIVED');
    });
  });

  describe('2. Multi-Organization Support Per User', () => {
    it('supports multiple organizations per user without duplicating identities', async () => {
      const orgA = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Bangalore Properties Org',
        slug: 'blr-properties'
      });

      const orgB = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Mysore Commercial Assets',
        slug: 'mys-commercial'
      });

      const userOrgs = await listUserOrgsQuery.execute(testUserOwner.id);
      expect(userOrgs.length).toBe(2);
      expect(userOrgs.map(o => o.organizationId)).toContain(orgA.id);
      expect(userOrgs.map(o => o.organizationId)).toContain(orgB.id);

      // Verify single platform identity preserved
      const user = await userRepo.findById(testUserOwner.id);
      expect(user?.email).toBe(testUserOwner.email);
    });
  });

  describe('3. Invitation & Membership Request Workflows', () => {
    it('executes invitation flow: admin invites email -> user accepts -> becomes active member', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Invitation Test Org',
        slug: 'inv-test-org'
      });

      // 1. Admin creates invitation
      const invitation = await inviteMemberUseCase.execute(testUserOwner.id, org.id, {
        email: testUserMember.email,
        role: 'MEMBER',
        expiresInDays: 3
      });

      expect(invitation.status).toBe('PENDING');
      expect(invitation.token).toBeDefined();

      // Verify admin can list invitations
      const pendingInvs = await listOrgInvitationsQuery.execute(testUserOwner.id, org.id);
      expect(pendingInvs.length).toBeGreaterThan(0);
      expect(pendingInvs[0]?.invitedEmail).toBe(testUserMember.email);

      // 2. Member accepts invitation using token
      const membership = await acceptInvitationUseCase.execute(testUserMember.id, invitation.token!);
      expect(membership.status).toBe('ACTIVE');
      expect(membership.role).toBe('MEMBER');
      expect(membership.organizationId).toBe(org.id);

      // 3. Verify invitation status updated to ACCEPTED
      const updatedInv = await invitationRepo.findById(invitation.id);
      expect(updatedInv?.status).toBe('ACCEPTED');

      // 4. Verify member is listed in organization members
      const members = await listOrgMembersQuery.execute(testUserOwner.id, org.id);
      expect(members.some(m => m.userId === testUserMember.id)).toBe(true);
    });

    it('allows a user to reject an invitation', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Reject Inv Org',
        slug: 'reject-inv-org'
      });

      const invitation = await inviteMemberUseCase.execute(testUserOwner.id, org.id, {
        email: 'rejectme@test.com'
      });

      const rejected = await rejectInvitationUseCase.execute(invitation.token!);
      expect(rejected.status).toBe('REJECTED');
    });

    it('rejects expired invitations', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Expired Inv Org',
        slug: 'expired-inv-org'
      });

      const expiredInvitation = new OrganizationInvitation({
        id: 'inv-expired',
        organizationId: org.id,
        invitedEmail: 'late@user.com',
        invitedByUserId: testUserOwner.id,
        role: 'MEMBER',
        token: 'expired-token-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 3600 * 1000) // 1 hour ago
      });
      await invitationRepo.save(expiredInvitation);

      await expect(
        acceptInvitationUseCase.execute(testUserMember.id, 'expired-token-123')
      ).rejects.toThrow('Invitation has expired');
    });

    it('executes membership join request workflow: request -> approve -> active', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Join Request Org',
        slug: 'join-request-org'
      });

      // 1. External user requests to join
      const joinReq = await requestMembershipUseCase.execute(testUserExternal.id, org.id);
      expect(joinReq.status).toBe('PENDING');

      // 2. Admin approves request
      const approved = await updateMembershipUseCase.execute(
        testUserOwner.id,
        org.id,
        testUserExternal.id,
        { status: 'ACTIVE' }
      );
      expect(approved.status).toBe('ACTIVE');

      // 3. Verify active membership exists
      const mem = await membershipRepo.findByOrgAndUser(org.id, testUserExternal.id);
      expect(mem?.isActive()).toBe(true);
    });

    it('allows admin to suspend, reactivate, and remove a member', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Suspension Test Org',
        slug: 'suspension-test-org'
      });

      // Add member
      await membershipRepo.save(new OrganizationMembership({
        id: 'mem-to-suspend',
        organizationId: org.id,
        userId: testUserMember.id,
        role: 'MEMBER',
        status: 'ACTIVE'
      }));

      // 1. Suspend member
      const suspended = await updateMembershipUseCase.execute(
        testUserOwner.id,
        org.id,
        testUserMember.id,
        { status: 'SUSPENDED' }
      );
      expect(suspended.status).toBe('SUSPENDED');

      // 2. Reactivate member
      const reactivated = await updateMembershipUseCase.execute(
        testUserOwner.id,
        org.id,
        testUserMember.id,
        { status: 'ACTIVE' }
      );
      expect(reactivated.status).toBe('ACTIVE');

      // 3. Remove member
      await removeMemberUseCase.execute(testUserOwner.id, org.id, testUserMember.id);
      const afterRemoval = await membershipRepo.findByOrgAndUser(org.id, testUserMember.id);
      expect(afterRemoval).toBeNull();
    });

    it('prevents demoting or suspending the primary organization owner', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Owner Protection Org',
        slug: 'owner-prot-org'
      });

      // Another admin tries to suspend owner
      await membershipRepo.save(new OrganizationMembership({
        id: 'mem-admin-2',
        organizationId: org.id,
        userId: testUserMember.id,
        role: 'ADMIN',
        status: 'ACTIVE'
      }));

      await expect(
        updateMembershipUseCase.execute(testUserMember.id, org.id, testUserOwner.id, { status: 'SUSPENDED' })
      ).rejects.toThrow(BadRequestError);

      await expect(
        removeMemberUseCase.execute(testUserMember.id, org.id, testUserOwner.id)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('4. Mandatory Security Tests & Tenant Isolation', () => {
    let orgA: any;
    let orgB: any;

    beforeEach(async () => {
      // Organization A owned by Alice
      orgA = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Organization Alpha',
        slug: 'org-alpha'
      });

      // Organization B owned by Charlie
      orgB = await createOrgUseCase.execute(testUserExternal.id, {
        name: 'Organization Beta',
        slug: 'org-beta'
      });

      // Bob is an active member of Organization A ONLY
      await membershipRepo.save(new OrganizationMembership({
        id: 'bob-mem-a',
        organizationId: orgA.id,
        userId: testUserMember.id,
        role: 'MEMBER',
        status: 'ACTIVE'
      }));
    });

    it('Security Test 1: User cannot access an organization without membership', async () => {
      // Bob is NOT a member of Org B
      await expect(
        getOrgQuery.execute(orgB.id, testUserMember.id, false)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        validateTenantContextQuery.execute(testUserMember.id, orgB.id)
      ).rejects.toThrow('User is not a member of organization');
    });

    it('Security Test 2: Suspended members cannot perform protected operations or access tenant context', async () => {
      // Suspend Bob in Org A
      await updateMembershipUseCase.execute(
        testUserOwner.id,
        orgA.id,
        testUserMember.id,
        { status: 'SUSPENDED' }
      );

      // Attempting to resolve active tenant context for Org A should fail
      await expect(
        validateTenantContextQuery.execute(testUserMember.id, orgA.id)
      ).rejects.toThrow('User membership in organization \'Organization Alpha\' is suspended');

      // Attempting to get organization details should be forbidden
      await expect(
        getOrgQuery.execute(orgA.id, testUserMember.id, false)
      ).rejects.toThrow(ForbiddenError);
    });

    it('Security Test 3: Organization A members cannot read or modify Organization B records', async () => {
      // Bob (member of Org A) tries to update Org B
      await expect(
        updateOrgUseCase.execute(testUserMember.id, orgB.id, { name: 'Malicious Rename' })
      ).rejects.toThrow(ForbiddenError);

      // Alice (Admin of Org A) tries to invite someone to Org B
      await expect(
        inviteMemberUseCase.execute(testUserOwner.id, orgB.id, { email: 'victim@target.com' })
      ).rejects.toThrow(ForbiddenError);

      // Alice tries to list members of Org B
      await expect(
        listOrgMembersQuery.execute(testUserOwner.id, orgB.id)
      ).rejects.toThrow(ForbiddenError);
    });

    it('Security Test 4: Changing organization identifiers cannot bypass authorization', async () => {
      // Middleware test: Bob passes orgB identifier in X-Tenant-ID header
      const middleware = requireTenantMembership(validateTenantContextQuery);

      const fakeReq: any = {
        user: { id: testUserMember.id, role: 'CARETAKER', email: testUserMember.email },
        headers: { 'x-tenant-id': orgB.id },
        params: {}
      };
      const fakeRes: any = {};
      let capturedError: any = null;

      await middleware(fakeReq, fakeRes, (err?: any) => {
        capturedError = err;
      });

      expect(capturedError).toBeDefined();
      expect(capturedError).toBeInstanceOf(ForbiddenError);
      expect(capturedError.message).toContain('User is not a member of organization');
    });

    it('Security Test 5: Users can access multiple organizations through their authorized memberships', async () => {
      // Give Bob an authorized membership in Org B as well
      await membershipRepo.save(new OrganizationMembership({
        id: 'bob-mem-b',
        organizationId: orgB.id,
        userId: testUserMember.id,
        role: 'ADMIN',
        status: 'ACTIVE'
      }));

      // Bob can resolve context for Org A
      const contextA = await validateTenantContextQuery.execute(testUserMember.id, orgA.id);
      expect(contextA.activeOrganization.id).toBe(orgA.id);
      expect(contextA.membership.role).toBe('MEMBER');
      expect(contextA.isAdmin).toBe(false);

      // Bob can resolve context for Org B
      const contextB = await validateTenantContextQuery.execute(testUserMember.id, orgB.id);
      expect(contextB.activeOrganization.id).toBe(orgB.id);
      expect(contextB.membership.role).toBe('ADMIN');
      expect(contextB.isAdmin).toBe(true);

      // User organization list reflects both authorized memberships
      const memberships = await listUserOrgsQuery.execute(testUserMember.id);
      expect(memberships.length).toBe(2);
      expect(memberships.map(m => m.organizationId)).toContain(orgA.id);
      expect(memberships.map(m => m.organizationId)).toContain(orgB.id);
    });
  });

  describe('5. Tenant Context & Admin Middleware', () => {
    it('resolves active tenant context and enforces requireOrgAdmin guard', async () => {
      const org = await createOrgUseCase.execute(testUserOwner.id, {
        name: 'Context Test Org',
        slug: 'context-test-org'
      });

      // Add regular member
      await membershipRepo.save(new OrganizationMembership({
        id: 'mem-reg',
        organizationId: org.id,
        userId: testUserMember.id,
        role: 'MEMBER',
        status: 'ACTIVE'
      }));

      // 1. Admin request: Passes requireTenantMembership and requireOrgAdmin
      const tenantMiddleware = requireTenantMembership(validateTenantContextQuery);
      const adminReq: any = {
        user: { id: testUserOwner.id, role: 'OWNER', email: testUserOwner.email },
        headers: { 'x-tenant-id': org.id },
        params: {}
      };

      await tenantMiddleware(adminReq, {} as any, () => {});
      expect(adminReq.tenantContext).toBeDefined();
      expect(adminReq.tenantContext.isAdmin).toBe(true);

      let adminGuardError: any = null;
      requireOrgAdmin(adminReq, {} as any, (err?: any) => {
        adminGuardError = err;
      });
      expect(adminGuardError).toBeUndefined();

      // 2. Regular member request: Passes membership, but blocked by requireOrgAdmin
      const memberReq: any = {
        user: { id: testUserMember.id, role: 'CARETAKER', email: testUserMember.email },
        headers: { 'x-tenant-id': org.id },
        params: {}
      };

      await tenantMiddleware(memberReq, {} as any, () => {});
      expect(memberReq.tenantContext).toBeDefined();
      expect(memberReq.tenantContext.isAdmin).toBe(false);

      let memberGuardError: any = null;
      requireOrgAdmin(memberReq, {} as any, (err?: any) => {
        memberGuardError = err;
      });
      expect(memberGuardError).toBeDefined();
      expect(memberGuardError).toBeInstanceOf(ForbiddenError);
      expect(memberGuardError.message).toContain('Organization administrator privileges required');
    });
  });
});
