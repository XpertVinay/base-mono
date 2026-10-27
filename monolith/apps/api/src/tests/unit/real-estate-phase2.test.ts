import { describe, it, expect, beforeEach } from 'vitest';
import { RentalListing } from '../../modules/rental/domain/entities/rental-listing.entity.js';
import { TenantLead } from '../../modules/rental/domain/entities/tenant-lead.entity.js';
import { PropertyDocument } from '../../modules/document/domain/entities/property-document.entity.js';
import { ExpenseRecord } from '../../modules/finance/domain/entities/expense-record.entity.js';

import { PostgresRentalRepository } from '../../modules/rental/infrastructure/persistence/postgres-rental.repository.js';
import { PostgresDocumentRepository } from '../../modules/document/infrastructure/persistence/postgres-document.repository.js';
import { PostgresFinanceRepository } from '../../modules/finance/infrastructure/persistence/postgres-finance.repository.js';

import { CreateListingUseCase } from '../../modules/rental/application/commands/create-listing.use-case.js';
import { CreateLeadUseCase } from '../../modules/rental/application/commands/create-lead.use-case.js';
import { UploadDocumentUseCase } from '../../modules/document/application/commands/upload-document.use-case.js';
import { VerifyDocumentUseCase } from '../../modules/document/application/commands/verify-document.use-case.js';
import { CreateExpenseUseCase } from '../../modules/finance/application/commands/create-expense.use-case.js';
import { ApproveExpenseUseCase } from '../../modules/finance/application/commands/approve-expense.use-case.js';
import { SettleExpenseUseCase } from '../../modules/finance/application/commands/settle-expense.use-case.js';
import { ListExpensesQuery } from '../../modules/finance/application/queries/list-expenses.query.js';

