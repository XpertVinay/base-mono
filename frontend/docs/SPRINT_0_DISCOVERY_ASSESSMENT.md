# SPRINT 0: Application Discovery and Technical Assessment

**Workspace:** `/Users/vinaykumar/Desktop/IMP/base/boilerplate/frontend`  
**API Specification Source of Truth:** `http://localhost:4000/api-docs/`  
**API Gateway Ingress:** Port `4000` (Reverse Proxy & gRPC Upstream Dispatchers)  
**Frontend Application:** Port `3000` (React 18.3, Vite 8, TypeScript 5.6)  
**Date:** November 2026  
**Status:** Approved & Accepted

---

## 1. Application Architecture & Technology Stack Assessment

### 1.1 Technology Stack Inventory

| Layer | Technology | Version | Purpose & Architecture Role |
| :--- | :--- | :--- | :--- |
| **Runtime & Build** | Node.js / Vite | `^8.3.8` | High-speed ESM development server & Rollup/Vite bundler with `/api`, `/health`, and `/api-docs` proxy to `http://localhost:4000`. |
| **Core Framework** | React / React DOM | `^18.3.1` | Concurrent Mode UI library. |
| **Language** | TypeScript | `~5.6.3` | Strict type safety (`strict: true`, `noImplicitAny: true`, `noUnusedLocals: true`). |
| **UI State Management** | Zustand | `^5.0.0` | Lightweight reactive UI state (`useAuthStore`, `useApiTrafficStore`). |
| **Server State & Cache**| TanStack React Query | `^5.59.0` | Server-state caching, background revalidation, query invalidation, and optimistic mutations. |
| **Routing** | React Router DOM | `^7.1.5` | Client-side routing, protected routes (`ProtectedRoute`), nested layouts (`AppLayout`, `AuthLayout`). |
| **Styling & Icons** | CSS Modules / Tailwind / Lucide | Lucide `^0.453.0` | Scoped CSS modules with CSS custom property tokens (`--color-primary`, `--color-surface`, etc.) and Lucide icons. |
| **Forms & Validation** | React Hook Form & Zod | `^7.53.0` / `^3.23.8` | Performant un-controlled forms with schema-first validation. |
| **Internationalization**| i18next / react-i18next | `^23.16.0` / `^15.1.0` | Dynamic locale switching (`en`, `de`, `es`, `fr`), locale-aware currency and date formatting. |
| **Test Framework** | Vitest / Testing Library | `^5.1.0` / `^16.0.1` | Fast unit, component, and contract testing with `jsdom`. |

### 1.2 Architectural Patterns
The frontend employs a **Feature-Sliced Clean Architecture**:
* `src/features/<feature-name>/`: Bounded business domains (`auth`, `dashboard`, `records`, `settings`, `iam`, `audit-monitoring`, `api-explorer`, `system`).
* `src/core/`: Cross-cutting technical capabilities:
  * `api/`: Centralized HTTP client (`ApiClient`), envelope unwrapper (`unwrapEnvelope`), telemetric traffic logger (`useApiTrafficStore`), and 10 typed service clients.
  * `auth/`: JWT token storage (`tokenStorage.ts`), crypto utilities (`cryptoUtils.ts`), hierarchical RBAC (`rbac.ts`), and route guard (`ProtectedRoute.tsx`).
  * `tenant/`: Multi-tenant runtime context, dynamic branding tokens, and tenant resolution (`TenantContext.tsx`, `schema.ts`).
  * `config/`: Dynamic microservice base URL and endpoint resolution (`serviceConfig.ts`).
  * `navigation/`: Role-based and feature-flagged navigation structure (`navConfig.ts`).
  * `i18n/`: Locales, currency, date, and number formatters.
* `src/components/`: Reusable primitive UI design system (`Button`, `Badge`, `Card`, `Input`, `Modal`, `Select`, `Spinner`, `Table`, `Alert`).

---

## 2. Frontend Module & Page Inventory

