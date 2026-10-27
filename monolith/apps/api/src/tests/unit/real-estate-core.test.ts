import { describe, it, expect, beforeEach } from 'vitest';
import { Property } from '../../modules/property/domain/entities/property.entity.js';
import { CaretakerProfile } from '../../modules/caretaking/domain/entities/caretaker-profile.entity.js';
import { CaretakerAssignment } from '../../modules/caretaking/domain/entities/caretaker-assignment.entity.js';
import { MaintenanceRequest } from '../../modules/maintenance/domain/entities/maintenance-request.entity.js';
import { PostgresPropertyRepository } from '../../modules/property/infrastructure/persistence/postgres-property.repository.js';
import { PostgresCaretakingRepository } from '../../modules/caretaking/infrastructure/persistence/postgres-caretaking.repository.js';
import { PostgresMaintenanceRepository } from '../../modules/maintenance/infrastructure/persistence/postgres-maintenance.repository.js';
import { CreatePropertyUseCase } from '../../modules/property/application/commands/create-property.use-case.js';
import { AssignCaretakerUseCase } from '../../modules/caretaking/application/commands/assign-caretaker.use-case.js';
import { AcceptAssignmentUseCase } from '../../modules/caretaking/application/commands/accept-assignment.use-case.js';
import { SubmitRequestUseCase } from '../../modules/maintenance/application/commands/submit-request.use-case.js';