describe('Real Estate Phase 2 Domain Invariants & Workflows', () => {
  let rentalRepo: PostgresRentalRepository;
  let documentRepo: PostgresDocumentRepository;
  let financeRepo: PostgresFinanceRepository;

  beforeEach(() => {
    rentalRepo = new PostgresRentalRepository();
    documentRepo = new PostgresDocumentRepository();
    financeRepo = new PostgresFinanceRepository();
  });

  describe('1. Rental Listings & Lead Funnel (FR-RENT & FR-SALE)', () => {
    it('creates a rental listing in DRAFT status and validates commercial rules', () => {
      const listing = RentalListing.create(
        'prop-101',
        'owner-202',
        45000,
        150000,
        11,
        new Date(),
        'RESIDENTIAL',
        'Sea-facing 3BHK penthouse with private terrace'
      );

      expect(listing.id).toBeDefined();
      expect(listing.status).toBe('DRAFT');
      expect(listing.monthlyRent).toBe(45000);
      expect(listing.securityDeposit).toBe(150000);
      expect(listing.leaseDurationMonths).toBe(11);
    });

    it('rejects listing with invalid zero or negative rent', () => {
      expect(() => {
        RentalListing.create(
          'prop-101',
          'owner-202',
          0,
          10000
        );
      }).toThrow('Monthly rent must be greater than zero');
    });

    it('manages rental listing lifecycle: DRAFT -> ACTIVE -> LEASED and prevents re-publishing leased listing', () => {
      const listing = RentalListing.create(
        'prop-102',
        'owner-202',
        30000,
        90000
      );

      listing.publish();
      expect(listing.status).toBe('ACTIVE');

      listing.markLeased();
      expect(listing.status).toBe('LEASED');

      expect(() => {
        listing.publish();
      }).toThrow('Cannot publish an already leased property listing');
    });

    it('tracks prospective tenant lead through lifecycle: NEW -> VISIT_SCHEDULED -> CONVERTED', () => {
      const lead = TenantLead.create(
        'listing-50',
        'prop-102',
        'Vikram Malhotra',
        '+919811223344',
        'vikram@corp.com',
        28000,
        'Prefers 1st floor parking spot'
      );

      expect(lead.status).toBe('NEW');
      expect(lead.offeredRent).toBe(28000);

      // Schedule visit
      const visitDate = new Date(Date.now() + 86400000 * 2);
      lead.updateStatus('VISIT_SCHEDULED', visitDate, 'Confirmed Sunday 11 AM walkthrough');
      expect(lead.status).toBe('VISIT_SCHEDULED');
      expect(lead.scheduledVisitDate).toEqual(visitDate);

      // Convert lead to tenant
      lead.updateStatus('CONVERTED', undefined, 'Agreement finalized and deposit paid');
      expect(lead.status).toBe('CONVERTED');

      // Cannot revert once converted
      expect(() => {
        lead.updateStatus('NEW');
      }).toThrow('Cannot revert a converted tenancy lead');
    });
  });

  describe('2. Document Vault & Legal Verification (FR-DOC)', () => {
    it('creates property document with PENDING verification status', () => {
      const doc = PropertyDocument.create(
        'prop-101',
        'owner-202',
        'TITLE_DEED',
        'Registered Title Deed 2021',
        'https://storage.caretake.io/docs/deed-101.pdf',
        'application/pdf',
        4520100
      );

      expect(doc.id).toBeDefined();
      expect(doc.verificationStatus).toBe('PENDING');
      expect(doc.verifiedBy).toBeNull();
      expect(doc.verifiedAt).toBeNull();
    });

    it('rejects document with invalid URL or zero file size', () => {
      expect(() => {
        PropertyDocument.create(
          'prop-101',
          'owner-202',
          'TITLE_DEED',
          'Invalid Doc',
          'ftp://insecure-path',
          'application/pdf',
          5000
        );
      }).toThrow('Valid secure file URL is required');

      expect(() => {
        PropertyDocument.create(
          'prop-101',
          'owner-202',
          'TITLE_DEED',
          'Zero Byte Doc',
          'https://storage.caretake.io/empty.pdf',
          'application/pdf',
          0
        );
      }).toThrow('Document file size must be greater than zero bytes');
    });

    it('allows legal officer or admin to verify or reject property documents', () => {
      const doc = PropertyDocument.create(
        'prop-101',
        'owner-202',
        'PROPERTY_TAX_RECEIPT',
        'Tax Receipt FY 2025-26',
        'https://storage.caretake.io/docs/tax-receipt.pdf',
        'application/pdf',
        1048576
      );

      doc.verify('legal-counsel-user-9');
      expect(doc.verificationStatus).toBe('VERIFIED');
      expect(doc.verifiedBy).toBe('legal-counsel-user-9');
      expect(doc.verifiedAt).toBeInstanceOf(Date);

      const rejectedDoc = PropertyDocument.create(
        'prop-101',
        'owner-202',
        'INSPECTION_REPORT',
        'Floor Layout Draft',
        'https://storage.caretake.io/docs/draft-plan.pdf',
        'application/pdf',
        2048576
      );

      rejectedDoc.reject('legal-counsel-user-9');
      expect(rejectedDoc.verificationStatus).toBe('REJECTED');
      expect(rejectedDoc.verifiedBy).toBe('legal-counsel-user-9');
    });
  });

  describe('3. Financial Ledgers & Expense Settlement (FR-FIN)', () => {
    it('creates expense record in PENDING_APPROVAL status', () => {
      const expense = ExpenseRecord.create(
        'prop-101',
        'caretaker-user-1',
        'City Water Supply Authority',
        'UTILITY_BILL',
        3450,
        'Bi-monthly water utility bill',
        'https://storage.caretake.io/invoices/water-feb26.pdf'
      );

      expect(expense.id).toBeDefined();
      expect(expense.status).toBe('PENDING_APPROVAL');
      expect(expense.amount).toBe(3450);
      expect(expense.approvedBy).toBeNull();
      expect(expense.settledAt).toBeNull();
    });

    it('rejects expense record with non-positive amount or missing payee', () => {
      expect(() => {
        ExpenseRecord.create(
          'prop-101',
          'caretaker-1',
          'Plumber',
          'MAINTENANCE_REPAIR',
          -500,
          'Faulty amount'
        );
      }).toThrow('Expense amount must be strictly greater than zero');

      expect(() => {
        ExpenseRecord.create(
          'prop-101',
          'caretaker-1',
          ' ',
          'MAINTENANCE_REPAIR',
          500,
          'Missing payee'
        );
      }).toThrow('Payee name must be at least 2 characters');
    });

    it('enforces settlement invariant: cannot settle an expense without explicit prior approval', () => {
      const expense = ExpenseRecord.create(
        'prop-101',
        'caretaker-1',
        'Urban Cleaners Ltd',
        'MAINTENANCE_REPAIR',
        2200,
        'Post-monsoon facade deep cleaning'
      );

      // Attempting to settle directly while PENDING_APPROVAL must throw
      expect(() => {
        expense.settle();
      }).toThrow('Expense must be explicitly approved before financial settlement');

      // Approve first
      expense.approve('owner-202');
      expect(expense.status).toBe('APPROVED');
      expect(expense.approvedBy).toBe('owner-202');
      expect(expense.approvedAt).toBeInstanceOf(Date);

      // Now settlement succeeds
      expense.settle();
      expect(expense.status).toBe('SETTLED');
      expect(expense.settledAt).toBeInstanceOf(Date);
    });
  });

  describe('4. Integrated Application Workflows (Use Cases & Repositories)', () => {
    it('executes full rental flow: create listing -> publish -> record tenant lead', async () => {
      const createListingUseCase = new CreateListingUseCase(rentalRepo);
      const createLeadUseCase = new CreateLeadUseCase(rentalRepo);

      // Create listing
      const listingRes = await createListingUseCase.execute({
        propertyId: 'prop-e2e',
        ownerId: 'owner-e2e',
        monthlyRent: 55000,
        securityDeposit: 200000,
        leaseDurationMonths: 12,
        permittedUse: 'RESIDENTIAL',
        description: 'Luxury high-rise condo'
      });

      expect(listingRes.isSuccess).toBe(true);
      const listing = listingRes.getValue();
      expect(listing.status).toBe('ACTIVE');

      // Record enquiry
      const leadRes = await createLeadUseCase.execute({
        listingId: listing.id,
        tenantName: 'Ananya Sharma',
        tenantPhone: '+919876543219',
        tenantEmail: 'ananya@techventures.io',
        offeredRent: 52000,
        notes: 'Requested move-in next month'
      });

      expect(leadRes.isSuccess).toBe(true);
      const lead = leadRes.getValue();
      expect(lead.status).toBe('NEW');
      expect(lead.tenantName).toBe('Ananya Sharma');

      // Query leads by property
      const retrievedLeads = await rentalRepo.findLeadsByPropertyId('prop-e2e');
      expect(retrievedLeads).toHaveLength(1);
      expect(retrievedLeads[0]!.tenantEmail).toBe('ananya@techventures.io');
    });

    it('executes document workflow: upload -> verify', async () => {
      const uploadDocUseCase = new UploadDocumentUseCase(documentRepo);
      const verifyDocUseCase = new VerifyDocumentUseCase(documentRepo);

      const uploadRes = await uploadDocUseCase.execute({
        propertyId: 'prop-doc-e2e',
        uploaderId: 'owner-e2e',
        documentType: 'ENCUMBRANCE_CERTIFICATE',
        title: 'Bruhat Bengaluru Mahanagara Palike A-Khata',
        fileUrl: 'https://storage.caretake.io/documents/khata-certificate.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 852100
      });

      expect(uploadRes.isSuccess).toBe(true);
      const doc = uploadRes.getValue();
      expect(doc.verificationStatus).toBe('PENDING');

      // Verify document
      const verifyRes = await verifyDocUseCase.execute({
        documentId: doc.id,
        verifiedByActorId: 'legal-auditor-1',
        isApproved: true
      });

      expect(verifyRes.isSuccess).toBe(true);
      expect(verifyRes.getValue().verificationStatus).toBe('VERIFIED');
    });

    it('executes financial ledger workflow: record expense -> approve -> settle -> list property ledger', async () => {
      const createExpenseUseCase = new CreateExpenseUseCase(financeRepo);
      const approveExpenseUseCase = new ApproveExpenseUseCase(financeRepo);
      const settleExpenseUseCase = new SettleExpenseUseCase(financeRepo);
      const listExpensesQuery = new ListExpensesQuery(financeRepo);

      // 1. Record expense
      const recordRes = await createExpenseUseCase.execute({
        propertyId: 'prop-fin-e2e',
        creatorId: 'caretaker-e2e',
        payeeName: 'Pest Control Experts',
        expenseType: 'MAINTENANCE_REPAIR',
        amount: 4500,
        description: 'Annual anti-termite treatment',
        invoiceUrl: 'https://storage.caretake.io/invoices/pest-control.pdf'
      });

      expect(recordRes.isSuccess).toBe(true);
      const expense = recordRes.getValue();
      expect(expense.status).toBe('PENDING_APPROVAL');

      // 2. Approve
      const approveRes = await approveExpenseUseCase.execute({
        expenseId: expense.id,
        approverId: 'owner-e2e',
        isApproved: true
      });
      expect(approveRes.isSuccess).toBe(true);
      expect(approveRes.getValue().status).toBe('APPROVED');

      // 3. Settle
      const settleRes = await settleExpenseUseCase.execute({
        expenseId: expense.id
      });
      expect(settleRes.isSuccess).toBe(true);
      expect(settleRes.getValue().status).toBe('SETTLED');

      // 4. Query property expenses
      const ledgerRes = await listExpensesQuery.execute({ propertyId: 'prop-fin-e2e' });
      expect(ledgerRes.isSuccess).toBe(true);
      const ledger = ledgerRes.getValue();
      expect(ledger).toHaveLength(1);
      expect(ledger[0]!.amount).toBe(4500);
      expect(ledger[0]!.status).toBe('SETTLED');
    });
  });
});
