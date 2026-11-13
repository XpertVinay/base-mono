# API Documentation & Frontend-to-Backend CRUD Communication Guide

**Target API Specification:** `http://localhost:4000/api-docs/`  
**API Gateway / Monolith Ingress:** Port `4000`  
**Frontend Vite Dev Server:** Port `3000`  
**Status:** Production Ready & Verified (91/91 Passing Automated Tests)

---

## 1. Architectural Overview & Network Visibility

The enterprise platform unifies high-performance backend microservices (and modular monolith services) behind a central reverse proxy and API Gateway running on port `4000`, providing full interactive OpenAPI 3.0 documentation at:

```
http://localhost:4000/api-docs/
```

To eliminate black-box API interactions and maximize visibility into frontend-to-backend communication, the frontend features:
1. **Interactive API Operations & Live CRUD Workbench (`/api-operations`)**: Direct visual controls to execute full **Create, Read, Update, and Delete** operations across the documented services (Organizations, Dynamic Config, RBAC Roles, Notifications, and Tenant Data Records).
2. **Real-Time API Communication Inspector Drawer (`ApiTrafficInspector`)**: A persistent slide-over drawer capturing every outbound HTTP request and inbound response in real-time, detailing exact headers, JSON payloads, response envelopes, roundtrip latency, and one-click executable cURL commands.
3. **Adaptive Connection Telemetry**: Seamless auto-routing between the live API Gateway (`http://localhost:4000`) and the zero-dependency simulation fallback engine when developing offline.

```
┌────────────────────────────────────────────────────────┐
│               Frontend React Application               │
│                     (Port 3000)                        │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
         (Proxy: /api, /health)   (Traffic Telemetry)
                ▼                        ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│  Central API Gateway & Specs  │ │ ApiTrafficInspector  │
│    (http://localhost:4000)    │ │   & Traffic Store    │
├───────────────────────────────┤ ├──────────────────────┤
│ • /api-docs/ (Swagger UI)     │ │ • Method & Endpoint  │
│ • /api/v1/organizations       │ │ • Injected Headers   │
│ • /api/v1/config              │ │ • Latency (ms)       │
│ • /api/v1/rbac/roles          │ │ • Response Envelope  │
│ • /api/v1/notifications       │ │ • Executable cURL    │
│ • /api/v1/records             │ │ • Swagger Doc Link   │
└───────────────────────────────┘ └──────────────────────┘
```

---

## 2. Standard Response Envelope Specification

Every controller and service response across the platform strictly adheres to the standard microservices envelope format:

```json
{
  "status": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "errors": [],
  "meta_data": {
    "requestId": "req-1731500000000-abc12",
    "timestamp": "2026-11-13T12:00:00.000Z",
    "debug": {
      "service": "Organizations",
      "env": "production"
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3
    },
    "further_steps": [
      "Verify updated organization profile in /api/v1/organizations/{id}"
    ]
  }
}
```

### Error Envelope Handling
When an operation fails (e.g., validation error, unauthorized access, or resource conflict), the error envelope is unwrapped into typed domain exceptions (`ApiServiceError`):

```json
{
  "status": false,
  "message": "Validation failed for organization creation",
  "data": null,
  "errors": [
    { "code": "SLUG_CONFLICT", "message": "Slug 'apex-health' is already claimed." }
  ],
  "meta_data": {
    "requestId": "req-...",
    "further_steps": ["Choose a different slug parameter."]
  }
}
```

---

## 3. Mandatory Security & Tracing Headers

Every request from the frontend injects standard enterprise security headers:

| Header | Description | Example Value |
| :--- | :--- | :--- |
| `X-Tenant-ID` | Active tenant identifier for multi-tenant data isolation | `ten_apex_health_01` |
| `X-Tenant-Slug` | Clean tenant URL slug | `apex-health` |
| `X-Device-Fingerprint` | Hardware/browser fingerprint preventing JWT token hijacking | `web-1920x1080-m7c...` |
| `Authorization` | Cryptographic JWT Bearer token (RS256 / HMAC) | `Bearer eyJhbGci...` |
| `x-correlation-id` | Distributed correlation trace ID propagated across services | `req-m7cq9-781a` |
| `x-request-id` | Ingress request ID matching correlation trace | `req-m7cq9-781a` |

