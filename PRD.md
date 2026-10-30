# Product Requirements Document (PRD)
## Real Estate CareTaking Platform
**Product Type:** Property Caretaking, Management & Transaction Coordination Platform  
**Target Market:** India (initial launch)  
**Supported Property Types:** Residential and Commercial  
**Platforms:** Web Application, Mobile Application (Android and iOS), Admin Portal  
**Document Version:** 1.0  
**Status:** Draft for Product Design and Development

---

## 1. Executive Summary

### 1.1 Product Overview

Real Estate CareTaking is a digital platform that enables property owners to manage their residential and commercial properties remotely by assigning verified caretakers who coordinate property maintenance, rental activities, property sales, documentation, and other owner-approved requirements.

Many property owners cannot personally manage their properties because they live in another city or country, have multiple properties, lack time, or require trusted local assistance.

The platform solves this problem by connecting property owners with accountable caretakers and local service professionals through a centralized digital application.

Every assigned task, expense, property visit, maintenance request, rental enquiry, sale activity, document, and approval must be recorded and accessible to authorized parties.

### 1.2 Core Business Concept

The platform acts as an intermediary and coordination layer between:

- Property owners.
- Property caretakers.
- Tenants and prospective tenants.
- Prospective buyers.
- Maintenance professionals and vendors.
- Real estate agents and brokers.
- Legal and documentation professionals.
- Platform administrators and operations teams.

A property owner registers a property, defines the required services, approves a caretaker assignment, and delegates authorized responsibilities.

The caretaker executes the assigned responsibilities within the owner's permissions. Any activity outside the approved scope must require additional authorization.

### 1.3 Product Objectives

1. Allow owners to manage properties remotely.
2. Provide verified and accountable caretakers.
3. Facilitate property renting and selling.
4. Coordinate maintenance and repairs with owner approval.
5. Maintain a centralized repository of property documents.
6. Record all important activities, approvals, communications, and expenses.
7. Provide real-time or near-real-time notifications and status updates.
8. Establish transparent service charges and expense records.
9. Build a scalable service network across cities.
10. Generate recurring revenue through property-management subscriptions, service fees, and transaction commissions.

---

## 2. Problem Statement

Property ownership often requires continuous local coordination, particularly when owners are not physically available.

### 2.1 Problems Faced by Property Owners

- Difficulty finding reliable caretakers.
- Inability to inspect property condition regularly.
- Delays in plumbing, electrical, painting, and other repairs.
- Difficulty finding tenants and buyers.
- Poor visibility into rental enquiries and property visits.
- Lack of transparency in maintenance expenses.
- Difficulty coordinating rental agreements, sale deeds, and other documents.
- Uncertainty about whether the caretaker completed the assigned task.
- Risk of unauthorized spending, property access, or commitments.
- Fragmented communication through calls, messaging applications, and paper records.

### 2.2 Problems Faced by Caretakers

- Difficulty obtaining legitimate property assignments.
- Unclear owner expectations and authorization.
- Manual tracking of multiple properties.
- Difficulty coordinating vendors, tenants, and owners.
- Disputes concerning completed work and expenses.
- Lack of a standardized system for reporting visits and property conditions.

### 2.3 Problems Faced by Property Tenants and Buyers

- Difficulty identifying the authorized contact person.
- Delayed responses to enquiries.
- Uncertainty about property availability.
- Poor maintenance coordination.
- Lack of clarity about visits, documentation, and transaction status.

### 2.4 Proposed Solution

Provide a unified platform where property ownership, caretaker assignments, permissions, operational tasks, expenses, rental and sale activities, and documentation are managed through auditable workflows.

---

## 3. Product Scope

### 3.1 In Scope

- User registration and authentication.
- Property onboarding and verification.
- Caretaker onboarding, verification, and assignment.
- Owner-defined permissions and approval limits.
- Property condition reports and inspections.
- Rental management and tenant coordination.
- Property sale coordination.
- Maintenance requests and vendor management.
- Other owner-defined requirements.
- Document management.
- Task, visit, and activity tracking.
- Notifications and messaging.
- Expense tracking and owner approvals.
- Payments, receipts, and service fee management.
- Ratings, complaints, and dispute handling.
- Administrative dashboards and reports.
- Web and mobile applications.
- Role-based access control and audit logs.

### 3.2 Out of Scope for the Initial MVP

- Acting as a bank, escrow provider, or custodian of customer funds.
- Independently executing property sales or legally binding agreements without appropriate authorization.
- Providing legal opinions through unqualified personnel.
- Guaranteeing tenant payments, property appreciation, or transaction completion.
- Autonomous spending or repairs without the required owner authorization.
- Automated title certification or definitive ownership verification by AI.
- Full construction project management.
- Nationwide field operations at launch.

These capabilities may be introduced later through licensed, qualified, or otherwise appropriately authorized partners.

---

## 4. User Personas and Roles

### 4.1 Property Owner

The owner registers properties, chooses services, appoints caretakers, grants permissions, approves expenses, and monitors activity.

**Responsibilities:**
- Maintain accurate property information.
- Submit available ownership and identity documentation.
- Define the caretaker's scope of authority.
- Approve restricted activities and expenses.
- Review reports and settle applicable charges.

### 4.2 Property Caretaker

The caretaker manages the day-to-day operational requirements of assigned properties.

**Responsibilities:**
- Inspect the property.
- Record condition and maintenance needs.
- Coordinate tenants, prospective buyers, and vendors.
- Arrange visits and submit visit reports.
- Execute authorized tasks.
- Submit estimates, bills, photographs, and completion reports.
- Escalate issues requiring owner decisions.

Caretakers must not be assumed to have legal authority to sell, lease, transfer, or otherwise bind the owner merely because they are assigned to a property.

### 4.3 Tenant

The tenant can submit rental enquiries, provide required documents, report maintenance issues, coordinate visits, and receive relevant communications.

### 4.4 Prospective Buyer

The buyer can view authorized property information, request a visit, submit an enquiry or offer, and coordinate transaction documentation.

### 4.5 Maintenance Vendor

A vendor receives assigned jobs, submits estimates, schedules work, uploads completion evidence, and submits invoices.

### 4.6 Real Estate Agent or Broker

An authorized agent can help market properties, manage leads, coordinate visits, and assist with rental or sale negotiations according to the applicable agreement.

### 4.7 Platform Administrator

