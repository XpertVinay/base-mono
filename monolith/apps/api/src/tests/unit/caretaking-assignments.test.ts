import { describe, it, expect, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { InMemoryEventBus } from '../../infrastructure/messaging/event-bus.js';

import {
  InvalidCaretakerProfileError,
  InvalidAssignmentTransitionError,
  PostgresCaretakingRepository,
  OnboardCaretakerUseCase,
  AssignCaretakerUseCase,
  AcceptAssignmentUseCase,
  UpdatePermissionsUseCase,
  TerminateAssignmentUseCase,
  ListCaretakersQuery,
  ListAssignmentsQuery,
  GetAssignmentDetailsQuery,
  CaretakingController,
  CaretakingModule
} from '../../modules/caretaking/index.js';
import { DomainIntegrationEvent, AssignmentTerminatedPayload } from '@monolith/contracts';

function createMockResponse() {
  const res: Partial<Response> & { _statusCode: number; _jsonData: any } = {
    _statusCode: 200,
    _jsonData: null,
    status(code: number) {
      this._statusCode = code;
      return this as Response;
    },
    json(data: any) {
      this._jsonData = data;
      return this as Response;
    }
  };
  return res as Response & { _statusCode: number; _jsonData: any };
}

describe('Sprint 12: Caretaking Operations Domain — Caretaker Profiles, Assignments & Instant Revocation', () => {
  const TENANT_A = 'tenant-empire-01';
  const TENANT_B = 'tenant-metropolis-02';
  const OWNER_A = 'owner-john-101';
  const OWNER_B = 'owner-sarah-102';
  const USER_CARE_1 = 'user-care-ramesh';
  const USER_CARE_2 = 'user-care-suresh';

  let repository: PostgresCaretakingRepository;
  let eventBus: InMemoryEventBus;

  let onboardUseCase: OnboardCaretakerUseCase;
  let assignUseCase: AssignCaretakerUseCase;
  let acceptUseCase: AcceptAssignmentUseCase;
  let updatePermissionsUseCase: UpdatePermissionsUseCase;
  let terminateUseCase: TerminateAssignmentUseCase;
  let listCaretakersQuery: ListCaretakersQuery;
  let listAssignmentsQuery: ListAssignmentsQuery;
  let getAssignmentDetailsQuery: GetAssignmentDetailsQuery;

  beforeEach(() => {
    repository = new PostgresCaretakingRepository();
    eventBus = new InMemoryEventBus();

    onboardUseCase = new OnboardCaretakerUseCase(repository);
    assignUseCase = new AssignCaretakerUseCase(repository, eventBus);
    acceptUseCase = new AcceptAssignmentUseCase(repository, eventBus);
    updatePermissionsUseCase = new UpdatePermissionsUseCase(repository);
    terminateUseCase = new TerminateAssignmentUseCase(repository, eventBus);
    listCaretakersQuery = new ListCaretakersQuery(repository);
    listAssignmentsQuery = new ListAssignmentsQuery(repository);
    getAssignmentDetailsQuery = new GetAssignmentDetailsQuery(repository);
  });

  // ---------------------------------------------------------------------------
  // 1. MULTI-TENANT CARETAKER PROFILES & KYC LIFECYCLE
  // ---------------------------------------------------------------------------
  describe('1. Multi-Tenant Caretaker Profiles & KYC Lifecycle', () => {
    it('1.1 should onboard caretaker with valid contact, skills, service cities, and tenant attribution', async () => {
      const result = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        name: 'Ramesh Patel',
        phone: '+91-9876543210',
        experienceYears: 7,
        serviceCities: ['Bengaluru', 'Mysuru'],
        skills: ['Electrical', 'Plumbing', 'HVAC Inspection']
      });

      expect(result.isSuccess).toBe(true);
      const profile = result.getValue();
      expect(profile.id).toBeDefined();
      expect(profile.tenantId).toBe(TENANT_A);
      expect(profile.kycStatus).toBe('PENDING');
      expect(profile.ratingAverage).toBe(5.0);
      expect(profile.completedTasksCount).toBe(0);
      expect(profile.isAvailable).toBe(true);
    });

    it('1.2 should reject onboarding with invalid/short phone number or negative experience', async () => {
      const shortPhoneRes = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: 'user-invalid-1',
        phone: '123',
        experienceYears: 3,
        serviceCities: ['Bengaluru'],
        skills: ['Cleaning']
      });
      expect(shortPhoneRes.isFailure).toBe(true);
      expect(shortPhoneRes.getError()).toBeInstanceOf(InvalidCaretakerProfileError);

      const negExpRes = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: 'user-invalid-2',
        phone: '+91-9876543210',
        experienceYears: -2,
        serviceCities: ['Bengaluru'],
        skills: ['Carpentry']
      });
      expect(negExpRes.isFailure).toBe(true);
      expect(negExpRes.getError()).toBeInstanceOf(InvalidCaretakerProfileError);
    });

    it('1.3 should reject duplicate profile creation for same user within the same tenant', async () => {
      await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 5,
        serviceCities: ['Bengaluru'],
        skills: ['Security']
      });

      const duplicateRes = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 6,
        serviceCities: ['Bengaluru'],
        skills: ['Security']
      });
      expect(duplicateRes.isFailure).toBe(true);
      expect(duplicateRes.getError().message).toContain('already exists');
    });

    it('1.4 should transition KYC status through PENDING -> VERIFIED and suspend availability on suspension or rejection', async () => {
      const onboardRes = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_2,
        phone: '+91-9988776655',
        experienceYears: 4,
        serviceCities: ['Mumbai'],
        skills: ['Painting']
      });
      const profileDto = onboardRes.getValue();

      const profile = await repository.findProfileById(profileDto.id, TENANT_A);
      expect(profile).not.toBeNull();

      // Verify KYC
      profile!.verifyKyc();
      expect(profile!.kycStatus).toBe('VERIFIED');
      await repository.saveProfile(profile!);

      const verifiedProfile = await repository.findProfileById(profileDto.id, TENANT_A);
      expect(verifiedProfile!.kycStatus).toBe('VERIFIED');

      // Suspend profile
      verifiedProfile!.suspend();
      expect(verifiedProfile!.kycStatus).toBe('SUSPENDED');
      expect(verifiedProfile!.isAvailable).toBe(false);
    });

    it('1.5 should strictly isolate caretaker profiles across tenant boundaries', async () => {
      await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 5,
        serviceCities: ['Bengaluru'],
        skills: ['General Maintenance']
      });

      // Tenant A can retrieve profile
      const profileTenantA = await repository.findProfileByUserId(USER_CARE_1, TENANT_A);
      expect(profileTenantA).not.toBeNull();
      expect(profileTenantA!.tenantId).toBe(TENANT_A);

      // Tenant B searching for Tenant A's profile gets null
      const profileTenantB = await repository.findProfileByUserId(USER_CARE_1, TENANT_B);
      expect(profileTenantB).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. PROPERTY ASSIGNMENT STATE MACHINE LIFECYCLE
  // ---------------------------------------------------------------------------
  describe('2. Property Assignment State Machine Lifecycle', () => {
    let caretakerProfileId: string;
    const PROPERTY_ID_1 = 'prop-alpha-101';
    const PROPERTY_ID_2 = 'prop-beta-102';

    beforeEach(async () => {
      const onboard = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 6,
        serviceCities: ['Bengaluru'],
        skills: ['Plumbing', 'Lockbox Access']
      });
      caretakerProfileId = onboard.getValue().id;
    });

    it('2.1 should create assignment with PENDING_ACCEPTANCE status, permissions, spending threshold, and tenant isolation', async () => {
      const result = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: PROPERTY_ID_1,
        caretakerId: caretakerProfileId,
        monthlyFee: 12000,
        allowedPermissions: ['VIEW_PROPERTY', 'INSPECT_PREMISES', 'KEY_ACCESS'],
        spendingThresholdLimit: 5000,
        startDate: '2026-11-01T00:00:00Z'
      });

      expect(result.isSuccess).toBe(true);
      const assignment = result.getValue();
      expect(assignment.id).toBeDefined();
      expect(assignment.tenantId).toBe(TENANT_A);
      expect(assignment.status).toBe('PENDING_ACCEPTANCE');
      expect(assignment.monthlyFee).toBe(12000);
      expect(assignment.spendingThresholdLimit).toBe(5000);
      expect(assignment.allowedPermissions).toEqual(['VIEW_PROPERTY', 'INSPECT_PREMISES', 'KEY_ACCESS']);
    });

    it('2.2 should transition assignment status through PENDING_ACCEPTANCE -> ACTIVE upon acceptance by assigned caretaker', async () => {
      const assignRes = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: PROPERTY_ID_1,
        caretakerId: caretakerProfileId,
        monthlyFee: 10000,
        allowedPermissions: ['VIEW_PROPERTY', 'INSPECT_PREMISES']
      });
      const assignmentId = assignRes.getValue().id;

      const acceptRes = await acceptUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        caretakerUserId: USER_CARE_1
      });

      expect(acceptRes.isSuccess).toBe(true);
      const activeAssignment = acceptRes.getValue();
      expect(activeAssignment.status).toBe('ACTIVE');
      expect(activeAssignment.acceptedAt).toBeDefined();

      // Check active assignment retrieval
      const active = await repository.findActiveAssignmentByPropertyId(PROPERTY_ID_1, TENANT_A);
      expect(active).not.toBeNull();
      expect(active!.status).toBe('ACTIVE');
    });

    it('2.3 should reject acceptance by non-assigned caretaker or unauthorized user', async () => {
      const assignRes = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: PROPERTY_ID_1,
        caretakerId: caretakerProfileId,
        monthlyFee: 9000,
        allowedPermissions: ['VIEW_PROPERTY']
      });
      const assignmentId = assignRes.getValue().id;

      // Onboard a different caretaker
      await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_2,
        phone: '+91-9988776655',
        experienceYears: 2,
        serviceCities: ['Bengaluru'],
        skills: ['Cleaning']
      });

      // User 2 tries to accept User 1's assignment
      const wrongAcceptRes = await acceptUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        caretakerUserId: USER_CARE_2
      });

      expect(wrongAcceptRes.isFailure).toBe(true);
      expect(wrongAcceptRes.getError().message).toContain('Unauthorized');
    });

    it('2.4 should allow rejection of assignment during PENDING_ACCEPTANCE status', async () => {
      const assignRes = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: PROPERTY_ID_2,
        caretakerId: caretakerProfileId,
        monthlyFee: 8000,
        allowedPermissions: ['VIEW_PROPERTY']
      });
      const assignmentId = assignRes.getValue().id;

      const assignment = await repository.findAssignmentById(assignmentId, TENANT_A);
      expect(assignment).not.toBeNull();

      assignment!.reject('Schedule conflict with another estate');
      expect(assignment!.status).toBe('REJECTED');
      expect(assignment!.allowedPermissions).toEqual([]);
      expect(assignment!.spendingThresholdLimit).toBe(0);

      await repository.updateAssignment(assignment!);
      const updated = await repository.findAssignmentById(assignmentId, TENANT_A);
      expect(updated!.status).toBe('REJECTED');
    });

    it('2.5 should reject invalid state transitions (e.g., accepting an already terminated or rejected assignment)', async () => {
      const assignRes = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: PROPERTY_ID_1,
        caretakerId: caretakerProfileId,
        monthlyFee: 11000,
        allowedPermissions: ['VIEW_PROPERTY']
      });
      const assignmentId = assignRes.getValue().id;

      // Terminate first
      await terminateUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        actorId: OWNER_A,
        reason: 'Terminated early'
      });

      // Try accepting terminated assignment
      const acceptTerminatedRes = await acceptUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        caretakerUserId: USER_CARE_1
      });
      expect(acceptTerminatedRes.isFailure).toBe(true);
      expect(acceptTerminatedRes.getError()).toBeInstanceOf(InvalidAssignmentTransitionError);
    });

    it('2.6 should prevent assigning property if an active assignment already exists for that property in the same tenant', async () => {
      const assign1 = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: PROPERTY_ID_1,
        caretakerId: caretakerProfileId,
        monthlyFee: 10000,
        allowedPermissions: ['VIEW_PROPERTY']
      });
      await acceptUseCase.execute({
        tenantId: TENANT_A,
        assignmentId: assign1.getValue().id,
        caretakerUserId: USER_CARE_1
      });

      // Attempt second assignment on the same property
      const assign2 = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: PROPERTY_ID_1,
        caretakerId: caretakerProfileId,
        monthlyFee: 12000,
        allowedPermissions: ['VIEW_PROPERTY', 'KEY_ACCESS']
      });

      expect(assign2.isFailure).toBe(true);
      expect(assign2.getError().message).toContain('already has an active caretaker assignment');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. GRANULAR SERVICE SCOPES & OWNER SPENDING CAPS
  // ---------------------------------------------------------------------------
  describe('3. Granular Service Scopes & Owner Spending Caps', () => {
    let assignmentId: string;

    beforeEach(async () => {
      const onboard = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 4,
        serviceCities: ['Bengaluru'],
        skills: ['Electrical']
      });
      const assignRes = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: 'prop-scope-test-1',
        caretakerId: onboard.getValue().id,
        monthlyFee: 15000,
        allowedPermissions: ['VIEW_PROPERTY', 'KEY_ACCESS', 'INSPECT_PREMISES'],
        spendingThresholdLimit: 4000
      });
      assignmentId = assignRes.getValue().id;
    });

    it('3.1 should check individual permission scopes accurately when assignment is ACTIVE', async () => {
      await acceptUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        caretakerUserId: USER_CARE_1
      });

      const assignment = await repository.findAssignmentById(assignmentId, TENANT_A);
      expect(assignment!.hasPermission('VIEW_PROPERTY')).toBe(true);
      expect(assignment!.hasPermission('KEY_ACCESS')).toBe(true);
      expect(assignment!.hasPermission('INSPECT_PREMISES')).toBe(true);
      expect(assignment!.hasPermission('COLLECT_RENT_PROOF')).toBe(false);
      expect(assignment!.hasPermission('AUTHORIZE_REPAIRS_WITHIN_LIMIT')).toBe(false);
    });

    it('3.2 should return false for all permission checks when assignment is PENDING_ACCEPTANCE', async () => {
      const assignment = await repository.findAssignmentById(assignmentId, TENANT_A);
      expect(assignment!.status).toBe('PENDING_ACCEPTANCE');
      // Even though permissions are defined, hasPermission must be false when not ACTIVE
      expect(assignment!.hasPermission('VIEW_PROPERTY')).toBe(false);
      expect(assignment!.hasPermission('KEY_ACCESS')).toBe(false);
    });

    it('3.3 should allow property owner to update permissions and spending threshold limit dynamically', async () => {
      await acceptUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        caretakerUserId: USER_CARE_1
      });

      const updateRes = await updatePermissionsUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        ownerId: OWNER_A,
        allowedPermissions: ['VIEW_PROPERTY', 'AUTHORIZE_REPAIRS_WITHIN_LIMIT', 'COLLECT_RENT_PROOF'],
        spendingThresholdLimit: 7500
      });

      expect(updateRes.isSuccess).toBe(true);
      const updated = updateRes.getValue();
      expect(updated.spendingThresholdLimit).toBe(7500);
      expect(updated.allowedPermissions).toEqual(['VIEW_PROPERTY', 'AUTHORIZE_REPAIRS_WITHIN_LIMIT', 'COLLECT_RENT_PROOF']);

      const reloaded = await repository.findAssignmentById(assignmentId, TENANT_A);
      expect(reloaded!.hasPermission('AUTHORIZE_REPAIRS_WITHIN_LIMIT')).toBe(true);
      expect(reloaded!.hasPermission('KEY_ACCESS')).toBe(false);
    });

    it('3.4 should reject updating permissions or spending limit by non-owner actors', async () => {
      const nonOwnerUpdate = await updatePermissionsUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        ownerId: OWNER_B, // Intruder
        allowedPermissions: ['VIEW_PROPERTY']
      });

      expect(nonOwnerUpdate.isFailure).toBe(true);
      expect(nonOwnerUpdate.getError().message).toContain('Unauthorized');
    });

    it('3.5 should reject negative spending threshold limits', async () => {
      const negativeLimitRes = await updatePermissionsUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        ownerId: OWNER_A,
        allowedPermissions: ['VIEW_PROPERTY'],
        spendingThresholdLimit: -500
      });

      expect(negativeLimitRes.isFailure).toBe(true);
      expect(negativeLimitRes.getError().message).toContain('cannot be negative');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. INSTANT REVOCATION INVARIANT (FR-ASG-010)
  // ---------------------------------------------------------------------------
  describe('4. Instant Revocation Invariant (FR-ASG-010)', () => {
    let assignmentId: string;
    let publishedEvents: DomainIntegrationEvent<any>[] = [];

    beforeEach(async () => {
      publishedEvents = [];
      eventBus.subscribe('caretaking.terminated', async (evt) => {
        publishedEvents.push(evt);
      });

      const onboard = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 5,
        serviceCities: ['Bengaluru'],
        skills: ['Security']
      });

      const assignRes = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: 'prop-revocation-test-1',
        caretakerId: onboard.getValue().id,
        monthlyFee: 14000,
        allowedPermissions: ['VIEW_PROPERTY', 'KEY_ACCESS', 'AUTHORIZE_REPAIRS_WITHIN_LIMIT'],
        spendingThresholdLimit: 6000
      });
      assignmentId = assignRes.getValue().id;

      await acceptUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        caretakerUserId: USER_CARE_1
      });
    });

    it('4.1 should immediately clear all permissions and zero spending limit upon termination', async () => {
      const termRes = await terminateUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        actorId: OWNER_A,
        reason: 'Breach of property access policy'
      });

      expect(termRes.isSuccess).toBe(true);
      const terminated = termRes.getValue();
      expect(terminated.status).toBe('TERMINATED');
      expect(terminated.allowedPermissions).toEqual([]);
      expect(terminated.spendingThresholdLimit).toBe(0);
      expect(terminated.terminatedAt).toBeDefined();

      const saved = await repository.findAssignmentById(assignmentId, TENANT_A);
      expect(saved!.status).toBe('TERMINATED');
      expect(saved!.allowedPermissions).toEqual([]);
      expect(saved!.spendingThresholdLimit).toBe(0);
    });

    it('4.2 should return false for hasPermission immediately after termination', async () => {
      const beforeTerm = await repository.findAssignmentById(assignmentId, TENANT_A);
      expect(beforeTerm!.hasPermission('KEY_ACCESS')).toBe(true);

      await terminateUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        actorId: OWNER_A
      });

      const afterTerm = await repository.findAssignmentById(assignmentId, TENANT_A);
      expect(afterTerm!.hasPermission('KEY_ACCESS')).toBe(false);
      expect(afterTerm!.hasPermission('VIEW_PROPERTY')).toBe(false);
      expect(afterTerm!.hasPermission('AUTHORIZE_REPAIRS_WITHIN_LIMIT')).toBe(false);
    });

    it('4.3 should emit caretaking.terminated domain integration event with assignment metadata and termination timestamp', async () => {
      await terminateUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        actorId: OWNER_A,
        reason: 'Contract period concluded'
      });

      expect(publishedEvents.length).toBe(1);
      const event = publishedEvents[0]!;
      const payload = event.payload as AssignmentTerminatedPayload;
      expect(event.eventName).toBe('caretaking.terminated');
      expect(event.aggregateId).toBe(assignmentId);
      expect(payload.tenantId).toBe(TENANT_A);
      expect(payload.propertyId).toBe('prop-revocation-test-1');
      expect(payload.ownerId).toBe(OWNER_A);
      expect(payload.reason).toBe('Contract period concluded');
      expect(payload.terminatedAt).toBeDefined();
    });

    it('4.4 should reject permission updates on a terminated assignment', async () => {
      await terminateUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        actorId: OWNER_A
      });

      const updateTerminated = await updatePermissionsUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        ownerId: OWNER_A,
        allowedPermissions: ['VIEW_PROPERTY']
      });

      expect(updateTerminated.isFailure).toBe(true);
      expect(updateTerminated.getError()).toBeInstanceOf(InvalidAssignmentTransitionError);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. MULTI-TENANT QUARANTINE & BOUNDARY ISOLATION
  // ---------------------------------------------------------------------------
  describe('5. Multi-Tenant Quarantine & Boundary Isolation', () => {
    let assignmentTenantA: string;

    beforeEach(async () => {
      const onboardA = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 4,
        serviceCities: ['Bengaluru'],
        skills: ['General Maintenance']
      });

      const assignA = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: 'prop-isolated-a',
        caretakerId: onboardA.getValue().id,
        monthlyFee: 10000,
        allowedPermissions: ['VIEW_PROPERTY']
      });
      assignmentTenantA = assignA.getValue().id;
    });

    it('5.1 Tenant B cannot view Tenant A\'s caretaker assignments via findAssignments or query', async () => {
      const assignmentsTenantB = await listAssignmentsQuery.execute({ tenantId: TENANT_B });
      expect(assignmentsTenantB.isSuccess).toBe(true);
      expect(assignmentsTenantB.getValue().length).toBe(0);

      const directLookupTenantB = await getAssignmentDetailsQuery.execute({
        tenantId: TENANT_B,
        assignmentId: assignmentTenantA
      });
      expect(directLookupTenantB.isFailure).toBe(true);
    });

    it('5.2 Tenant B cannot accept Tenant A\'s caretaker assignments', async () => {
      const crossTenantAccept = await acceptUseCase.execute({
        tenantId: TENANT_B,
        assignmentId: assignmentTenantA,
        caretakerUserId: USER_CARE_1
      });

      expect(crossTenantAccept.isFailure).toBe(true);
    });

    it('5.3 Tenant B cannot update permissions on Tenant A\'s caretaker assignments', async () => {
      const crossTenantUpdate = await updatePermissionsUseCase.execute({
        tenantId: TENANT_B,
        assignmentId: assignmentTenantA,
        ownerId: OWNER_A,
        allowedPermissions: ['VIEW_PROPERTY', 'KEY_ACCESS']
      });

      expect(crossTenantUpdate.isFailure).toBe(true);
    });

    it('5.4 Tenant B cannot terminate Tenant A\'s caretaker assignments', async () => {
      const crossTenantTerm = await terminateUseCase.execute({
        tenantId: TENANT_B,
        assignmentId: assignmentTenantA,
        actorId: OWNER_A
      });

      expect(crossTenantTerm.isFailure).toBe(true);

      // Verify assignment in Tenant A is still intact
      const assignmentA = await repository.findAssignmentById(assignmentTenantA, TENANT_A);
      expect(assignmentA!.status).toBe('PENDING_ACCEPTANCE');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. PRESENTATION HTTP BOUNDARY & PUBLIC API FACADE
  // ---------------------------------------------------------------------------
  describe('6. Presentation HTTP Boundary & Public API Facade', () => {
    let controller: CaretakingController;

    beforeEach(() => {
      controller = new CaretakingController(
        onboardUseCase,
        assignUseCase,
        acceptUseCase,
        updatePermissionsUseCase,
        terminateUseCase,
        listCaretakersQuery,
        listAssignmentsQuery,
        getAssignmentDetailsQuery
      );
    });

    it('6.1 CaretakingController parses x-tenant-id header and creates profile and assignment', async () => {
      const reqProfile = {
        headers: { 'x-tenant-id': TENANT_A },
        user: { id: 'user-ctrl-1', email: 'ctrl1@caretaking.io', role: 'CARETAKER' },
        body: {
          phone: '+91-9876543210',
          experienceYears: 6,
          serviceCities: ['Bengaluru'],
          skills: ['Plumbing']
        }
      } as unknown as Request;

      const resProfile = createMockResponse();
      let nextCalled = false;
      await controller.onboard(reqProfile, resProfile, (err) => { if (err) nextCalled = true; });

      expect(nextCalled).toBe(false);
      expect(resProfile._statusCode).toBe(201);
      expect(resProfile._jsonData.success).toBe(true);
      expect(resProfile._jsonData.data.tenantId).toBe(TENANT_A);
      const caretakerId = resProfile._jsonData.data.id;

      // Assign caretaker
      const reqAssign = {
        headers: { 'x-tenant-id': TENANT_A },
        user: { id: OWNER_A, role: 'OWNER' },
        body: {
          propertyId: 'prop-ctrl-101',
          caretakerId,
          monthlyFee: 15000,
          allowedPermissions: ['VIEW_PROPERTY', 'INSPECT_PREMISES'],
          spendingThresholdLimit: 5000
        }
      } as unknown as Request;

      const resAssign = createMockResponse();
      await controller.assign(reqAssign, resAssign, (err) => { if (err) nextCalled = true; });

      expect(resAssign._statusCode).toBe(201);
      expect(resAssign._jsonData.success).toBe(true);
      expect(resAssign._jsonData.data.tenantId).toBe(TENANT_A);
    });

    it('6.2 CaretakingController exposes termination endpoint and returns standard envelope', async () => {
      const onboard = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 4,
        serviceCities: ['Bengaluru'],
        skills: ['Cleaning']
      });

      const assign = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: 'prop-term-ctrl',
        caretakerId: onboard.getValue().id,
        monthlyFee: 8000,
        allowedPermissions: ['VIEW_PROPERTY']
      });
      const assignmentId = assign.getValue().id;

      const reqTerm = {
        headers: { 'x-tenant-id': TENANT_A },
        params: { id: assignmentId },
        user: { id: OWNER_A, role: 'OWNER' },
        body: { reason: 'Owner relocated' }
      } as unknown as Request;

      const resTerm = createMockResponse();
      await controller.terminateAssignment(reqTerm, resTerm, () => {});

      expect(resTerm._statusCode).toBe(200);
      expect(resTerm._jsonData.success).toBe(true);
      expect(resTerm._jsonData.data.status).toBe('TERMINATED');
      expect(resTerm._jsonData.data.allowedPermissions).toEqual([]);
    });

    it('6.3 CaretakingModule.publicApi exposes verification and spending limits with tenant partition', async () => {
      const moduleInstance = CaretakingModule.init(repository, eventBus);
      const publicApi = moduleInstance.publicApi;

      const onboard = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 5,
        serviceCities: ['Bengaluru'],
        skills: ['Lockbox']
      });

      const assign = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: 'prop-api-facade',
        caretakerId: onboard.getValue().id,
        monthlyFee: 12000,
        allowedPermissions: ['KEY_ACCESS', 'INSPECT_PREMISES'],
        spendingThresholdLimit: 4500
      });
      const assignmentId = assign.getValue().id;

      await acceptUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        caretakerUserId: USER_CARE_1
      });

      // Public API tests in Tenant A
      const active = await publicApi.getActiveAssignment('prop-api-facade', TENANT_A);
      expect(active).not.toBeNull();
      expect(active!.status).toBe('ACTIVE');

      const hasKey = await publicApi.verifyPermission('prop-api-facade', USER_CARE_1, 'KEY_ACCESS', TENANT_A);
      expect(hasKey).toBe(true);

      const hasCollect = await publicApi.verifyPermission('prop-api-facade', USER_CARE_1, 'COLLECT_RENT_PROOF', TENANT_A);
      expect(hasCollect).toBe(false);

      const limit = await publicApi.getSpendingLimit('prop-api-facade', USER_CARE_1, TENANT_A);
      expect(limit).toBe(4500);

      // Public API check across tenant partition (Tenant B gets false / 0)
      const tenantBAccess = await publicApi.verifyPermission('prop-api-facade', USER_CARE_1, 'KEY_ACCESS', TENANT_B);
      expect(tenantBAccess).toBe(false);

      const tenantBLimit = await publicApi.getSpendingLimit('prop-api-facade', USER_CARE_1, TENANT_B);
      expect(tenantBLimit).toBe(0);
    });

    it('6.4 Cross-module event projection dispatches integration events to IEventBus', async () => {
      const events: string[] = [];
      eventBus.subscribe('caretaking.assigned', async () => { events.push('assigned'); });
      eventBus.subscribe('caretaking.accepted', async () => { events.push('accepted'); });
      eventBus.subscribe('caretaking.terminated', async () => { events.push('terminated'); });

      const onboard = await onboardUseCase.execute({
        tenantId: TENANT_A,
        userId: USER_CARE_1,
        phone: '+91-9876543210',
        experienceYears: 5,
        serviceCities: ['Bengaluru'],
        skills: ['Electrical']
      });

      const assign = await assignUseCase.execute({
        tenantId: TENANT_A,
        ownerId: OWNER_A,
        propertyId: 'prop-event-test',
        caretakerId: onboard.getValue().id,
        monthlyFee: 10000,
        allowedPermissions: ['VIEW_PROPERTY']
      });
      const assignmentId = assign.getValue().id;

      await acceptUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        caretakerUserId: USER_CARE_1
      });

      await terminateUseCase.execute({
        tenantId: TENANT_A,
        assignmentId,
        actorId: OWNER_A
      });

      expect(events).toEqual(['assigned', 'accepted', 'terminated']);
    });
  });
});
