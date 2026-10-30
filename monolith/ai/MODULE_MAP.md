# Real Estate CareTaking — Module Map

**Document:** `MODULE_MAP.md`  
**Version:** 1.0  
**Scope:** Backend Modular Monolith (`apps/api/src/modules/`) & Shared Contracts (`packages/contracts/src/`)  
**Architecture Enforcement:** Verified by `src/tests/architecture/module-boundaries.test.ts`

---

## 1. Domain Modules (Real Estate CareTaking)

### 1.1 Property Module (`property`)
- **Path:** `apps/api/src/modules/property`
- **Route Prefix:** `/api/properties`
- **Database Schema:** `property`
- **Responsibility:** Real estate property registry, lifecycle transitions, address value objects, asset dimensions, and emergency float limit configuration.
- **Aggregate Root:** `Property` (`id`, `ownerId`, `title`, `description`, `category`, `propertyType`, `status`, `address`, `areaSqFt`, `amenities`, `emergencyFloatLimit`)
- **Lifecycle States:** `DRAFT` -> `UNDER_VERIFICATION` -> `VERIFIED` -> `ACTIVE` -> `INACTIVE` -> `ARCHIVED`
- **Public Exports:** `PropertyModule`, `IPropertyRepository`, `PropertyService`, `PropertyDTO`

### 1.2 Caretaking Module (`caretaking`)
- **Path:** `apps/api/src/modules/caretaking`
- **Route Prefix:** `/api/caretaking`
- **Database Schema:** `caretaking`
- **Responsibility:** Caretaker onboarding, KYC verification, property assignments, delegated granular permissions, spending threshold enforcement, and instant permission revocation upon assignment termination (`FR-ASG-010`).
- **Aggregates:** `CaretakerProfile`, `CaretakerAssignment`
- **Delegated Scopes:** `INSPECT_PROPERTY`, `COLLECT_RENT`, `SOLICIT_QUOTES`, `AUTHORIZE_MINOR_REPAIRS`, `SHOW_PROPERTY_TO_LEADS`, `MANAGE_KEYS`
- **Public Exports:** `CaretakingModule`, `ICaretakingRepository`, `CaretakingService`

### 1.3 Maintenance Module (`maintenance`)
- **Path:** `apps/api/src/modules/maintenance`
- **Route Prefix:** `/api/maintenance`
- **Database Schema:** `maintenance`
- **Responsibility:** Maintenance Equilibrium Engine: Dynamic triage (P1-P4), automated SLA tracking, pre-authorized emergency float escrow mobilization, contractor quotation approval thresholds, and anti-fraud GPS/photographic telemetry proof of work.
- **Aggregates:** `MaintenanceTicket`, `TicketQuotation`, `ProofOfWork`
- **Priority Triage Matrix:**
  - `P1_EMERGENCY`: 15 min response / 4 hr resolution. Auto-mobilized via emergency float escrow up to owner limit.
  - `P2_URGENT`: 1 hr response / 24 hr resolution. Auto-escalated on SLA breach.
  - `P3_STANDARD`: 4 hr response / 72 hr resolution. Standard quotation review required.
  - `P4_ROUTINE`: 24 hr response / Scheduled review.
- **Public Exports:** `MaintenanceModule`, `IMaintenanceRepository`, `MaintenanceService`

### 1.4 Rental Module (`rental`)
- **Path:** `apps/api/src/modules/rental`
- **Route Prefix:** `/api/rentals`
- **Database Schema:** `rental`
- **Responsibility:** Active rental listings, inquiry pipelines, tenant lead qualification, automated on-site visit scheduling, and lease agreement tracking.
- **Aggregates:** `RentalListing`, `TenantLead`, `PropertyVisit`
- **Lead Pipeline:** `NEW_INQUIRY` -> `CONTACTED` -> `VISIT_SCHEDULED` -> `VISIT_COMPLETED` -> `APPLICATION_SUBMITTED` -> `LEASE_SIGNED` -> `REJECTED`
- **Public Exports:** `RentalModule`, `IRentalRepository`, `RentalService`