The administrator manages users, verification workflows, service categories, caretaker assignments, complaints, platform configurations, and operational oversight.

### 4.8 Operations Manager

The operations manager oversees service delivery, escalations, caretaker performance, vendor coordination, and service-level compliance.

### 4.9 Legal or Documentation Professional

An appropriately qualified professional can assist with document preparation, review, registration coordination, or legal services within their professional authorization.

---

## 5. Role-Based Access Control

The application must enforce permissions at the API and data-access layers, not only by hiding interface elements.

| Capability | Owner | Caretaker | Tenant/Buyer | Vendor | Admin |
|---|---|---|---|---|---|
| View assigned property | Yes | Yes, if assigned | Limited | Job-specific | Authorized |
| Edit property ownership data | Yes | No | No | No | Controlled |
| Create maintenance request | Yes | Yes | Authorized tenant | No | Yes |
| Approve owner-controlled expenses | Yes | No | No | No | Exception handling |
| Coordinate rental enquiries | Yes | Yes, if permitted | Own enquiry | No | Oversight |
| Coordinate property sale | Yes | Yes, if permitted | Own enquiry | No | Oversight |
| Upload task evidence | Yes | Yes | Relevant records | Assigned job | Authorized |
| View financial records | Own property | Limited | Own payments | Own invoices | Authorized |
| Change caretaker permissions | Yes | No | No | No | Controlled intervention |
| View audit history | Own property | Assigned scope | Own activity | Own job | Authorized |

**Security rule:** Administrative access must also be restricted by job responsibility. Sensitive owner documents should not automatically be visible to every administrator.

The platform must support configurable roles and permissions, including property-specific access.

---

## 6. Functional Requirements

### 6.1 Authentication and User Management

**FR-AUTH-001:** Users must be able to register and sign in using supported authentication methods.

**FR-AUTH-002:** Support email and/or mobile verification.

**FR-AUTH-003:** Provide password recovery or the selected identity provider's recovery mechanism.

**FR-AUTH-004:** Support account status management, including pending verification, active, suspended, and deactivated.

**FR-AUTH-005:** Support owner, caretaker, tenant, buyer, vendor, agent, and administrator roles.

**FR-AUTH-006:** Enforce authorization on every protected API request.

**FR-AUTH-007:** Support session revocation, secure token handling, and account recovery.

**FR-AUTH-008:** Record security-relevant events, including successful authentication, failed authentication, permission changes, and suspicious access.

### 6.2 Property Onboarding and Management

**FR-PROP-001:** Owners can create multiple property records.

**FR-PROP-002:** Support residential and commercial property categories.

**FR-PROP-003:** Store the property address, location, property type, area, configuration, occupancy, amenities, and relevant identifiers.

**FR-PROP-004:** Allow property photographs, videos, floor plans, inspection reports, and supporting documents.

**FR-PROP-005:** Support ownership information and document verification status.

**FR-PROP-006:** Record whether a property is owner-occupied, vacant, rented, under maintenance, listed for rent, or listed for sale.

**FR-PROP-007:** Allow owners to specify property access instructions and emergency contacts with appropriate access restrictions.

**FR-PROP-008:** Support property-level notes, service history, recurring inspections, and maintenance schedules.

**FR-PROP-009:** Prevent duplicate property records where practical, using configurable matching rules and administrative review.

**FR-PROP-010:** Maintain a history of material property changes.

**Property status lifecycle:**

Draft → Submitted → Verification Pending → Active → Managed / Listed / Under Maintenance → Archived.

A property may have multiple independent operational statuses. For example, a property can be active, occupied, and under maintenance simultaneously. Implement status dimensions rather than forcing every condition into one mutually exclusive status field.

### 6.3 Caretaker Onboarding and Verification

**FR-CARE-001:** Caretakers can submit identity information, contact information, address details, experience, service areas, and skills.

**FR-CARE-002:** Support identity verification and relevant background checks through approved procedures and providers.

**FR-CARE-003:** Record verification status, verification date, expiry date where applicable, and review history.

**FR-CARE-004:** Caretakers can declare service availability, preferred locations, and supported property types.

**FR-CARE-005:** Maintain caretaker ratings, completed assignments, response times, complaints, and task completion history.

**FR-CARE-006:** Allow administrators to suspend or reactivate caretaker accounts.

**FR-CARE-007:** Caretakers must accept assignment terms before taking responsibility for a property.

### 6.4 Caretaker Assignment

**FR-ASG-001:** Owners can request a caretaker for a particular property.

**FR-ASG-002:** The platform can recommend suitable caretakers using location, availability, skills, workload, verification status, and performance.

**FR-ASG-003:** Owners can approve a recommended caretaker or request a replacement.

**FR-ASG-004:** Record assignment start date, end date, service scope, fee arrangement, permissions, and assigned responsibilities.

**FR-ASG-005:** Require acceptance by the caretaker before an assignment becomes operational.

**FR-ASG-006:** Support administrator-assisted assignment when necessary.

**FR-ASG-007:** Allow reassignment, suspension, termination, and temporary substitution.

**FR-ASG-008:** Notify the owner and caretaker about assignment changes.

**FR-ASG-009:** Maintain a history of all assignments and the activities performed during each assignment.

**FR-ASG-010:** Revoke the caretaker's access when an assignment ends, subject to retention of records required for audit and dispute resolution.

### 6.5 Permission and Approval Management

This is a critical feature because the caretaker operates on behalf of the owner.

Owners must define permissions during onboarding and be able to change them later.

Examples of configurable permissions:

- Inspect the property.
- Hold keys or coordinate authorized access.
- Publish rental listings.
- Publish sale listings.
- Respond to prospective tenants and buyers.
- Schedule property visits.
- Coordinate maintenance.
- Request vendor estimates.
- Approve routine expenses up to a specified amount, if explicitly authorized.
- Coordinate document preparation.
- Share specified documents with approved parties.
- Negotiate within defined boundaries, if explicitly permitted.
- Make commitments on behalf of the owner only where legally authorized.

**FR-PERM-001:** Permissions must be granular and property-specific.

**FR-PERM-002:** Support approval thresholds, including a zero-spend-without-approval option.

**FR-PERM-003:** Record who granted, changed, or revoked each permission and when.

**FR-PERM-004:** Support approval expiry dates and emergency exceptions where configured.

