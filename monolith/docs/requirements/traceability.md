# Requirement Traceability Matrix

**Project:** Real Estate CareTaking Platform  
**Authority:** `.ai/prd.md`, `.ai/architecture.md`, `docs/architecture/maintenance-management-equilibrium.md`, `AGENTS.md`  
**Status Legend:** `NOT_STARTED` | `IN_PROGRESS` | `IMPLEMENTED` | `TESTED` | `VERIFIED` | `BLOCKED` | `DEFERRED`

---

## 1. Authentication & Access Governance (AUTH / IAM)

| Requirement ID | Description | Priority | Module | Status | Source / Contracts | Tests | Security & Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-AUTH-001` | Multi-role registration & login (Owner, Caretaker, Tenant, Buyer, Vendor, Agent, Admin) | P0 | `iam` | `TESTED` | `packages/contracts/src/iam/`, `apps/api/src/modules/iam/` | `tests/unit/`, `tests/security/` | OWASP A02, A07: Bcrypt hashing, secure tokens |
| `FR-AUTH-002` | Email and mobile credential verification & account status lifecycle | P0 | `iam` | `TESTED` | `modules/iam/domain/` | `tests/unit/` | Account states: PENDING, ACTIVE, SUSPENDED |
| `FR-AUTH-005` | RBAC & Claims authorization middleware on protected routes | P0 | `iam` | `TESTED` | `shared/presentation/auth.middleware.ts` | `tests/security/` | OWASP A01: Deny-by-default on all endpoints |
| `FR-AUTH-008` | Security event audit logging for auth attempts & permission shifts | P1 | `audit` / `iam` | `TESTED` | `modules/iam/` | `tests/unit/` | Audit trail preservation |

---

## 2. Property Portfolio Management (PROP)

| Requirement ID | Description | Priority | Module | Status | Source / Contracts | Tests | Security & Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-PROP-001` | Property onboarding, ownership association, multi-property registry | P0 | `property` | `TESTED` | `packages/contracts/src/property/`, `apps/api/src/modules/property/` | `tests/unit/real-estate-core.test.ts` | Owner-scoped data isolation |
| `FR-PROP-002` | Support Residential & Commercial property categories | P0 | `property` | `TESTED` | `modules/property/domain/` | `tests/unit/real-estate-core.test.ts` | Strict category & unit typing |
| `FR-PROP-003` | Store address, geolocation coordinates, area, configurations, amenities | P1 | `property` | `TESTED` | `modules/property/domain/` | `tests/unit/real-estate-core.test.ts` | Address value object validation |
| `FR-PROP-006` | Lifecycle status: VACANT, RENTED, UNDER_MAINTENANCE, LISTED_RENT, LISTED_SALE | P0 | `property` | `TESTED` | `modules/property/domain/` | `tests/unit/real-estate-core.test.ts` | State transition validation |
| `FR-PROP-010` | Audit trail of property specification & status mutations | P1 | `property` | `TESTED` | `modules/property/infrastructure/` | `tests/unit/real-estate-core.test.ts` | Historical versioning |

---

## 3. Caretaker Profiles & Property Assignment (CARE & ASG)

| Requirement ID | Description | Priority | Module | Status | Source / Contracts | Tests | Security & Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-CARE-001` | Caretaker profile onboarding, skills, service zones, verification status | P0 | `caretaking` | `TESTED` | `packages/contracts/src/caretaking/`, `apps/api/src/modules/caretaking/` | `tests/unit/real-estate-core.test.ts` | KYC verification check |
| `FR-ASG-001` | Property owner requesting caretaker assignment | P0 | `caretaking` | `TESTED` | `modules/caretaking/application/` | `tests/unit/real-estate-core.test.ts` | Assignment authorization |
| `FR-ASG-004` | Assignment lifecycle: Scope, duration, fee schedule, accepted state | P0 | `caretaking` | `TESTED` | `modules/caretaking/domain/` | `tests/unit/real-estate-core.test.ts` | Caretaker must accept before operational |
| `FR-ASG-010` | Revocation of access immediately upon assignment termination | P0 | `caretaking` | `TESTED` | `modules/caretaking/domain/` | `tests/unit/real-estate-core.test.ts` | Revocation invariant enforced |

---

## 4. Permission & Delegation Matrix (PERM)

| Requirement ID | Description | Priority | Module | Status | Source / Contracts | Tests | Security & Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-PERM-001` | Granular property-level permissions (e.g. view, key_access, repair_quote, inspect) | P0 | `caretaking` | `TESTED` | `modules/caretaking/domain/` | `tests/unit/real-estate-core.test.ts` | No access merely by propertyId |
| `FR-PERM-002` | Financial spending threshold & Zero-spend-without-approval default | P0 | `caretaking` | `TESTED` | `modules/caretaking/domain/` | `tests/unit/real-estate-core.test.ts` | Server-side threshold enforcement |
| `FR-PERM-006` | Owner ability to revoke specific permission without terminating assignment | P1 | `caretaking` | `TESTED` | `modules/caretaking/application/` | `tests/unit/real-estate-core.test.ts` | Granular permission revocation |