---

## 4. Implemented CRUD Operations

### 4.1 Organizations Service (`/api/v1/organizations`)
* **List Organizations (`GET`)**: Query with keyword search, `status` filter (`ACTIVE`, `SUSPENDED`, `TRIAL`, `DEACTIVATED`), `tier` filter (`FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`), and pagination.
* **Create Organization (`POST`)**: Provision a new tenant organization with name, slug, industry, tier, custom domain, and owner contact.
* **Get Organization (`GET /:idOrSlug`)**: Retrieve complete organization record by UUID or unique slug.
* **Update Organization (`PUT` / `PATCH /:id`)**: Full or partial attribute update.
* **Delete Organization (`DELETE /:id`)**: Soft-delete organization with confirmation dialog.

### 4.2 Dynamic System Configuration (`/api/v1/config`)
* **List Configurations (`GET`)**: Inspect all stored dynamic runtime key-value pairs.
* **Set / Upsert Config (`POST` / `PUT /:key`)**: Dynamically update configuration keys with runtime targets (`BACKEND`, `FRONTEND`, `ALL`) and descriptions.
* **Get Config by Key (`GET /:key`)**: Retrieve single configuration value.
* **Delete Config (`DELETE /:key`)**: Purge dynamic configuration entry.
* **Client Map (`GET /client`)**: Retrieve frontend-facing configuration bundle.

### 4.3 Roles & Permissions RBAC (`/api/v1/rbac/roles`)
* **List Roles (`GET`)**: Retrieve tenant roles with system role tags and capability badges.
* **Create Custom Role (`POST`)**: Provision custom security roles with scoped permissions.
* **Get Role Details (`GET /:id`)**: Retrieve role permissions and assigned users.
* **Update Role (`PUT /:id`)**: Edit role name and description.
* **Delete Role (`DELETE /:id`)**: Delete non-system custom roles.

### 4.4 Notifications & Outbox (`/api/v1/notifications`)
* **Dispatch Notification (`POST`)**: Multi-channel notification engine (Email, SMS, WhatsApp, Push) supporting provider adapters (SendGrid, Twilio, FCM, Meta Cloud, Mock).
* **DRY-Run Simulation**: Toggle safe test execution recording payloads to the developer outbox without exhausting live quotas.
* **Outbox Inspection (`GET /dry-run/outbox`)**: View simulated dispatch payloads.

### 4.5 Data Records (`/records`)
* Complete CRUD for tenant vertical entities with live communication visibility.

---

## 5. Telemetric Traffic Inspector Features

The persistent `ApiTrafficInspector` console provides:
* **Real-Time Request Stream**: Visual listing with method badges (`GET` blue, `POST` green, `PUT` amber, `DELETE` red), status code badges (`200 OK`, `201 Created`, `400 Error`), latency in milliseconds, and service tags.
* **Overview & Executable cURL**: Instant one-click copying of terminal-reproducible `curl` commands complete with headers, cookies, and JSON body.
* **Headers Inspector**: Key-value table of all forwarded client and tenant headers.
* **Request & Response Viewers**: Formatted JSON viewers with copy-to-clipboard actions.
* **Direct Swagger Deep-Linking**: One-click jump to the exact endpoint definition at `http://localhost:4000/api-docs/`.

---

## 6. Verification & Automated Test Status

All components, API wrappers, standard envelope parsers, and UI views are covered by automated Vitest suites:

```bash
cd boilerplate/frontend
npm test -- --run
```

**Verification Results:**
* **Test Files:** 14 passed (14 total)
* **Test Suites:** 91 passed (91 total)
* **TypeScript Compilation:** Zero errors (`tsc --noEmit`)
* **Production Bundle Build:** Passed (`tsc -b && vite build`)