**FR-PERM-005:** Activities outside the caretaker's authorization must be blocked or escalated.

**FR-PERM-006:** Owners must be able to revoke permissions without terminating the entire assignment.

**FR-PERM-007:** High-risk actions must require stronger confirmation or verification where appropriate.

### 6.6 Property Renting and Tenant Management

**FR-RENT-001:** Owners or authorized caretakers can create rental listings.

**FR-RENT-002:** Listing details include rent, deposit, lease duration, availability date, permitted use, amenities, and applicable charges.

**FR-RENT-003:** Support residential and commercial rental requirements.

**FR-RENT-004:** Capture and track enquiries from prospective tenants.

**FR-RENT-005:** Provide lead statuses such as New, Contacted, Qualified, Visit Scheduled, Negotiation, Documentation, Converted, and Rejected.

**FR-RENT-006:** Schedule property visits and notify relevant participants.

**FR-RENT-007:** Record visit completion, feedback, and follow-up actions.

**FR-RENT-008:** Record proposed rent, deposit, lease term, and other commercial terms for owner review.

**FR-RENT-009:** Obtain the required owner approval before accepting material rental terms or making commitments.

**FR-RENT-010:** Support rental agreement preparation through qualified professionals or approved templates.

**FR-RENT-011:** Track agreement status, signing status, registration requirements, commencement date, expiry date, and renewal reminders.

**FR-RENT-012:** Support tenant onboarding and authorized document collection.

**FR-RENT-013:** Record security deposits and rent-related transactions when processed through supported workflows.

**FR-RENT-014:** Track rental payment status and arrears if rent tracking is included in the service agreement.

**FR-RENT-015:** Support lease renewal, termination, handover, and move-out inspection workflows.

**FR-RENT-016:** Maintain a record of the property condition before occupancy and at handover.

**Important:** The initial MVP may coordinate rent collection without directly holding funds. Payment collection and settlement must use appropriately configured payment services and comply with applicable legal requirements.

### 6.7 Property Selling and Buyer Management

**FR-SALE-001:** Owners can request sale-management services for a property.

**FR-SALE-002:** Create sale listings with approved property details, asking price, availability, and supporting media.

**FR-SALE-003:** Allow owners to approve listing content before publication.

**FR-SALE-004:** Capture buyer enquiries and maintain a lead pipeline.

**FR-SALE-005:** Schedule and record buyer visits.

**FR-SALE-006:** Capture offers, counteroffers, proposed terms, and owner decisions.

**FR-SALE-007:** Notify the owner when an offer requires a decision.

**FR-SALE-008:** Coordinate due diligence and document requests through authorized professionals.

**FR-SALE-009:** Track transaction milestones, including offer accepted, due diligence, agreement preparation, signing, registration, and handover.

**FR-SALE-010:** Record transaction-related expenses and agreed commissions.

**FR-SALE-011:** Record cancellation, rejection, and failed transaction reasons.

**FR-SALE-012:** Archive transaction records after closure.

**FR-SALE-013:** Require appropriate authorization before the caretaker communicates acceptance of an offer or undertakes a legally binding commitment.

**FR-SALE-014:** Provide a structured document checklist appropriate to the property type and transaction.

**FR-SALE-015:** Allow the owner to mark a property unavailable or withdraw the sale listing.

The platform facilitates the sale process. Ownership transfer, title verification, conveyancing, registration, and execution of legally binding documents must follow applicable law and involve appropriately authorized parties.

### 6.8 Property Maintenance and Repairs

**FR-MAINT-001:** Owners, authorized caretakers, and permitted tenants can create maintenance requests.

**FR-MAINT-002:** Support service categories including:

- Plumbing.
- Electrical work.
- Painting.
- Carpentry.
- Civil repairs.
- HVAC and air conditioning.
- Cleaning and pest control.
- Appliance repair.
- Waterproofing.
- Security systems.
- Internet and utility coordination.
- General inspection.
- Other configurable service categories.

**FR-MAINT-003:** Capture description, urgency, location within the property, photographs, and preferred service time.

**FR-MAINT-004:** Assign priority as Emergency, High, Normal, or Low.

**FR-MAINT-005:** Allow caretakers to inspect the issue and submit a diagnosis or preliminary assessment.

**FR-MAINT-006:** Obtain vendor quotations when required by the owner's policy.

**FR-MAINT-007:** Present estimated costs and expected timelines to the owner.

**FR-MAINT-008:** Require owner approval before work begins whenever the configured policy requires approval.

**FR-MAINT-009:** Permit only explicitly authorized emergency actions, within defined limits.

**FR-MAINT-010:** Assign the job to a verified or approved vendor.

**FR-MAINT-011:** Track scheduled, in-progress, blocked, completed, rejected, and cancelled states.

**FR-MAINT-012:** Require completion evidence, including relevant photographs, invoice, and caretaker or vendor notes.

**FR-MAINT-013:** Allow the owner to approve completion or request rework.

**FR-MAINT-014:** Record the final cost, payment status, warranty information, and service history.

**FR-MAINT-015:** Support recurring preventive maintenance schedules.

**FR-MAINT-016:** Track vendor performance, response time, rework, and complaints.

**FR-MAINT-017:** Support emergency escalation to designated contacts.

**FR-MAINT-018:** Maintain an immutable history of material status transitions and approvals.

### 6.9 Other Requirement Fulfilment

The platform must allow owners to request work that does not fit standard categories.

Examples include:

- Regular property inspections.
- Utility bill coordination.
- Electricity or water connection coordination.
- Key management.
- Property cleaning before a visit.
- Garden or common-area maintenance.
- Security coordination.
- Society or association coordination.
- Document collection.
- Vacant-property checks.
- Move-in and move-out assistance.
- Furniture installation.
- Pest-control scheduling.
- Other owner-defined activities.

**FR-REQ-001:** Owners and authorized caretakers can create custom tasks.

**FR-REQ-002:** Each task must contain a title, description, property, priority, responsible person, due date, and status.

**FR-REQ-003:** Tasks may have approval requirements, estimated costs, attachments, and completion criteria.

**FR-REQ-004:** Support recurring tasks.

**FR-REQ-005:** Support task assignment to caretakers, vendors, or operations staff.

**FR-REQ-006:** Support comments, evidence, reminders, escalation, and completion approval.

**FR-REQ-007:** Allow administrators to define reusable task templates.