---

## 5. Maintenance & Management Equilibrium Engine (MAINT)

| Requirement ID | Description | Priority | Module | Status | Source / Contracts | Tests | Security & Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-MAINT-001` | Dynamic Priority Triage (P1 Emergency, P2 Urgent, P3 Standard, P4 Routine) | P0 | `maintenance` | `TESTED` | `packages/contracts/src/maintenance/`, `apps/api/src/modules/maintenance/` | `tests/unit/real-estate-core.test.ts` | SLA response & resolution metrics |
| `FR-MAINT-002` | Emergency Authorization Float (Pre-authorized escrow for P1 emergencies) | P0 | `maintenance` | `TESTED` | `modules/maintenance/domain/` | `tests/unit/real-estate-core.test.ts` | Anti-fraud photo & geo evidence check |
| `FR-MAINT-003` | Quotation comparison, vendor assignment, work order authorization | P0 | `maintenance` | `TESTED` | `modules/maintenance/application/` | `tests/unit/real-estate-core.test.ts` | Owner approval required above threshold |
| `FR-MAINT-004` | Preventive Caretaking & Periodic Checklist Audits (Seepage, electrical, roofing) | P1 | `maintenance` | `TESTED` | `modules/maintenance/domain/` | `tests/unit/real-estate-core.test.ts` | Milestone telemetry & photo proofs |
| `FR-MAINT-005` | Graduated Escalation Matrix for habitability/statutory deadlock | P1 | `maintenance` | `TESTED` | `modules/maintenance/domain/` | `tests/unit/real-estate-core.test.ts` | Escalation circuit breaker |

---

## 6. Document Vault & Verification (DOC)

| Requirement ID | Description | Priority | Module | Status | Source / Contracts | Tests | Security & Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-DOC-001` | Secure property document vault (Deeds, Tax receipts, NOC, Lease deeds) | P0 | `document` | `TESTED` | `packages/contracts/src/document/`, `apps/api/src/modules/document/`, `apps/web/src/features/document/` | `tests/unit/real-estate-phase2.test.ts` | Sensitive documents scoped to property owner & legal auditors |
| `FR-DOC-002` | Document classification, legal audit & verification status metadata | P1 | `document` | `TESTED` | `modules/document/domain/`, `apps/web/src/features/document/` | `tests/unit/real-estate-phase2.test.ts` | Explicit legal auditor verification & rejection audit trail |

---

## 7. Rental & Lease Operations (RENT & SALE)

| Requirement ID | Description | Priority | Module | Status | Source / Contracts | Tests | Security & Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-RENT-001` | Property rental listing creation, security deposits, lease terms & auto-publish | P0 | `rental` | `TESTED` | `packages/contracts/src/rental/`, `apps/api/src/modules/rental/`, `apps/web/src/features/rental/` | `tests/unit/real-estate-phase2.test.ts` | Cannot publish an already leased property listing |
| `FR-RENT-002` | Prospective tenant inquiry funnel (NEW -> VISIT_SCHEDULED -> CONVERTED) | P0 | `rental` | `TESTED` | `modules/rental/domain/entities/tenant-lead.entity.ts`, `apps/web/src/features/rental/` | `tests/unit/real-estate-phase2.test.ts` | Immutable conversion invariant: converted lead cannot be reverted |
| `FR-RENT-003` | Visit scheduling & caretaker assisted walkthrough coordination | P1 | `rental` | `TESTED` | `modules/rental/application/`, `apps/web/src/features/rental/` | `tests/unit/real-estate-phase2.test.ts` | Date/time validation and caretaker notification |

---

## 8. Financial Ledgers & Expense Settlement (FIN)

| Requirement ID | Description | Priority | Module | Status | Source / Contracts | Tests | Security & Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-FIN-001` | Property financial ledger & expense tracking (Repairs, Utilities, Taxes, Retainers) | P0 | `finance` | `TESTED` | `packages/contracts/src/finance/`, `apps/api/src/modules/finance/`, `apps/web/src/features/finance/` | `tests/unit/real-estate-phase2.test.ts` | Positive amount validation & payee identity verification |
| `FR-FIN-002` | Owner approval gate for caretaker and vendor submitted expenses | P0 | `finance` | `TESTED` | `modules/finance/domain/entities/expense-record.entity.ts`, `apps/web/src/features/finance/` | `tests/unit/real-estate-phase2.test.ts` | Unapproved expenses cannot be disbursed |
| `FR-FIN-003` | Financial settlement execution & disbursement audit logging | P0 | `finance` | `TESTED` | `modules/finance/application/commands/settle-expense.use-case.ts`, `apps/web/src/features/finance/` | `tests/unit/real-estate-phase2.test.ts` | Settlement constraint: strictly requires APPROVED state prior to execution |

