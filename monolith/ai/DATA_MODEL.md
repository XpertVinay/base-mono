# Real Estate CareTaking — Data Model & Schema Reference

**Document:** `DATA_MODEL.md`  
**Version:** 1.0  
**Database Engine:** PostgreSQL 16  
**Isolation Strategy:** Dedicated Schema per Bounded Context  
**Global Extension:** `uuid-ossp` (Primary keys use UUID v4 strings)

---

## 1. Schema Architecture Overview

To maintain loose coupling and support independent microservice extraction, database tables are isolated into dedicated PostgreSQL schemas. Cross-schema foreign keys are forbidden; associations across bounded contexts are stored as UUID strings (`VARCHAR(36)`).

```
+---------------------------------------------------------------------------------------------------------+
|                                        POSTGRESQL 16 DATABASE                                           |
+-------------------+--------------------+--------------------+--------------------+----------------------+
|  iam              |  property          |  caretaking        |  maintenance       |  rental              |
|  - users          |  - properties      |  - caretaker_      |  - maintenance_    |  - rental_listings   |
|  - audit_logs     |                    |    profiles        |    tickets         |  - tenant_leads      |
|  - mfa_protected_ |                    |  - caretaker_      |  - ticket_         |  - property_visits   |
|    routes         |                    |    assignments     |    quotations      |                      |
|                   |                    |                    |  - proof_of_work   |                      |
+-------------------+--------------------+--------------------+--------------------+----------------------+
|  document         |  finance           |  app_config        |  common            |  platform_core       |
|  - documents      |  - expense_records |  - settings        |  - outbox_events   |  - asset.assets      |
|  - document_      |  - settlements     |  - tenant_         |                    |  - notification.*    |
|    audits         |                    |    configurations  |                    |  - scheduler.jobs    |
+-------------------+--------------------+--------------------+--------------------+----------------------+
```

---

## 2. Real Estate CareTaking Domain Schemas

### 2.1 Schema: `property`

#### `property.properties`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Unique property identifier (UUID) |
| `owner_id` | `VARCHAR(36)` | NOT NULL | IAM user ID of property owner |
| `title` | `VARCHAR(255)` | NOT NULL | Title / display name of property |
| `description` | `TEXT` | NULLABLE | Detailed description and features |
| `category` | `VARCHAR(50)` | NOT NULL | `RESIDENTIAL`, `COMMERCIAL`, `INDUSTRIAL` |
| `property_type`| `VARCHAR(50)` | NOT NULL | `APARTMENT`, `VILLA`, `INDEPENDENT_HOUSE`, `OFFICE`, `PLOT` |
| `status` | `VARCHAR(50)` | NOT NULL | `DRAFT`, `UNDER_VERIFICATION`, `VERIFIED`, `ACTIVE`, `INACTIVE` |
| `address` | `JSONB` | NOT NULL | Structured Address VO (street, city, state, postalCode, country, coordinates) |
| `area_sq_ft` | `NUMERIC(10,2)`| NOT NULL | Total square footage |
| `amenities` | `JSONB` | DEFAULT `'[]'` | List of property amenities |
| `emergency_contact` | `JSONB` | NULLABLE | Primary emergency contact info |
| `emergency_float_limit` | `NUMERIC(12,2)` | DEFAULT 0.00 | Pre-authorized float limit for P1 emergency repairs |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Timestamp of creation |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Timestamp of last update |

*Indexes:*
- `idx_property_owner_id` ON `owner_id`
- `idx_property_status` ON `status`

---

### 2.2 Schema: `caretaking`

#### `caretaking.caretaker_profiles`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Unique caretaker profile UUID |
| `user_id` | `VARCHAR(36)` | NOT NULL, UNIQUE | Associated IAM user ID |
| `kyc_status` | `VARCHAR(50)` | NOT NULL | `PENDING`, `VERIFIED`, `REJECTED` |
| `police_verification_status`| `VARCHAR(50)` | NOT NULL | `PENDING`, `CLEARED`, `REJECTED` |
| `experience_years` | `INT` | DEFAULT 0 | Years of caretaking experience |
| `service_regions` | `JSONB` | DEFAULT `'[]'` | Operational cities / localities |
| `spending_limit` | `NUMERIC(12,2)`| DEFAULT 5000.00 | Maximum single-purchase authorization |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Record creation timestamp |