describe('Real Estate Domain Invariants & CareTaking Core', () => {
  let propertyRepo: PostgresPropertyRepository;
  let caretakingRepo: PostgresCaretakingRepository;
  let maintenanceRepo: PostgresMaintenanceRepository;

  beforeEach(() => {
    propertyRepo = new PostgresPropertyRepository();
    caretakingRepo = new PostgresCaretakingRepository();
    maintenanceRepo = new PostgresMaintenanceRepository();
  });

  describe('1. Property Entity & State Transitions', () => {
    it('creates a valid property with default VACANT status and emergency float limit', () => {
      const prop = Property.create(
        'owner-123',
        'Sunset Heights Apt 4B',
        'Spacious 3BHK',
        'RESIDENTIAL',
        'APARTMENT',
        { street: 'MG Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', country: 'India' },
        1450,
        { name: 'Dr. Ramesh', phone: '+919876543210', relationship: 'Father' },
        ['Gym', 'Swimming Pool', 'Security'],
        10000
      );

      expect(prop.id).toBeDefined();
      expect(prop.status).toBe('VACANT');
      expect(prop.emergencyFloatLimit).toBe(10000);
      expect(prop.areaSqFt).toBe(1450);
    });

    it('rejects invalid title and negative area', () => {
      expect(() => {
        Property.create(
          'owner-123',
          'A', // too short
          'desc',
          'RESIDENTIAL',
          'APARTMENT',
          { street: 'Road', city: 'City', state: 'State', postalCode: '123', country: 'IN' },
          1000,
          { name: 'Emerg', phone: '12345678', relationship: 'Kin' }
        );
      }).toThrow('Property title must be at least 3 characters long');

      expect(() => {
        Property.create(
          'owner-123',
          'Valid Title',
          'desc',
          'RESIDENTIAL',
          'APARTMENT',
          { street: 'Road', city: 'City', state: 'State', postalCode: '123', country: 'IN' },
          -50, // invalid
          { name: 'Emerg', phone: '12345678', relationship: 'Kin' }
        );
      }).toThrow('Property area must be greater than zero');
    });

    it('enforces legitimate status state transitions (VACANT -> RENTED -> UNDER_MAINTENANCE)', () => {
      const prop = Property.create(
        'owner-123',
        'Villa Green',
        '4BHK Villa',
        'RESIDENTIAL',
        'VILLA',
        { street: 'Palm Ave', city: 'Goa', state: 'Goa', postalCode: '403001', country: 'India' },
        3200,
        { name: 'Emerg', phone: '9876543210', relationship: 'Broker' }
      );

      expect(prop.status).toBe('VACANT');

      // Valid: VACANT -> RENTED
      prop.updateStatus('RENTED');
      expect(prop.status).toBe('RENTED');

      // Valid: RENTED -> UNDER_MAINTENANCE
      prop.updateStatus('UNDER_MAINTENANCE');
      expect(prop.status).toBe('UNDER_MAINTENANCE');

      // Valid: UNDER_MAINTENANCE -> VACANT
      prop.updateStatus('VACANT');
      expect(prop.status).toBe('VACANT');
    });

    it('rejects invalid state transitions (e.g., direct RENTED -> LISTED_FOR_SALE without vacant)', () => {
      const prop = Property.create(
        'owner-123',
        'Villa Green',
        '4BHK Villa',
        'RESIDENTIAL',
        'VILLA',
        { street: 'Palm Ave', city: 'Goa', state: 'Goa', postalCode: '403001', country: 'India' },
        3200,
        { name: 'Emerg', phone: '9876543210', relationship: 'Broker' }
      );

      prop.updateStatus('RENTED');

      expect(() => {
        prop.updateStatus('LISTED_FOR_SALE');
      }).toThrow('Invalid property status transition from RENTED to LISTED_FOR_SALE');
    });
  });

  describe('2. Caretaker Onboarding, Assignment & Permission Revocation', () => {
    it('creates caretaker assignment with PENDING_ACCEPTANCE status', () => {
      const assignment = CaretakerAssignment.create(
        'prop-1',
        'caretaker-1',
        'owner-1',
        15000,
        ['VIEW_PROPERTY', 'INSPECT_PREMISES', 'SOLICIT_QUOTES'],
        3000
      );

      expect(assignment.status).toBe('PENDING_ACCEPTANCE');
      // Invariant: cannot execute permissions until ACTIVE
      expect(assignment.hasPermission('VIEW_PROPERTY')).toBe(false);

      // Caretaker accepts
      assignment.accept('caretaker-user-1');
      expect(assignment.status).toBe('ACTIVE');
      expect(assignment.hasPermission('VIEW_PROPERTY')).toBe(true);
      expect(assignment.hasPermission('KEY_ACCESS')).toBe(false);
    });

    it('immediately revokes permissions upon assignment termination (FR-ASG-010)', () => {
      const assignment = CaretakerAssignment.create(
        'prop-1',
        'caretaker-1',
        'owner-1',
        12000,
        ['VIEW_PROPERTY', 'KEY_ACCESS', 'AUTHORIZE_REPAIRS_WITHIN_LIMIT'],
        2000
      );

      assignment.accept('caretaker-1');
      expect(assignment.hasPermission('KEY_ACCESS')).toBe(true);

      // Terminate assignment
      assignment.terminate();
      expect(assignment.status).toBe('TERMINATED');
      expect(assignment.hasPermission('KEY_ACCESS')).toBe(false);
      expect(assignment.allowedPermissions).toHaveLength(0);
    });

    it('enforces owner-controlled spending threshold limit', () => {
      const assignment = CaretakerAssignment.create(
        'prop-1',
        'caretaker-1',
        'owner-1',
        10000,
        ['VIEW_PROPERTY'],
        2500
      );

      expect(assignment.spendingThresholdLimit).toBe(2500);

      // Owner updates permissions and limit
      assignment.updatePermissions(['VIEW_PROPERTY', 'AUTHORIZE_REPAIRS_WITHIN_LIMIT'], 5000);
      expect(assignment.spendingThresholdLimit).toBe(5000);
      expect(assignment.allowedPermissions).toContain('AUTHORIZE_REPAIRS_WITHIN_LIMIT');
    });
  });

  describe('3. Maintenance Equilibrium Engine & Dynamic Triage', () => {
    it('automatically triggers P1 Emergency triage and mobilizes Emergency Float for critical issues', () => {
      const req = MaintenanceRequest.create(
        'prop-1',
        'tenant-456',
        'TENANT',
        'PLUMBING',
        'Major water pipe burst in master bathroom',
        'Flooding into living room, main valve stuck',
        ['https://storage.platform.io/leaks/pipe.jpg'],
        'EMERGENCY',
        10000 // owner float limit
      );

      expect(req.priority).toBe('P1_EMERGENCY');
      expect(req.status).toBe('EMERGENCY_MOBILIZED');
      expect(req.isEmergencyFloatCovered).toBe(true);
      expect(req.emergencyAmountDrawn).toBe(5000); // capped at initial emergency float
      // Strict SLA: 15 min response, 4 hr resolution
      expect(new Date(req.sla.responseDeadline).getTime()).toBeGreaterThan(Date.now());
      expect(new Date(req.sla.resolutionDeadline).getTime()).toBeGreaterThan(new Date(req.sla.responseDeadline).getTime());
    });

    it('handles P3 Standard request with quotation and owner approval workflow', () => {
      const req = MaintenanceRequest.create(
        'prop-1',
        'caretaker-1',
        'CARETAKER',
        'CARPENTRY',
        'Wardrobe hinge repair and drawer alignment',
        'Loose screws and stuck drawers',
        [],
        'NORMAL'
      );

      expect(req.priority).toBe('P3_STANDARD');
      expect(req.status).toBe('REPORTED');
      expect(req.isEmergencyFloatCovered).toBe(false);

      // Vendor submits quotation
      const quotation = req.addQuotation('vendor-99', 'FastFix Carpentry', 1800, 'Materials: ₹800, Labor: ₹1000');
      expect(req.status).toBe('QUOTED');
      expect(req.quotations).toHaveLength(1);

      // Caretaker approves within spending limit (limit ₹2500, quote ₹1800)
      req.approveQuotation(quotation.id, 'CARETAKER', 2500);
      expect(req.status).toBe('APPROVED');
      expect(req.selectedQuotation?.isOwnerApproved).toBe(true);
    });

    it('rejects caretaker approval when quotation exceeds caretaker spending limit', () => {
      const req = MaintenanceRequest.create(
        'prop-1',
        'caretaker-1',
        'CARETAKER',
        'APPLIANCE',
        'Refrigerator compressor replacement',
        'Not cooling',
        [],
        'NORMAL'
      );

      const quotation = req.addQuotation('vendor-88', 'CoolCare Services', 8500, 'Compressor + gas recharge');

      // Caretaker has limit ₹3000, tries to approve ₹8500
      expect(() => {
        req.approveQuotation(quotation.id, 'CARETAKER', 3000);
      }).toThrow('exceeds caretaker spending limit of ₹3000. Owner approval required.');
    });

    it('requires anti-fraud GPS coordinates and before/after photos to complete work', () => {
      const req = MaintenanceRequest.create(
        'prop-1',
        'owner-1',
        'OWNER',
        'ELECTRICAL',
        'Switchboard spark repair',
        'Kitchen switchboard sparking'
      );

      // Attempt to complete without before/after photos
      expect(() => {
        req.completeWork({
          beforePhotoUrls: [],
          afterPhotoUrls: ['https://storage.platform.io/after.jpg'],
          receiptUrls: [],
          gpsLatitude: 12.9716,
          gpsLongitude: 77.5946,
          vendorSignatureTimestamp: new Date().toISOString(),
          finalCost: 1200
        });
      }).toThrow('Proof of work requires both before and after photo documentation');

      // Attempt to complete without GPS check-in
      expect(() => {
        req.completeWork({
          beforePhotoUrls: ['https://storage.platform.io/before.jpg'],
          afterPhotoUrls: ['https://storage.platform.io/after.jpg'],
          receiptUrls: [],
          gpsLatitude: 0,
          gpsLongitude: 0,
          vendorSignatureTimestamp: new Date().toISOString(),
          finalCost: 1200
        });
      }).toThrow('Anti-fraud GPS check-in verification is mandatory');

      // Valid completion
      req.completeWork({
        beforePhotoUrls: ['https://storage.platform.io/before.jpg'],
        afterPhotoUrls: ['https://storage.platform.io/after.jpg'],
        receiptUrls: ['https://storage.platform.io/bill.pdf'],
        gpsLatitude: 12.9716,
        gpsLongitude: 77.5946,
        vendorSignatureTimestamp: new Date().toISOString(),
        finalCost: 1200
      });

      expect(req.status).toBe('COMPLETED');
      expect(req.proofOfWork?.finalCost).toBe(1200);
    });
  });

  describe('4. End-to-End Application Use Cases', () => {
    it('executes full flow: create property -> assign caretaker -> accept -> submit maintenance', async () => {
      const createPropUseCase = new CreatePropertyUseCase(propertyRepo);
      const assignUseCase = new AssignCaretakerUseCase(caretakingRepo);
      const acceptUseCase = new AcceptAssignmentUseCase(caretakingRepo);
      const submitMaintUseCase = new SubmitRequestUseCase(maintenanceRepo);

      // 1. Create property
      const propResult = await createPropUseCase.execute({
        ownerId: 'owner-alpha',
        title: 'Heritage Villa',
        description: 'Colonial style bungalow',
        category: 'RESIDENTIAL',
        propertyType: 'VILLA',
        address: { street: 'Heritage Road', city: 'Mysuru', state: 'Karnataka', postalCode: '570001', country: 'India' },
        areaSqFt: 4500,
        emergencyContact: { name: 'Mohan Kumar', phone: '+919988776655', relationship: 'Brother' },
        emergencyFloatLimit: 8000
      });

      expect(propResult.isSuccess).toBe(true);
      const property = propResult.getValue();

      // 2. Setup caretaker profile
      const caretakerProfile = CaretakerProfile.create('user-care-1', '+919876500000', 5, ['Mysuru'], ['Plumbing', 'Carpentry']);
      await caretakingRepo.saveProfile(caretakerProfile);

      // 3. Assign caretaker
      const assignResult = await assignUseCase.execute({
        ownerId: 'owner-alpha',
        propertyId: property.id,
        caretakerId: caretakerProfile.id,
        monthlyFee: 14000,
        allowedPermissions: ['VIEW_PROPERTY', 'INSPECT_PREMISES', 'SOLICIT_QUOTES'],
        spendingThresholdLimit: 3000,
        startDate: new Date().toISOString()
      });

      expect(assignResult.isSuccess).toBe(true);
      const assignment = assignResult.getValue();
      expect(assignment.status).toBe('PENDING_ACCEPTANCE');

      // 4. Caretaker accepts assignment
      const acceptResult = await acceptUseCase.execute({
        assignmentId: assignment.id,
        caretakerUserId: 'user-care-1'
      });

      expect(acceptResult.isSuccess).toBe(true);
      expect(acceptResult.getValue().status).toBe('ACTIVE');

      // 5. Submit emergency maintenance request
      const maintResult = await submitMaintUseCase.execute({
        propertyId: property.id,
        reporterId: 'user-care-1',
        reporterRole: 'CARETAKER',
        category: 'ELECTRICAL',
        title: 'Main circuit breaker trip and burnt odor',
        description: 'Smoke detected from distribution panel in garage',
        photoUrls: ['https://storage.platform.io/panel.jpg'],
        reportedUrgency: 'EMERGENCY',
        ownerEmergencyLimit: property.emergencyFloatLimit
      });

      expect(maintResult.isSuccess).toBe(true);
      const maint = maintResult.getValue();
      expect(maint.priority).toBe('P1_EMERGENCY');
      expect(maint.status).toBe('EMERGENCY_MOBILIZED');
      expect(maint.isEmergencyFloatCovered).toBe(true);
      expect(maint.emergencyAmountDrawn).toBe(5000);
    });
  });
});