### 6.10 Property Documents and Legal Coordination

The application must provide secure document storage and track documentation activities.

Potential documents include:

- Ownership and title documents.
- Sale deeds.
- Previous conveyance documents.
- Encumbrance and other applicable property records.
- Property tax receipts.
- Utility bills.
- Building plans and relevant approvals.
- Lease and rental agreements.
- Tenant or buyer documentation.
- Identity and verification documents.
- Maintenance quotations and invoices.
- Inspection reports.
- Power of attorney or authorization documents, where applicable.
- Sale transaction documents.
- Handover and possession records.

**FR-DOC-001:** Upload, categorize, view, and download authorized documents.

**FR-DOC-002:** Store document metadata, including owner, property, category, upload date, version, and verification status.

**FR-DOC-003:** Support expiry dates and reminders where applicable.

**FR-DOC-004:** Support version history and document replacement.

**FR-DOC-005:** Record document access and sharing events.

**FR-DOC-006:** Support time-limited document sharing with explicitly authorized recipients.

**FR-DOC-007:** Allow the owner to revoke access to shared documents where legally and technically possible.

**FR-DOC-008:** Support document review by appropriately qualified professionals.

**FR-DOC-009:** Distinguish uploaded, owner-confirmed, professionally reviewed, and independently verified documents.

**FR-DOC-010:** Prevent the application from representing an unverified document as legally validated.

The platform coordinates legal and administrative work; it does not itself certify title or replace qualified legal advice.

### 6.11 Communication and Notifications

**FR-COM-001:** Provide property-specific conversations between authorized participants.

**FR-COM-002:** Link messages to the relevant property, task, maintenance request, rental lead, or sale transaction.

**FR-COM-003:** Support in-app notifications.

**FR-COM-004:** Support push notifications on mobile devices.

**FR-COM-005:** Support email and optional SMS or WhatsApp notifications through approved providers.

**FR-COM-006:** Notify owners about pending approvals, overdue tasks, new enquiries, property visits, expenses, and completed work.

**FR-COM-007:** Notify caretakers about new assignments, owner decisions, due dates, and escalations.

**FR-COM-008:** Provide delivery or read status where supported by the communication channel.

**FR-COM-009:** Support configurable notification preferences.

**FR-COM-010:** Preserve an auditable record of material decisions and approvals.

External messaging alone must not be treated as proof of approval unless captured through a verified and auditable workflow.

### 6.12 Expense and Financial Management

**FR-FIN-001:** Record caretaker fees, maintenance costs, vendor charges, travel or inspection charges, and other agreed expenses.

**FR-FIN-002:** Attach estimates, invoices, receipts, and supporting evidence.

**FR-FIN-003:** Support owner approval or rejection of expenses.

**FR-FIN-004:** Track estimated, approved, incurred, paid, reimbursed, and disputed amounts separately.

**FR-FIN-005:** Maintain a property-wise expense ledger.

**FR-FIN-006:** Provide monthly and custom-period expense reports.

**FR-FIN-007:** Support platform service fees, subscription fees, and agreed transaction commissions.

**FR-FIN-008:** Maintain payment references, refunds, and reconciliation records where applicable.

**FR-FIN-009:** Prevent unauthorized changes to finalized financial records; corrections must be recorded as auditable adjustments.

**FR-FIN-010:** Support invoice generation and tax-related fields as appropriate to the applicable business model.

**FR-FIN-011:** Clearly disclose fees, taxes, commissions, and payment responsibilities before purchase or authorization.

### 6.13 Ratings, Complaints, and Disputes

**FR-SUP-001:** Owners can rate caretakers after eligible assignments or service milestones.

**FR-SUP-002:** Owners and caretakers can raise complaints.

**FR-SUP-003:** Support complaint categories, evidence, priority, assigned resolver, and resolution status.

**FR-SUP-004:** Escalate overdue complaints to operations administrators.

**FR-SUP-005:** Maintain dispute histories and resolution notes.

**FR-SUP-006:** Support review moderation and safeguards against retaliatory or fraudulent reviews.

---

## 7. End-to-End Business Workflows

### 7.1 Owner Onboarding and Caretaker Assignment

1. Owner registers and verifies contact information.
2. Owner creates a property record.
3. Owner uploads available property documents.
4. Platform performs the configured verification checks.
5. Owner selects required services.
6. Platform recommends eligible caretakers.
7. Owner reviews the caretaker profile, fees, and terms.
8. Owner approves the caretaker assignment.
9. Caretaker accepts the assignment.
10. Owner configures permissions, expense thresholds, and approval rules.
11. Caretaker conducts an initial inspection.
12. Both parties receive the initial condition report.
13. The property becomes operational under the approved service plan.

**Exception handling:** If verification fails, no eligible caretaker is available, or the caretaker rejects the assignment, the workflow returns to review or reassignment.

### 7.2 Renting Workflow

1. Owner requests rental services.
2. Caretaker inspects the property and records its condition.
3. Caretaker prepares a rental proposal.
4. Owner approves price, deposit, listing details, and marketing permissions.
5. Listing is published through authorized channels.
6. Prospective tenant submits an enquiry.
7. Caretaker contacts and qualifies the lead.
8. Property visit is scheduled and recorded.
9. Proposed rental terms are submitted to the owner.
10. Owner approves, rejects, or negotiates the proposal.
11. Documents are prepared and reviewed as required.
12. Authorized parties execute the agreement.
13. Applicable registration or verification steps are completed.
14. Deposit and payment records are updated.
15. Handover inspection is performed.
16. Tenant onboarding is completed.
17. The platform records the active tenancy and subsequent service obligations.

### 7.3 Selling Workflow

1. Owner requests sale services.
2. Caretaker records property condition and available documents.
3. Owner approves asking price and listing details.
4. Property is listed through authorized channels.
5. Buyer enquiries are recorded.
6. Caretaker schedules property visits.
7. Offers and counteroffers are documented.
8. Owner explicitly accepts or rejects the proposed terms.
9. Qualified professionals assist with due diligence and documentation.
10. The parties complete the required agreement and transaction steps.
11. Registration and payment milestones are recorded.
12. Property handover is documented.
13. The sale case is closed and archived.

### 7.4 Maintenance Workflow