| Module Key | Route(s) | Primary Component(s) | Current State & Data Source | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | `/login`, `/register`, `/auth/callback` | `LoginPage`, `OidcCallbackPage` | `iamApi.login`, `iamApi.register`, `iamApi.oidcCallback`, `authStore` | Connected to backend IAM endpoints. |
| **Dashboard** | `/` | `DashboardPage`, `MetricsWidget`, `ActivityWidget`, `IndustrySpecificWidget`, `QuickActionsWidget` | Mixed: Hardcoded metrics & static mock activity; feature flags via `TenantContext` | **Incomplete**: Needs integration with `auditApi.getMetricsSummary()` and `auditApi.getLogs()`. |
| **Data Records** | `/records`, `/analytics` | `RecordsPage`, `RecordModal` | `recordsApi.list`, `create`, `update`, `delete`, `RecordModal` with Zod | Fully integrated with CRUD and traffic inspector. |
| **API Explorer** | `/api-operations`, `/api-explorer` | `ApiExplorerPage`, `ApiTrafficInspector` | `organizationsApi`, `configApi`, `rbacApi`, `notificationsApi`, `recordsApi`, `apiClient` | Fully integrated CRUD workbench and live communication inspector. |
| **IAM Control Plane**| `/iam`, `/security`, `/users`, `/roles`, `/tenants`, `/sessions`, `/providers` | `IamControlPlanePage` (6 tabs: Profile, Sessions, Token Tools, Federated, Providers, Tenants) | `iamApi.getProfile`, `listSessions`, `revokeSession`, `exchangeToken`, `listOidcProviders` | Connected to backend IAM endpoints. |
| **Audit & Monitoring**| `/audit-monitoring`, `/audit` | `AuditMonitoringPage`, `AuditMonitoringApp` | `auditApi.getLogs`, `getMetricsSummary`, `listAlerts`, `remediateIncident` | Connected to backend Audit microservice. |
| **Settings** | `/settings`, `/organization` | `SettingsPage` (Profile, Security, Notifications, Branding, Features) | Local component state; save button triggers timeout alert without API call | **Incomplete**: Needs integration with `iamApi.updateProfile`, `organizationsApi.update`, and `configApi.set`. |
| **System** | `*`, `/t/:tenantSlug/*` | `NotFoundPage`, `UnknownTenantPage`, `TenantLoadingPage` | Static fallback views | Operational. |

---

## 3. Swagger / OpenAPI 3.0 Endpoint Inventory (`:4000/api-docs/`)

The API Gateway on port `4000` provides **86 REST paths** across 13 DDD microservices, all adhering to the standard response envelope format (`{ status, message, data, errors, meta_data }`).

### 3.1 Endpoint Categorization

| Domain / Service | Base Route Prefix | Endpoint Count | Key CRUD Operations Documented |
| :--- | :--- | :--- | :--- |
| **Health Check** | `/api/v1/health`, `/health` | 4 | `GET /health`, `GET /health/detailed` (System and microservices ping) |
| **IAM & SSO** | `/api/v1/iam` | 26 | `POST /register`, `POST /login`, `GET /profile`, `PUT /users/{id}`, `POST /refresh`, `POST /sso/logout`, `GET/POST /oidc/providers` |
| **Organizations** | `/api/v1/organizations` | 6 | `GET /`, `POST /`, `GET /{idOrSlug}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}`, `GET/POST/DELETE /{id}/members` |
| **Dynamic Config** | `/api/v1/config` | 2 | `GET /`, `POST /`, `GET /{key}`, `PUT /{key}`, `DELETE /{key}`, `GET /client`, `GET /sections` |
| **RBAC Roles & Perms**| `/api/v1/rbac` | 11 | `GET /roles`, `POST /roles`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `GET/PUT /{id}/permissions`, `GET /permissions`, `POST /check-permission` |
| **Orders** | `/api/v1/orders` | 4 | `POST /`, `GET /my`, `GET /{id}`, `POST /{id}/cancel` |
| **Inventory** | `/api/v1/inventory` | 3 | `GET /{productId}`, `POST /reserve`, `GET /stock` |
| **Transactions** | `/api/v1/transactions` | 3 | `POST /initiate`, `POST /webhook`, `GET /{id}` |
| **Assets** | `/api/v1/assets` | 2 | `GET /`, `POST /`, `GET /my`, `DELETE /{id}` |
| **Notifications** | `/api/v1/notifications` | 2 | `POST /`, `GET /`, `POST /batch`, `GET /dry-run/outbox` |
| **Scheduler** | `/api/v1/scheduler` | 2 | `GET /jobs`, `POST /jobs/{id}/trigger` |
| **Search** | `/api/v1/search` | 1 | `GET /search?q=...` |
| **Audit & Metrics** | `/api/v1/audit` | 6 | `GET /logs`, `GET /alerts`, `GET /metrics/summary`, `POST /remediate`, `GET /grafana/annotations` |
| **AI Capabilities** | `/api/v1/ai` | 14 | `GET /capabilities`, `GET/POST /providers`, `POST /tools/call`, `POST /orchestrate` |

