# Real Estate CareTaking — Project Context

**Document:** `PROJECT_CONTEXT.md`  
**Version:** 1.0  
**Status:** Active Baseline  
**Product:** Real Estate CareTaking Platform  
**Target Market:** India (initial launch) with multi-tenant global capability  
**Platform Scope:** Modular Monolith API, Web Frontend, and Mobile Applications (Android & iOS)

---

## 1. Executive Summary & Vision

Real Estate CareTaking is an enterprise-grade digital platform engineered to empower residential and commercial property owners to manage their properties remotely. Property owners—especially Non-Resident Indians (NRIs), multi-property investors, and busy professionals—often face acute friction maintaining, renting, inspecting, and documenting properties across geographical boundaries.

The platform bridges this physical divide by connecting property owners with verified, accountable caretakers and local service professionals through a centralized, transparent digital coordination layer.

Every operational activity—including key custody handovers, rental listings, tenant lead conversions, physical inspections, maintenance requests, emergency escrows, quotations, contractor proof-of-work telemetry, and legal document custody—is recorded immutably with auditability and granular permissions.

---

## 2. Core Personas and Stakeholder Model

The platform operates around eight distinct domain personas with strictly delineated responsibilities and Role-Based Access Control (RBAC):

| Persona / Role | Key Responsibilities & Capabilities |
| :--- | :--- |
| **Property Owner (`OWNER`)** | Full property ownership, onboarding assets, defining emergency float thresholds, selecting/approving caretakers, delegating granular permissions, approving non-emergency quotations, reviewing lease agreements, and authorizing financial disbursements. |
| **Caretaker (`CARETAKER`)** | Local proxy acting on the owner's behalf within strictly bounded, delegated permissions (e.g., `INSPECT_PROPERTY`, `COLLECT_RENT`, `SOLICIT_QUOTES`). Subject to spending limits and instant permission revocation upon assignment termination. |
| **Tenant / Inquirer (`TENANT`)** | Discovers active rental listings, submits tenancy leads, schedules on-site property visits, logs maintenance tickets, tracks SLA progress, and completes rent payments. |
| **Prospective Buyer (`BUYER`)** | Views verified sale listings, schedules accompanied viewings, and submits purchase intent. |
| **Maintenance Vendor (`VENDOR`)** | Receives dispatched work orders, submits itemized repair quotations, checks in via anti-fraud GPS telemetry, and uploads before/after photographic proof of work. |
| **Real Estate Agent (`AGENT`)** | Sources tenant/buyer leads, coordinates marketing and tenant placement under agreed brokerage frameworks. |
| **Legal / Documentation Pro (`LEGAL`)** | Verifies ownership titles, encumbrance certificates (EC), Khata certificates, drafts rental leases, and audits vault documents. |
| **Platform Administrator (`ADMIN`)** | Manages multi-tenant organization configurations, dynamic MFA-protected routes, global compliance, and system-wide audits. |

---

## 3. High-Level Bounded Contexts

The backend architecture is segmented into cohesive bounded contexts following Domain-Driven Design (DDD):

```
+-----------------------------------------------------------------------------------+
|                                REAL ESTATE CARETAKING                             |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Property Context]        [Caretaking Context]       [Maintenance Context]       |
|  - Asset registration      - Caretaker onboarding     - Dynamic priority triage   |
|  - Address VO              - Verification / KYC       - Equilibrium SLA engine    |
|  - Emergency float limit   - Granular permissions     - Emergency float escrow    |
|  - Property lifecycle      - Spending thresholds      - GPS & photo proofs        |
|                                                                                   |
|  [Rental Context]          [Document Context]         [Finance Context]           |
|  - Rental listings         - Custody vault            - Property ledgers          |
|  - Tenant lead pipeline    - Legal verification       - Expense approvals         |
|  - Scheduled visits        - Expiry tracking          - Settlement invariants     |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|                                PLATFORM CORE FOUNDATION                           |
+-----------------------------------------------------------------------------------+
|  [IAM Context]             [Config Context]           [Communication / Async]     |
|  - RS256 Asymmetric JWT    - Hierarchical overrides   - Outbox Pattern Bus        |
|  - JWKS endpoint           - Tenant-scoped settings   - Multi-channel notify      |
|  - Dynamic MFA routes      - Redis / in-memory cache  - Job Scheduler             |
+-----------------------------------------------------------------------------------+
```

---

## 4. Key Business Invariants & Operational Rules

1. **Owner Sovereignty & Least Privilege**: Caretakers possess zero authority beyond explicitly granted scopes. When an assignment is terminated (`FR-ASG-010`), all delegated permissions are revoked immediately across all systems.
2. **Maintenance Equilibrium Engine**: Urgency is dynamically triaged across P1 (Emergency) through P4 (Routine). Emergency life-safety issues (P1) bypass quotation approval delays by tapping pre-authorized emergency float escrow up to the owner's configured threshold.
3. **Anti-Fraud Work Verification**: Maintenance completions require timestamped, geofenced GPS check-ins within proximity of the property, accompanied by cryptographic before/after photographic telemetry.
4. **Document Custody Chain**: Sensitive property records (Title Deeds, Tax Receipts, Khata, Encumbrance Certificates) are preserved in a secure vault requiring dual-key legal audit before marking verified.
5. **Double-Entry Financial Integrity**: Expense records cannot be settled without verifiable approval gates matching owner delegation limits.

---

## 5. Technology Ecosystem & Platform Delivery

- **Backend Runtime**: Node.js 20+, TypeScript 5+, Express modular monolith.
- **Data Persistence**: PostgreSQL 16 with modular schema isolation (`property`, `caretaking`, `maintenance`, `rental`, `document`, `finance`, `iam`, `app_config`, `common`).
- **Cryptographic Security**: Asymmetric RS256 JWT signing with standard OpenID Connect JWKS endpoint, AES-256-GCM encrypted refresh tokens, persistent device fingerprinting.
- **Frontend Applications**: React 18, Vite, Tailwind CSS with multi-tenant dynamic theme styling.
- **Mobile Client**: React Native / Expo with SecureStore hardware token protection and automated HTTP device security headers.