1. Owner, caretaker, or authorized tenant creates a request.
2. Caretaker reviews and inspects the issue.
3. Estimate and scope of work are submitted.
4. Platform checks the owner's approval policy.
5. Owner approves, rejects, or requests clarification when approval is required.
6. Vendor is assigned.
7. Work is scheduled and performed.
8. Vendor uploads evidence and invoice.
9. Caretaker verifies completion.
10. Owner approves completion or requests rework.
11. Final expenses and payment status are recorded.
12. Maintenance history is updated.

### 7.5 Other Requirement Workflow

1. An authorized user creates a task.
2. Task requirements and completion criteria are defined.
3. The task is assigned to a caretaker or vendor.
4. Required approvals and estimates are collected.
5. Work is performed.
6. Evidence is uploaded.
7. The owner or designated reviewer confirms completion where required.
8. The task is closed and included in the activity history.

---

## 8. Owner Dashboard Requirements

The owner dashboard must provide a consolidated view of all managed properties.

### Dashboard components

- Total properties.
- Properties actively managed.
- Vacant properties.
- Properties available for rent.
- Properties listed for sale.
- Active tenancies.
- Open maintenance requests.
- Pending approvals.
- Overdue tasks.
- Upcoming inspections and renewals.
- Recent property activity.
- Monthly expenses.
- Pending invoices and payments.
- Rental and sale enquiry pipeline.
- Caretaker performance.
- Documents requiring attention.

The owner must be able to filter information by property, service type, date range, caretaker, status, and expense category.

### Property detail view

Each property must have a dedicated workspace containing:

- Property profile.
- Caretaker and assignment details.
- Permission settings.
- Activity timeline.
- Tasks and maintenance.
- Rental or sale cases.
- Documents.
- Expenses and invoices.
- Communications.
- Inspections and condition reports.
- Audit history.

---

## 9. Caretaker Mobile Application Requirements

The caretaker application should prioritize fast field operations and evidence collection.

### Main screens

1. Login and profile.
2. Assigned properties.
3. Today's schedule.
4. Property details and access instructions.
5. Check-in and inspection.
6. Maintenance requests.
7. Vendor coordination.
8. Rental and sale leads.
9. Task execution.
10. Expense and invoice submission.
11. Document upload.
12. Owner approvals and messages.
13. Notifications.
14. Work history and performance.

### Field operation requirements

- Capture photographs and videos where permitted.
- Record timestamps and optional location evidence with appropriate consent.
- Support inspection checklists.
- Record property visits and visit outcomes.
- Submit quotations and invoices.
- Update task progress.
- Record reasons for delay or failure.
- Support poor-network handling through queued submissions where practical.

GPS or photographs can support evidence but should not be treated as conclusive proof of completed work.

---

## 10. Tenant and Buyer Experience

A tenant or buyer should be able to interact with the platform without receiving access to private owner information.

### Tenant capabilities

- Submit rental enquiries.
- Request and confirm visits.
- Upload requested documents through secure forms.
- Receive rental proposal and agreement status updates.
- Raise maintenance requests where permitted.
- View their own requests and communications.
- Receive move-in, renewal, and move-out reminders.

### Buyer capabilities

- View authorized property listings.
- Submit an enquiry.
- Request a property visit.
- Submit an offer where the workflow supports it.
- Provide requested transaction documents securely.
- Track transaction milestones shared with them.

Public listing visibility must be separated from confidential property records.

---

## 11. Administrator and Operations Portal

### 11.1 User Management

- Search and manage users.
- Review verification submissions.
- Suspend or reactivate accounts.
- Manage roles and permissions.
- Review complaints and disputes.

### 11.2 Property Management

- Review property verification.
- Manage flagged or duplicate records.
- Review caretaker assignments.
- Handle ownership or authorization disputes.
- Monitor service status.

### 11.3 Caretaker Operations

- Approve caretaker profiles.
- Assign and reassign caretakers.
- Monitor workload and availability.
- Review overdue tasks and performance.
- Investigate complaints.

### 11.4 Vendor Management

- Verify vendors.
- Configure service categories.
- Review quotations and invoices when required.
- Track performance and service quality.

### 11.5 Business Operations

- Configure service packages and fees.
- Manage subscriptions.
- Configure commission rules.
- Review payments and reconciliation.
- Manage refunds and disputes.
- Monitor operational KPIs.
- Configure notifications and escalation rules.

### 11.6 Audit and Security

- View privileged actions.
- Investigate access or approval disputes.
- Review security incidents.
- Maintain controlled administrative overrides.
- Record reasons and actors for administrative interventions.

---

## 12. Application Architecture and Technical Requirements

### 12.1 Application Surfaces

The product should include:

- **Owner Web Application:** Property setup, approvals, financial reports, documents, and portfolio management.
- **Caretaker Mobile Application:** Inspections, assignments, maintenance, visits, and task evidence.
- **Owner Mobile Application:** Monitoring, notifications, approvals, and property access.
- **Tenant/Buyer Web Experience:** Listings, enquiries, visit scheduling, and transaction updates.
- **Admin Web Portal:** Verification, assignments, service delivery, complaints, and reporting.

For the MVP, a responsive web application or progressive web application can reduce initial delivery cost. Native mobile applications can follow when field usage validates the need.

### 12.2 Recommended Initial Technology Stack

The initial implementation should prioritize a modular monolith to reduce operational complexity.

- Backend: Laravel.
- Database: PostgreSQL or MySQL.
- Web UI: Laravel Blade with a suitable responsive component system, or a separate React frontend if required.
- Mobile: React Native or a progressive web application for the initial release.
- Authentication: Microsoft Entra External ID or another suitable OIDC identity provider.
- Background processing: Laravel queues and scheduled jobs where hosting permits.
- File storage: Private object storage or appropriately secured file storage.
- Notifications: Email and push notification providers, with optional SMS or WhatsApp integrations.
- Payments: An appropriately licensed payment provider.
- Monitoring: Application logs, error reporting, and operational health checks.

The technology stack may be adjusted to the actual deployment environment. Shared hosting constraints must be validated before selecting queue workers, push infrastructure, background jobs, or real-time communication.

### 12.3 Logical Modules

1. Identity and Access Management.
2. User and Organization Management.
3. Property Management.
4. Caretaker Management.
5. Assignment and Permission Management.
6. Rental Management.
7. Sale Management.
8. Maintenance Management.
9. Vendor Management.
10. Task and Workflow Management.
11. Document Management.
12. Communication and Notification.
13. Expense and Payment Management.
14. Reviews, Complaints, and Disputes.
15. Reporting and Audit.
16. Platform Configuration.