---

## 4. API-to-Frontend Traceability & Gap Analysis

```
Swagger Endpoint Path               Frontend Service / Method               UI Consumer Component             Status
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
GET /health                         apiClient.get('/health')                ApiExplorerPage, Header           ✅ Integrated
POST /api/v1/iam/login              iamApi.login()                          LoginPage                         ✅ Integrated
POST /api/v1/iam/register           iamApi.register()                       LoginPage                         ✅ Integrated
GET /api/v1/iam/profile             iamApi.getProfile()                     ProfileAndAuthzTab                ✅ Integrated
GET /api/v1/iam/sso/sessions        iamApi.listSessions()                   SsoSessionsTab                    ✅ Integrated
POST /api/v1/iam/sso/logout         iamApi.logout()                         AppLayout, ProfileAndAuthzTab     ✅ Integrated
GET /api/v1/organizations           organizationsApi.list()                 ApiExplorerPage                   ✅ Integrated
POST /api/v1/organizations          organizationsApi.create()               ApiExplorerPage                   ✅ Integrated
PUT /api/v1/organizations/{id}      organizationsApi.update()               ApiExplorerPage                   ✅ Integrated
DELETE /api/v1/organizations/{id}   organizationsApi.delete()               ApiExplorerPage                   ✅ Integrated
GET /api/v1/config                  configApi.list()                        ApiExplorerPage                   ✅ Integrated
POST /api/v1/config                 configApi.set()                         ApiExplorerPage                   ✅ Integrated
DELETE /api/v1/config/{key}         configApi.delete()                      ApiExplorerPage                   ✅ Integrated
GET /api/v1/rbac/roles              rbacApi.listRoles()                     ApiExplorerPage, ProfileAndAuthz  ✅ Integrated
POST /api/v1/rbac/roles             rbacApi.createRole()                    ApiExplorerPage                   ✅ Integrated
DELETE /api/v1/rbac/roles/{id}      rbacApi.deleteRole()                    ApiExplorerPage                   ✅ Integrated
POST /api/v1/notifications          notificationsApi.send()                 ApiExplorerPage                   ✅ Integrated
GET /api/v1/notifications/dry-run   notificationsApi.getDryRunOutbox()      ApiExplorerPage                   ✅ Integrated
GET /records                        recordsApi.list()                       RecordsPage                       ✅ Integrated
POST /records                       recordsApi.create()                     RecordsPage (RecordModal)         ✅ Integrated
PUT /records/{id}                   recordsApi.update()                     RecordsPage (RecordModal)         ✅ Integrated
DELETE /records/{id}                recordsApi.delete()                     RecordsPage                       ✅ Integrated
GET /api/v1/audit/logs              auditApi.getLogs()                      AuditMonitoringApp                ⚠️ Needs Dashboard Feed
GET /api/v1/audit/metrics/summary   auditApi.getMetricsSummary()            KpiMetricsRow                     ⚠️ Needs Dashboard KPI
PUT /api/v1/iam/users/{id}          (Available in iamApi)                   SettingsPage                      ❌ Gap (Settings hardcoded)
PUT /api/v1/config/{key} (Branding) (Available in configApi)                SettingsPage                      ❌ Gap (Branding not saved)
GET /api/v1/orders/my               ordersApi.getMyOrders()                 (Service only)                    ❌ Gap (Needs UI View)
GET /api/v1/inventory/stock         inventoryApi.getStock()                 (Service only)                    ❌ Gap (Needs UI View)
GET /api/v1/assets                  assetsApi.list()                        (Service only)                    ❌ Gap (Needs UI View)
GET /api/v1/scheduler/jobs          schedulerApi.listJobs()                 (Service only)                    ❌ Gap (Needs UI View)
```

