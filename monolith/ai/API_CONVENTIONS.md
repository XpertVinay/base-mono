# Real Estate CareTaking — API Conventions & Protocols

**Document:** `API_CONVENTIONS.md`  
**Version:** 1.0  
**Base URL:** `/api`  
**Data Format:** JSON (`application/json`)  
**Specification Standard:** OpenAPI 3.0 compatible contracts defined in `@monolith/contracts`

---

## 1. URL Structure & Route Conventions

Endpoints are grouped logically by module domain:

```
/api/<module-name>/[sub-resource]/[resource-id]/[action]
```

### Route Table
| Module | Base Path | Example Endpoints |
| :--- | :--- | :--- |
| **IAM** | `/api/iam` | `POST /api/iam/login`, `POST /api/iam/mfa/verify`, `GET /api/iam/.well-known/jwks.json` |
| **Properties** | `/api/properties` | `GET /api/properties`, `POST /api/properties`, `PATCH /api/properties/:id/status` |
| **Caretaking** | `/api/caretaking` | `POST /api/caretaking/assignments`, `DELETE /api/caretaking/assignments/:id` |
| **Maintenance** | `/api/maintenance` | `GET /api/maintenance/tickets`, `POST /api/maintenance/tickets/:id/quotations` |
| **Rentals** | `/api/rentals` | `GET /api/rentals/listings`, `POST /api/rentals/leads` |
| **Documents** | `/api/documents` | `GET /api/documents`, `POST /api/documents/:id/verify` |
| **Finance** | `/api/finance` | `GET /api/finance/expenses`, `POST /api/finance/expenses/:id/approve` |
| **Config** | `/api/config` | `GET /api/config/:key`, `POST /api/config/tenant` |
| **Assets** | `/api/assets` | `POST /api/assets/upload`, `GET /api/assets/:id` |
| **Gateway** | `/health` | `GET /health/live`, `GET /health/ready` |

---

## 2. HTTP Request Headers

Clients (Web frontend, mobile app, external systems) must provide standard context headers:

| Header | Type | Description | Mandatory? |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | Bearer token format: `Bearer <RS256-JWT>` | Yes (for protected routes) |
| `X-Correlation-ID` | `UUID` | Distributed tracing request correlation identifier | Optional (Auto-generated if absent) |
| `X-Device-Fingerprint` | `string` | Persistent client hardware/browser SHA-256 fingerprint for anti-hijacking | Mandatory for authenticated sessions |
| `X-Tenant-ID` | `string` | Target organization / tenant UUID | Mandatory for multi-tenant requests |
| `X-Tenant-Slug` | `string` | Alternative subdomain / slug identifier | Optional |

---

## 3. Standard Response Envelopes

All API responses follow a consistent, predictable JSON schema.

### 3.1 Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "prop-101",
    "title": "Sobha Ruby Apartment #402",
    "status": "ACTIVE",
    "category": "RESIDENTIAL"
  },
  "error": null,
  "timestamp": "2026-10-30T16:20:00.000Z",
  "correlationId": "8f8c4b26-4d2a-4db5-9e67-d86db49a8fe0"
}
```

### 3.2 Error Response (`400`, `401`, `403`, `404`, `422`, `500`)
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "User does not have permission scope: AUTHORIZE_MINOR_REPAIRS",
    "details": [
      {
        "field": "scope",
        "issue": "Missing required caretaker assignment permission"
      }
    ]
  },
  "timestamp": "2026-10-30T16:20:01.000Z",
  "correlationId": "8f8c4b26-4d2a-4db5-9e67-d86db49a8fe0"
}
```

---

## 4. HTTP Status Code Guidelines

| Code | Meaning | Usage Scenario |
| :--- | :--- | :--- |
| `200 OK` | Request succeeded | Read queries, successful updates |
| `201 Created` | Resource created | Successful entity creation via `POST` |
| `204 No Content` | Succeeded with no body | Successful deletions |
| `400 Bad Request` | Malformed syntax | Malformed JSON or invalid query params |
| `401 Unauthorized` | Unauthenticated | Missing, expired, or invalid JWT |
| `403 Forbidden` | Insufficient access | Authenticated user lacks required role/permission |
| `404 Not Found` | Entity absent | Requested resource ID does not exist |
| `409 Conflict` | State conflict | Unique constraint violation or concurrency collision |
| `422 Unprocessable`| Validation error | Request body failed Zod schema rules |
| `500 Server Error` | Unhandled failure | Unexpected exception (error details masked in prod) |

---

## 5. Pagination, Sorting & Filtering

Collections support standardized pagination query parameters:

```
GET /api/properties?page=1&limit=20&sort=createdAt&order=desc&status=ACTIVE
```

### Response Meta Structure:
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 142,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  },
  "error": null,
  "timestamp": "2026-10-30T16:20:00.000Z",
  "correlationId": "8f8c4b26-4d2a-4db5-9e67-d86db49a8fe0"
}
```