Modules should have defined interfaces and clear business boundaries so that frequently used capabilities can be separated into services later if scale or operational needs justify it.

### 12.4 Core Data Entities

- User
- Role
- Permission
- UserVerification
- OwnerProfile
- CaretakerProfile
- Property
- PropertyAddress
- PropertyDocument
- PropertyInspection
- CaretakerAssignment
- AssignmentPermission
- ApprovalRequest
- RentalListing
- RentalLead
- Tenant
- Lease
- SaleListing
- BuyerLead
- SaleOffer
- SaleTransaction
- MaintenanceRequest
- Vendor
- VendorAssignment
- ServiceQuotation
- Task
- TaskEvidence
- Expense
- Invoice
- Payment
- Refund
- Conversation
- Message
- Notification
- Complaint
- Review
- AuditEvent
- Subscription
- ServicePackage

All operational records should have appropriate ownership, property association, timestamps, and authorization rules. Historical records must remain attributable to the user and assignment that created them.

---

## 13. Non-Functional Requirements

### 13.1 Security

- Enforce least-privilege access.
- Use encrypted transport through HTTPS.
- Encrypt sensitive data at rest where supported.
- Store credentials and tokens securely.
- Restrict document access using server-side authorization.
- Use expiring, access-controlled document links.
- Maintain audit records for permissions, approvals, document sharing, and financial changes.
- Apply rate limiting and protection against common web vulnerabilities.
- Support account revocation and access termination.
- Avoid exposing identity documents or ownership records in public URLs.

### 13.2 Privacy and Compliance

The platform must follow applicable Indian data-protection requirements, including relevant obligations under the Digital Personal Data Protection Act and applicable rules as in force.

The platform must establish appropriate policies for consent, purpose limitation, data retention, data access, deletion requests, vendor access, and security incidents.

Property and transaction processes must account for applicable state-specific stamp duty, registration, tenancy, and other requirements.

### 13.3 Performance

Initial targets, subject to infrastructure validation:

- Common dashboard API responses: p95 under 2 seconds under the agreed test load.
- Routine state-changing API responses: p95 under 3 seconds, excluding external-provider delays.
- Paginated property and task lists.
- Asynchronous processing for large files and non-critical notifications.
- Responsive web interfaces across mobile and desktop screens.

### 13.4 Availability and Reliability

- Target 99.5% monthly application availability for the initial production service, excluding agreed maintenance windows and external-provider outages.
- Maintain automated backups and periodically test restoration.
- Use idempotency for critical payment and approval operations.
- Ensure duplicate notifications or repeated requests do not create duplicate transactions.
- Maintain monitoring for application errors, failed jobs, storage failures, and notification delivery failures.

### 13.5 Scalability

The system should initially support a small regional pilot and be designed to scale through:

- Database indexing and pagination.
- Query optimization.
- Caching of suitable reference data.
- Background processing.
- Object storage for large media.
- Modular application boundaries.
- Read-heavy workload optimization.

Load-test targets must be defined using the expected concurrent users, property count, file volume, and notification volume rather than relying only on registered user counts.

### 13.6 Usability and Accessibility

- Responsive, mobile-first design for field operations.
- Clear status labels and approval actions.
- Accessible forms and validation messages.
- Support for configurable languages.
- Clear monetary values and fee disclosures.
- Minimize unnecessary steps for common tasks.
- Avoid requiring users to install an app for basic enquiry or approval workflows when a secure web link is sufficient.

---

## 14. Activity Tracking and Auditability

Every significant action must generate an activity event.

Examples:

- Property created or updated.
- Ownership document uploaded.
- Caretaker assigned or replaced.
- Permission granted or revoked.
- Maintenance request created.
- Quotation submitted.
- Expense approved or rejected.
- Vendor assigned.
- Work started or completed.
- Rental enquiry received.
- Property visit completed.
- Offer submitted or accepted.
- Document shared.
- Agreement milestone updated.
- Payment recorded.
- Complaint raised or resolved.

Each event should capture:

- Event identifier.
- Property and related record identifiers.
- Actor identifier and role.
- Event type.
- Timestamp.
- Relevant before-and-after values when appropriate.
- Approval or authorization reference when applicable.
- Supporting evidence references.
- Correlation identifier for related operations.

Audit events must be protected against unauthorized alteration. Sensitive document content, passwords, authentication tokens, and unnecessary personal information must not be copied into general-purpose logs.

---

## 15. Notifications and Service-Level Expectations

The platform should support configurable service-level targets.

Illustrative initial targets:

| Event | Initial target |
|---|---|
| New owner approval request | Notify owner within 1 minute under normal service conditions |
| New caretaker assignment | Notify caretaker within 1 minute |
| Maintenance request acknowledgement | Within 5 minutes for automated acknowledgement |
| Emergency escalation | Immediate application escalation, with configured backup contacts |
| Task due reminder | At configurable intervals before the deadline |
| Lease expiry reminder | Configurable reminders, e.g. 90, 30, and 7 days before expiry |
| Unresolved high-priority task | Escalation according to configured SLA |
| Completed work awaiting owner review | Notify owner when evidence is submitted |

These are proposed service targets, not guarantees of human response or external messaging delivery. Vendor response times and caretaker attendance require separate operational SLAs.

---

## 16. Monetization and Commercial Model

The platform may support multiple revenue streams.

### 16.1 Caretaking Subscription

Recurring fees for a defined package of property-management services.

Example package dimensions:

- Inspection frequency.
- Number of included property visits.
- Maintenance coordination.
- Vacancy checks.
- Reporting frequency.
- Emergency coordination.
- Support response level.

### 16.2 Service Coordination Fee

A disclosed coordination fee for maintenance or other third-party services, either as a fixed charge or an agreed percentage.

### 16.3 Rental Transaction Fee

A disclosed fee for tenant sourcing, rental listing coordination, tenant onboarding, or completed rental transactions.

### 16.4 Sale Transaction Commission

A commission where permitted and contractually agreed, with the appropriate registration, licensing, and disclosure requirements satisfied.

### 16.5 Vendor Marketplace

Revenue through disclosed lead fees, service commissions, or vendor subscription plans, where commercially and legally appropriate.

### 16.6 Premium Services