---

## 5. Technical Improvement Recommendations

1. **Centralize & Harmonize Service Config**:
   - Consolidate all endpoint construction into `serviceConfig.ts` with standardized timeout handling via `AbortController` and unified error interception.
2. **Eliminate Hardcoded Dashboard State**:
   - Connect `MetricsWidget` to live metrics (`auditApi.getMetricsSummary()`, `recordsApi.list()`).
   - Connect `ActivityWidget` to live audit stream (`auditApi.getLogs()`).
3. **Wire SettingsPage Form Submissions**:
   - Connect Profile Settings tab to `iamApi.updateProfile` (or `PUT /api/v1/iam/users/{id}`).
   - Connect Branding Settings tab to `configApi.set` (updating CSS white-label tokens).
4. **Surface Secondary Domain Operations in Dedicated Views**:
   - Provide visual workflows for Assets management, Orders & Inventory tracking, and Scheduler jobs execution.
5. **Form UX & Robustness**:
   - Prevent duplicate form submissions with automatic mutation disablement and unified toast notifications.
6. **Automated Test Coverage**:
   - Add contract validation tests for positive (200/201), negative (400/401/403/404/500/timeout), schema matching, and auth token lifecycle.

---

## 6. Sprint-Wise Implementation Backlog

| Sprint | Objective & Scope | Key Milestones & Target Deliverables |
| :--- | :--- | :--- |
| **Sprint 0** | **Discovery & Assessment** | Complete repository audit, Swagger endpoint inventory, gap analysis, backlog formulation, baseline test verification. *(Current)* |
| **Sprint 1** | **API Architecture & Common Framework** | Enhance `ApiClient` with configurable request timeout (`AbortController`), retry policies, centralized error dispatching, and environment config. |
| **Sprint 2** | **Core Module API Integration** | Connect `DashboardPage` widgets to real backend telemetry (`auditApi`, `recordsApi`) and `SettingsPage` tabs to `iamApi` and `configApi`. |
| **Sprint 3** | **Remaining Module API Integration** | Integrate secondary domains (Assets, Orders, Inventory, Scheduler, Search) into the UI workbench, verifying all request/response models against Swagger. |
| **Sprint 4** | **Frontend Enhancement & Code Optimization** | Prevent duplicate form submissions, improve loading skeletons/empty states, optimize query caching, verify responsive design, eliminate dead code. |
| **Sprint 5** | **Integration Testing & Contract Validation** | Build exhaustive test suites covering positive, negative, contract schema, and authentication boundary tests for all integrated endpoints. |
| **Sprint 6** | **E2E Workflow & Regression Testing** | End-to-end user journey tests (Login $\to$ Dashboard telemetry $\to$ CRUD operations $\to$ Settings persistence $\to$ Audit log inspection), regression validation. |
| **Sprint 7** | **Performance, Security & Final QA** | Response time benchmarks, OWASP security audit (no exposed secrets, XSS sanitation, device fingerprint verification), static analysis, zero-defect release gate. |
| **Sprint 8** | **Documentation, Handover & Release Readiness** | Final release notes, complete API integration matrix, deployment guides, sprint-by-sprint completion reports, project sign-off. |

---

## 7. Baseline Quality Gate Verification

Before commencing code modifications in Sprint 1, the baseline build, linting, type safety, and test suites were executed:

* **Vitest Suite Execution**:
  ```bash
  npm test -- --run
  ```
  **Result:** 14 test files passed, **91/91 tests passed (100%)**.
* **TypeScript Typecheck**:
  ```bash
  npm run typecheck
  ```
  **Result:** `tsc --noEmit` exited with code 0 (zero errors).
* **Production Build**:
  ```bash
  npm run build
  ```
  **Result:** `tsc -b && vite build` succeeded, generating optimized assets in `dist/`.