### 1.5 Document Module (`document`)
- **Path:** `apps/api/src/modules/document`
- **Route Prefix:** `/api/documents`
- **Database Schema:** `document`
- **Responsibility:** Encrypted property document custody vault, classification tagging (Title Deed, Tax Receipt, Khata, Encumbrance Certificate, Possession Letter), dual-key legal verification workflows, and expiry alert schedules.
- **Aggregates:** `Document`, `DocumentAudit`
- **Verification States:** `PENDING_REVIEW` -> `VERIFIED` | `REJECTED` | `EXPIRED`
- **Public Exports:** `DocumentModule`, `IDocumentRepository`, `DocumentService`

### 1.6 Finance Module (`finance`)
- **Path:** `apps/api/src/modules/finance`
- **Route Prefix:** `/api/finance`
- **Database Schema:** `finance`
- **Responsibility:** Property financial ledgers, income/expense tracking, owner approval thresholds for disbursements, caretaker reimbursement settlements, and financial ledger invariants.
- **Aggregates:** `ExpenseRecord`, `SettlementRecord`
- **Expense Classifications:** `MAINTENANCE_EMERGENCY`, `MAINTENANCE_ROUTINE`, `TAX_PAYMENT`, `UTILITY_BILL`, `CARETAKER_STIPEND`, `LEGAL_FEE`
- **Public Exports:** `FinanceModule`, `IFinanceRepository`, `FinanceService`

---

## 2. Core Platform Modules

| Module Name | Path | Route Prefix | Schema | Core Function |
| :--- | :--- | :--- | :--- | :--- |
| **IAM** | `modules/iam` | `/api/iam` | `iam` | User identity, asymmetric RS256 token issuance, standard JWKS endpoint (`/.well-known/jwks.json`), dynamic MFA-protected routes, and security audit trail. |
| **Asset** | `modules/asset` | `/api/assets` | `asset` | Storage abstraction, asset metadata, MIME validation, and secure URL resolution. |
| **Config** | `modules/config` | `/api/config` | `app_config` | Hierarchical config: Global default, DB override, tenant override, and in-memory TTL caching. |
| **Notification** | `modules/notification` | `/api/notifications` | `notification` | Multi-channel messaging (Email, SMS, Push, In-App) with adapter fallback. |
| **Scheduler** | `modules/scheduler` | `/api/scheduler` | `scheduler` | Distributed cron job scheduling, recurring tasks, and distributed locking. |
| **Order** | `modules/order` | `/api/orders` | `orders` | Service and e-commerce orders, itemization, and state machine. |
| **Transaction** | `modules/transaction` | `/api/transactions` | `transactions` | Payment transactions, gateway redirects, and webhook reconciliation. |
| **Inventory** | `modules/inventory` | `/api/inventory` | `inventory` | Stock tracking, reservations, and SKU inventory management. |
| **Search** | `modules/search` | `/api/search` | `search` | Document indexing and full-text search capability. |
| **Gateway** | `modules/gateway` | `/health` | N/A | Liveness and readiness health checks (`/health/live`, `/health/ready`). |

---

## 3. Dependency Flow & Boundary Graph

```
[ Presentation (Express Routers) ]
             |
             v
   [ Application Services ]  <---------- [ Contracts DTOs (@monolith/contracts) ]
             |
             v
      [ Domain Entities ]
             ^
             | (Interface Implementation)
 [ Infrastructure Repositories ]
             |
             v
   [ PostgreSQL Schemas ]
```

### Module Cross-Reference Rules
- Domain modules may consume contracts from `@monolith/contracts`.
- Modules interact across boundaries through their root `index.ts` entry points or asynchronous Outbox events.
- Cross-schema direct database joins are forbidden; data references across modules use string UUIDs (e.g., `propertyId: string`).