- Detailed inspection reports.
- Priority caretaker availability.
- Commercial property management.
- Document coordination.
- Dedicated property manager.
- Multi-property portfolio reporting.

The MVP should start with a small number of understandable service packages and validate willingness to pay before introducing complex pricing tiers.

---

## 17. MVP Definition

The MVP should validate whether owners are willing to pay for reliable property caretaking and whether the platform can deliver accountable local services.

### Phase 1: Core MVP

**Priority: P0 — Required for launch**

1. User registration and authentication.
2. Owner and caretaker profiles.
3. Property onboarding.
4. Basic property verification.
5. Caretaker verification and assignment.
6. Property-level permissions and approval rules.
7. Property inspection reports.
8. Maintenance request and task management.
9. Owner approval workflow.
10. Photo and invoice uploads.
11. Rental listing and enquiry management.
12. Sale listing and enquiry management.
13. Basic document repository.
14. Notifications.
15. Activity timeline and audit history.
16. Expense recording.
17. Owner and caretaker dashboards.
18. Admin portal.
19. Basic complaint handling.

### Phase 2: Operational Maturity

**Priority: P1 — After pilot validation**

- Vendor marketplace.
- Advanced tenant onboarding.
- Lease renewal management.
- Recurring inspections and preventive maintenance.
- Payment gateway integration.
- Automated invoices and receipts.
- Advanced reports.
- Multi-language support.
- More advanced caretaker matching.
- Improved mobile field workflows.
- Customer ratings and vendor performance reports.

### Phase 3: Expansion

**Priority: P2 — After product-market validation**

- Advanced commercial property workflows.
- Multi-property portfolio management.
- Broker and agent collaboration.
- External listing integrations.
- Advanced document workflow integrations.
- Automated maintenance recommendations.
- AI-assisted document classification and task summaries.
- Predictive maintenance support.
- Multi-city operations and configurable regional workflows.

AI must assist with administrative tasks rather than independently authorizing expenses, verifying legal ownership, or making legally binding transaction decisions.

---

## 18. MVP Acceptance Criteria

The MVP is ready for a controlled pilot when the following scenarios pass end-to-end testing.

### Scenario A: Property Onboarding

- An owner can register and create a property.
- Required information is validated.
- Documents are uploaded securely.
- Verification status is visible.
- The property can be activated according to the configured verification policy.

### Scenario B: Caretaker Assignment

- An eligible caretaker can be selected.
- The owner approves the assignment and permissions.
- The caretaker accepts the assignment.
- Both parties can view the agreed service scope.
- The system records the assignment history.

### Scenario C: Maintenance with Approval

- A maintenance request can be created.
- A quotation is attached.
- The owner approves or rejects the quotation.
- Work cannot proceed through the normal workflow without the required approval.
- Completion evidence and the invoice are recorded.
- The owner can review the completed work.

### Scenario D: Rental Management

- An authorized user creates a listing.
- A tenant enquiry is recorded.
- A visit is scheduled and tracked.
- Proposed rental terms are submitted to the owner.
- The decision and document milestones are recorded.

### Scenario E: Sale Management

- An authorized user creates a sale listing.
- Buyer enquiries and visits are recorded.
- Offers are submitted to the owner.
- The owner's decision is recorded.
- Transaction milestones and documents are tracked.

### Scenario F: Permission Revocation

- The owner revokes a caretaker's access.
- New restricted operations are blocked.
- Previously generated audit records remain available to authorized parties.
- The caretaker cannot access the property workspace after revocation.

### Scenario G: Activity Transparency

- Every significant state transition has an actor and timestamp.
- Owners can view the relevant activity history.
- Unauthorized users cannot access private records.
- Failed approvals and rejected requests remain traceable.

---

## 19. Success Metrics and KPIs

The product must measure both platform adoption and service delivery quality.

### Acquisition

- Number of registered property owners.
- Number of verified properties.
- Number of qualified caretaker applicants.
- Owner-to-paid-customer conversion rate.

### Activation

- Percentage of owners who complete property onboarding.
- Percentage of active properties with assigned caretakers.
- Time from property onboarding to first completed task.
- Percentage of assignments accepted.

### Service Delivery

- Percentage of tasks completed within SLA.
- Average caretaker response time.
- Maintenance resolution time.
- Percentage of completed jobs with evidence.
- Owner approval turnaround time.
- Repeat maintenance and rework rates.

### Rental and Sale Performance

- Qualified enquiries per listing.
- Property visit-to-offer conversion rate.
- Rental enquiry-to-tenancy conversion rate.
- Average time to rent.
- Average time to sale, where sufficient transaction volume exists.
- Percentage of transactions with complete milestone records.

### Financial Performance

- Monthly recurring revenue.
- Revenue per managed property.
- Gross margin per service package.
- Customer acquisition cost.
- Monthly customer churn.
- Payment collection rate.
- Refund and dispute rates.

### Trust and Retention

- Owner retention rate.
- Repeat service usage.
- Owner satisfaction.
- Complaint resolution time.
- Caretaker replacement rate.
- Unauthorized activity incidents.

Initial numeric targets should be established after the first pilot cohort provides a credible baseline.

---

## 20. Risks and Mitigation

| Risk | Mitigation |
|---|---|
| Caretaker misconduct | Identity verification, references, restricted access, audit logs, complaint handling, and assignment termination |
| Unauthorized spending | Explicit approval policies, spending limits, quotation requirements, and payment controls |
| Property document fraud | Verification workflows, qualified professional review, and clear verification labels |
| Ownership disputes | Require appropriate evidence and suspend affected workflows pending review |
| Poor maintenance quality | Approved vendors, completion evidence, warranties, rework procedures, and ratings |
| Rental or sale disputes | Recorded offers, explicit owner decisions, documented terms, and professional involvement |
| Slow service delivery | SLAs, escalation rules, backup caretakers, and performance monitoring |
| Privacy breaches | Least-privilege access, encrypted storage, controlled document sharing, and incident response |
| Payment disputes | Transparent pricing, receipts, reconciliation, and a defined dispute process |
| Marketplace supply shortage | Start with a geographically concentrated service area and build a vetted caretaker network |
| Excessive MVP scope | Launch with a limited service area, small set of packages, and measurable pilot goals |

---

## 21. Legal and Operational Considerations

Before launch, the company must obtain appropriate legal advice and establish clear contracts covering:

- The platform's role as an intermediary or service provider.
- The caretaker's scope of authority.
- Property access, keys, and security.
- Owner approvals and emergency exceptions.
- Maintenance responsibilities and liability.
- Vendor contracts and workmanship obligations.
- Rental and sale transaction responsibilities.
- Brokerage, commission, and applicable licensing requirements.
- Handling of deposits, rent, and transaction funds.
- Document storage, consent, and privacy.
- Complaints, refunds, cancellations, and disputes.
- Insurance requirements where appropriate.

A caretaker assignment does not itself confer ownership rights, power of attorney, brokerage authorization, or authority to execute a deed. Such powers must be established separately where required.

---

## 22. Recommended Delivery Roadmap

An initial pilot can target approximately 6–8 weeks, depending on team capacity, integration complexity, verification operations, and the choice of web versus native mobile applications.

### Week 1: Discovery and Foundation

- Confirm pilot geography and property segment.
- Finalize service packages and operating policies.
- Define data model and access-control rules.
- Design onboarding and approval flows.

### Weeks 2–3: Core Platform

- Authentication and user roles.
- Property onboarding.
- Caretaker profiles and assignment.
- Permissions and owner approvals.
- Admin portal foundations.

### Weeks 4–5: Service Workflows

- Maintenance and custom tasks.
- Rental and sale leads.
- Document repository.
- Notifications and activity timeline.
- Expense tracking.

### Week 6: Testing and Operational Setup

- End-to-end testing.
- Security and authorization testing.
- Caretaker onboarding.
- Vendor onboarding.
- Owner support procedures.
- Initial reporting.

### Weeks 7–8: Controlled Pilot

- Onboard a small group of owners and caretakers.
- Manage real property requests.
- Track completion evidence and response times.
- Collect feedback.
- Fix operational bottlenecks.
- Evaluate willingness to pay and renewal intent.

The roadmap is an estimate, not a commitment. Native mobile applications, payment integrations, and complex legal-document workflows may require additional time.

---

## 23. Key Product Decisions to Finalize

Before development begins, the product owner must confirm the following decisions:

1. **Initial geography:** Which city or locality will the first pilot serve?
2. **Service model:** Will the company employ caretakers, contract independent caretakers, or operate a hybrid model?
3. **Initial property segment:** Residential only, commercial only, or both with a limited service set?
4. **Initial revenue model:** Monthly property-management fee, service coordination fee, transaction commission, or a combination?
5. **Payment responsibility:** Will the platform only record and coordinate payments, or will it integrate payment collection and settlement?
6. **Caretaker authorization:** Which tasks can be performed independently, and which require explicit approval?
7. **Mobile strategy:** Responsive web/PWA first or native Android and iOS applications from launch?
8. **Legal operations:** Which document services will be performed by the platform, and which will be referred to qualified professionals?
9. **Emergency policy:** What constitutes an emergency, what spending limits apply, and how must the owner be notified?
10. **Service guarantees:** What response times, inspection frequency, and resolution targets will be contractually promised?

These decisions influence the data model, workflows, operational staffing, legal contracts, pricing, and delivery timeline.

---

## 24. Final Product Definition

Real Estate CareTaking is a property operations and coordination platform that gives owners visibility and control while delegating local execution to trusted caretakers.

Its central operating principle is:

**The owner controls the property and its permissions. The caretaker executes approved responsibilities. The platform records, coordinates, and verifies the workflow.**

The product should be built around five foundations:

1. **Trust:** Verified participants and transparent service terms.
2. **Control:** Property-level permissions and explicit owner approvals.
3. **Accountability:** Recorded tasks, evidence, expenses, and decisions.
4. **Convenience:** One workspace for renting, selling, maintenance, and other requirements.
5. **Sustainability:** Reliable local operations and a commercially viable recurring service model.

The initial release should focus on delivering dependable property caretaking in a limited geographic area before expanding into a broader real estate marketplace or advanced automation platform.

---

## 25. Enterprise Multi-Tenant SaaS Architecture & Security Hardening

### 25.1 Mandatory Multi-Tenant SaaS Foundation
The platform must maintain a strict, end-to-end **multi-tenant architecture** across all layers (API, database, background workers, microfrontends, and mobile clients).
* **Strategic Objective**: To onboard any enterprise organization (property management firms, real estate developers, facilities managers, or adjacent service industries) onto our SaaS platform.
* **Unified SSO & Login Flow**: Organizations operate securely from the common platform utilizing our services without requiring bespoke login portals or duplicate authentication systems.
* **Tenant Isolation**: Every request, audit log, configuration override, and domain entity is strictly segregated by `tenant_id` and `tenant_slug`. Tenant boundaries are verified on the backend and cannot be bypassed by client-supplied claims.

### 25.2 Cryptographic Token Architecture: Asymmetric JWT (RS256)
To support multi-tenancy and high performance at scale, the identity architecture transitions from purely symmetric secrets to **Asymmetric Cryptography (RS256 / JWKS)**:
1. **Public Key Verification (Zero-Trust Services)**: Tenant microfrontends, mobile apps, third-party partner integrations, and backend services can verify user authenticity and tenant membership using published public keys (`/.well-known/jwks.json`), eliminating the risk of sharing master symmetric keys.
2. **Federation & Enterprise SSO**: Compatible with standard OpenID Connect (OIDC) identity federation across Azure AD, Okta, and Google Workspace.
3. **Tenant Context in Claims**: Asymmetric tokens carry `tenantId`, `role`, and anti-hijacking client fingerprint (`fgp`), allowing instant stateless verification across distributed nodes.

### 25.3 Client-Side Hardening & Anti-Hijacking Protections
* **Mobile (iOS & Android)**:
  - Hardware-backed secure storage via iOS Keychain (Secure Enclave) and Android KeyStore (TEE/StrongBox).
  - Automatic `X-Device-Fingerprint` and `X-Tenant-ID` injection on all API requests.
  - Zero plain-text token leakage, cache hygiene on logout, and certificate pinning defenses.
* **Web Client**:
  - Device-bound fingerprinting headers (`X-Device-Fingerprint`) generated from client context.
  - Multi-tenant tenant slug routing and support for hardened session storage (`httpOnly`, `Secure`, `SameSite=Strict` cookies).
  - OWASP Top 10 compliance: Strict CSP headers, parameterized SQL, and Zod input validation to prevent token exfiltration.