#### `caretaking.caretaker_assignments`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Assignment UUID |
| `property_id` | `VARCHAR(36)` | NOT NULL | Associated property UUID |
| `caretaker_id` | `VARCHAR(36)` | NOT NULL | Assigned caretaker profile UUID |
| `owner_id` | `VARCHAR(36)` | NOT NULL | Assigning property owner UUID |
| `status` | `VARCHAR(50)` | NOT NULL | `ACTIVE`, `SUSPENDED`, `TERMINATED` |
| `delegated_scopes` | `JSONB` | NOT NULL | Array of permission scopes (`INSPECT_PROPERTY`, `MANAGE_KEYS`, etc.) |
| `monthly_stipend` | `NUMERIC(12,2)`| DEFAULT 0.00 | Agreed monthly caretaker fee |
| `assigned_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Assignment start timestamp |
| `terminated_at` | `TIMESTAMPTZ` | NULLABLE | Instant permission revocation timestamp |

---

### 2.3 Schema: `maintenance`

#### `maintenance.maintenance_tickets`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Maintenance ticket UUID |
| `property_id` | `VARCHAR(36)` | NOT NULL | Target property UUID |
| `reported_by` | `VARCHAR(36)` | NOT NULL | Reporter user ID (Tenant / Caretaker) |
| `title` | `VARCHAR(255)` | NOT NULL | Short issue title |
| `description` | `TEXT` | NOT NULL | Problem description |
| `priority` | `VARCHAR(50)` | NOT NULL | `P1_EMERGENCY`, `P2_URGENT`, `P3_STANDARD`, `P4_ROUTINE` |
| `status` | `VARCHAR(50)` | NOT NULL | `REPORTED`, `TRIAGED`, `DISPATCHED`, `IN_PROGRESS`, `COMPLETED`, `CLOSED` |
| `assigned_vendor_id`| `VARCHAR(36)` | NULLABLE | Dispatched contractor ID |
| `emergency_escrow_utilized`| `NUMERIC(12,2)`| DEFAULT 0.00 | Float funds mobilized for emergency |
| `response_sla_deadline` | `TIMESTAMPTZ` | NOT NULL | Dynamic SLA response target |
| `resolution_sla_deadline`| `TIMESTAMPTZ` | NOT NULL | Dynamic SLA resolution target |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Creation timestamp |

#### `maintenance.ticket_quotations`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Quotation UUID |
| `ticket_id` | `VARCHAR(36)` | NOT NULL | Associated maintenance ticket UUID |
| `vendor_id` | `VARCHAR(36)` | NOT NULL | Submitting vendor UUID |
| `amount` | `NUMERIC(12,2)` | NOT NULL | Total quoted repair cost |
| `breakdown` | `JSONB` | NOT NULL | Itemized labor and parts breakdown |
| `status` | `VARCHAR(50)` | NOT NULL | `PENDING_REVIEW`, `APPROVED`, `REJECTED` |
| `approved_by` | `VARCHAR(36)` | NULLABLE | Owner user ID who authorized quotation |

#### `maintenance.proof_of_work`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Telemetry proof UUID |
| `ticket_id` | `VARCHAR(36)` | NOT NULL | Associated ticket UUID |
| `vendor_id` | `VARCHAR(36)` | NOT NULL | Submitting contractor UUID |
| `gps_latitude` | `NUMERIC(10,8)`| NOT NULL | Geofence verification latitude |
| `gps_longitude` | `NUMERIC(11,8)`| NOT NULL | Geofence verification longitude |
| `before_images` | `JSONB` | NOT NULL | Array of pre-repair image URLs |
| `after_images` | `JSONB` | NOT NULL | Array of post-repair image URLs |
| `verified_at` | `TIMESTAMPTZ` | NOT NULL | Timestamp of completion verification |

---

### 2.4 Schema: `rental`

#### `rental.rental_listings`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Listing UUID |
| `property_id` | `VARCHAR(36)` | NOT NULL | Target property UUID |
| `monthly_rent` | `NUMERIC(12,2)` | NOT NULL | Monthly rental price |
| `security_deposit` | `NUMERIC(12,2)`| NOT NULL | Security deposit requirement |
| `available_from` | `DATE` | NOT NULL | Earliest occupancy date |
| `furnishing_status` | `VARCHAR(50)` | NOT NULL | `UNFURNISHED`, `SEMI_FURNISHED`, `FULLY_FURNISHED` |
| `status` | `VARCHAR(50)` | NOT NULL | `DRAFT`, `PUBLISHED`, `RESERVED`, `LEASED`, `DELISTED` |

#### `rental.tenant_leads`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Lead UUID |
| `listing_id` | `VARCHAR(36)` | NOT NULL | Associated rental listing UUID |
| `tenant_user_id` | `VARCHAR(36)` | NOT NULL | Inquiring tenant user UUID |
| `stage` | `VARCHAR(50)` | NOT NULL | `NEW_INQUIRY`, `VISIT_SCHEDULED`, `VISITED`, `APPLIED`, `APPROVED`, `CONVERTED` |
| `notes` | `TEXT` | NULLABLE | Caretaker / agent interaction notes |

---

### 2.5 Schema: `document`

#### `document.documents`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Document UUID |
| `property_id` | `VARCHAR(36)` | NOT NULL | Associated property UUID |
| `classification` | `VARCHAR(50)` | NOT NULL | `TITLE_DEED`, `TAX_RECEIPT`, `KHATA_CERTIFICATE`, `ENCUMBRANCE_CERT`, `LEASE_AGREEMENT` |
| `storage_url` | `VARCHAR(500)` | NOT NULL | Secure storage pointer |
| `verification_status`| `VARCHAR(50)` | NOT NULL | `PENDING_REVIEW`, `VERIFIED`, `REJECTED`, `EXPIRED` |
| `expiry_date` | `DATE` | NULLABLE | Document renewal / expiry date |
| `verified_by` | `VARCHAR(36)` | NULLABLE | Legal professional user UUID |

---

### 2.6 Schema: `finance`

#### `finance.expense_records`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | PRIMARY KEY | Expense UUID |
| `property_id` | `VARCHAR(36)` | NOT NULL | Associated property UUID |
| `expense_type` | `VARCHAR(50)` | NOT NULL | `MAINTENANCE`, `PROPERTY_TAX`, `UTILITY`, `CARETAKER_STIPEND`, `MANAGEMENT_FEE` |
| `amount` | `NUMERIC(12,2)` | NOT NULL | Transaction amount |
| `currency` | `VARCHAR(10)` | DEFAULT `'INR'` | Currency code |
| `status` | `VARCHAR(50)` | NOT NULL | `PENDING_APPROVAL`, `APPROVED`, `SETTLED`, `REJECTED` |
| `receipt_url` | `VARCHAR(500)` | NULLABLE | Uploaded proof / receipt file |
| `approved_by` | `VARCHAR(36)` | NULLABLE | Property owner UUID approving expense |

---

## 3. Platform & Cross-Cutting Schemas

### 3.1 Schema: `iam`
- `iam.users`: Platform identity records, global system role, password hashes, active flags, MFA secrets, backup codes, and SSO linkages. (Single identity per user).
- `iam.organizations`: Multi-tenant organization accounts (`id`, `name`, `slug`, `type`, `status`, `owner_user_id`, `settings` JSONB, `created_at`, `updated_at`).
- `iam.organization_memberships`: User memberships in organizations (`id`, `organization_id`, `user_id`, `role`, `status`, `joined_at`, `created_at`, `updated_at`). Unique on `(organization_id, user_id)`.
- `iam.organization_invitations`: Email invitations & membership requests (`id`, `organization_id`, `email`, `role`, `token`, `status`, `invited_by_user_id`, `expires_at`, `created_at`, `updated_at`). Unique on `(organization_id, email, status)`.
- `iam.audit_logs`: Immutable security audit log storing `user_id`, `event_type`, `ip_address`, `user_agent`, `details` (JSONB), and `status`.
- `iam.mfa_protected_routes`: Database-driven protected path patterns (`path_pattern`, `method`, `reverification_mode`: `SESSION_24H` vs `EVERY_TIME`).

### 3.2 Schema: `app_config`
- `app_config.settings`: Key-value application configurations with optional tenant scoping and encryption.
- `app_config.tenant_configurations`: Relational JSONB multi-tenant branding, policy, and fee overrides (`tenant_id`, `section`, `config_data`).

### 3.3 Schema: `common`
- `common.outbox_events`: Transactional outbox pattern table (`id`, `event_name`, `aggregate_id`, `payload`, `status`, `retry_count`, `created_at`, `processed_at`).

