# AGENTS.md
# Enterprise White-Label Frontend — AI Engineering Governance & Architecture Manual

**Project:** Enterprise Multi-Tenant White-Label React Platform (`enterprise-white-label-frontend`)  
**Status:** Mandatory  
**Applies To:** All AI coding agents, automated development workflows, and human engineering contributors.  
**Subsystem Root:** `/Users/vinaykumar/Desktop/IMP/base/boilerplate/frontend`  
**Runtime Requirement:** Node.js $\ge 24.0.0$ (`.nvmrc: 24`)  
**Package Manager:** `npm` (strictly enforce `package-lock.json`)

---

## 1. Mission and Operating Principles

You are an AI software engineering agent responsible for maintaining, extending, and testing the Enterprise Multi-Tenant White-Label Frontend platform. The platform is an industry-agnostic, lightweight, production-grade React SPA designed to serve multiple businesses, customer organizations, and brands from a single unified codebase with zero code duplication.

Your mission is to deliver secure, testable, maintainable, performant, and accessible frontend code while strictly preserving multi-tenant isolation, deterministic branding token injection, and decoupled microservice communication contracts.

### 1.1 Core Operating Rules

1. **Inspect Before Modifying**: Never assume a UI component, hook, tenant configuration property, or service endpoint helper is missing. Search existing source code, configuration files, and AST exports before authoring new code.
2. **One Task, One Bounded Scope**: Confine code changes strictly to `/Users/vinaykumar/Desktop/IMP/base/boilerplate/frontend`. Do not modify sibling projects (e.g., `boilerplate/monolith`, `boilerplate/backend-ms`, `boilerplate/mobile`, `RAG-agent`).
3. **Repository as Memory**: Document architectural adjustments, new tenant profiles, and service route definitions directly in repository markdown files and TypeScript configuration manifests.
4. **Evidence-Based Progression**: Never mark a task as complete or claim a build, test suite, or typecheck succeeded without **observed terminal execution and passing status**. Speculative "done" claims are strictly forbidden.
5. **Zero-Trust Multi-Tenancy**: Every outbound API request must carry appropriate tenant scoping headers (`X-Tenant-ID`, `X-Tenant-Slug`) and anti-hijacking device fingerprints (`X-Device-Fingerprint`).
6. **No CSS-in-JS Runtimes**: All styling must use pure CSS Custom Properties (Design Tokens) injected into `:root` and scoped via CSS Modules (`*.module.css`). Never introduce runtime CSS-in-JS libraries (e.g., styled-components, emotion).
7. **Strict Type Safety**: TypeScript strict mode is enabled with `noImplicitAny`, `noUncheckedIndexedAccess`, and `noUnusedLocals`. Never use `any` unless strictly typing external untyped library boundaries, and prefer `unknown` with Zod parsing.

### 1.2 Anti-Hallucination & Scope Creep Prevention Matrix

| Risk / Failure Mode | Root Cause | Mandatory Prevention Protocol | Operational Enforcement |
| :--- | :--- | :--- | :--- |
| **Agent invents new styling systems** | Assuming Tailwind, MUI, or styled-components | Inspect `src/styles/tokens.css` and existing `*.module.css` files | Use CSS Custom Properties (`var(--color-primary)`) inside CSS Modules only. |
| **Agent hardcodes tenant brands** | Conditional branching on tenant ID in components | Review `TenantConfig` and White-Label Design System | All styling and branding must flow dynamically through `applyThemeTokens()` and CSS variables. |
| **Agent bypasses ApiClient / ServiceConfig** | Direct raw `fetch` or Axios instantiation | Use `apiClient` or `ApiClient.forService('<service>')` | Injects `X-Tenant-ID`, `X-Device-Fingerprint`, and Bearer tokens to protected endpoints automatically. |
| **Agent breaks deterministic tenant resolution** | Modifying resolver priority order | Consult `src/core/tenant/resolver.ts` | Preserve 7-tier resolution hierarchy (Dev Query $\to$ Dev Storage $\to$ Path $\to$ Subdomain $\to$ Custom Domain $\to$ Dev Fallback $\to$ Unknown). |
| **Agent uses wrong package manager** | Running `pnpm` or `yarn` by mistake | Verify lockfile: `package-lock.json` is present | Run `npm install`, `npm run dev`, `npm run test`. |
| **Agent skips automated tests** | Premature completion | Definition of Done validation gate | Execute `npm run test` (Vitest) and `npm run typecheck` (`tsc --noEmit`) before completing any task. |

---

## 2. Workspace Topology & Directory Structure

```plaintext
boilerplate/frontend/
├── index.html                   # HTML5 entry template with dynamic favicon & font preconnects
├── package.json                 # Node dependencies, scripts, engines (Node >= 24)
├── package-lock.json            # Deterministic lockfile (npm)
├── .nvmrc                       # Node runtime pin (24)
├── tsconfig.json                # TypeScript strict configuration (target: ES2022, moduleResolution: bundler)
├── tsconfig.node.json           # Node environment config for Vite/Vitest configs
├── vite.config.ts               # Vite 8 config with '@' alias, port 3000, and backend proxy
├── vitest.config.ts             # Vitest 5 config (jsdom environment, setupFiles: ./src/test/setup.ts)
├── .eslintrc.cjs                # ESLint configuration with TypeScript and React Hook rules
├── .prettierrc                  # Prettier formatting rules (singleQuote: true, printWidth: 100)
├── .env.example                 # Environment template with microservices gateway & tenant variables
├── .env                         # Local environment overrides
├── dist/                        # Production build output generated by 'npm run build'
├── public/                      # Static assets, fallback logos, and favicons
└── src/
    ├── main.tsx                 # React DOM root render mount (React.StrictMode)
    ├── App.tsx                  # Root wrapper (ErrorBoundary -> QueryClientProvider -> TenantProvider -> BrowserRouter -> AppRoutes)
    ├── vite-env.d.ts            # Ambient typing for Vite environment variables (`ImportMetaEnv`)
    ├── components/
    │   ├── common/              # Cross-cutting platform components
    │   │   ├── ErrorBoundary.tsx    # React error boundary with fallback UI
    │   │   ├── FeatureGate.tsx      # Feature flag component wrapper (`<FeatureGate feature="...">`)
    │   │   ├── LanguageSwitcher.tsx # Multi-language selector dropdown (i18next)
    │   │   └── TenantLogo.tsx       # Dynamic tenant brand logo and text
    │   └── ui/                  # Reusable white-label design system (CSS Modules)
    │       ├── index.ts             # Public barrel export for all UI primitives
    │       ├── Alert/               # Status alert banners (info, success, warning, error)
    │       ├── Badge/               # Visual tag indicators with dot status options
    │       ├── Button/              # Multi-variant button (primary, secondary, outline, ghost, danger)
    │       ├── Card/                # Flexible container with header, body, and actions
    │       ├── Input/               # Accessible form input with error states
    │       ├── Modal/               # Keyboard-accessible dialog overlay
    │       ├── Select/              # Stylized native select component
    │       ├── Spinner/             # Animated SVG loading indicator
    │       └── Table/               # Data grid with zebra striping and hover highlights
    ├── core/                    # Platform foundations
    │   ├── api/                 # Networking and query infrastructure
    │   │   ├── client.ts            # Reusable ApiClient with auth, tenant, and device fingerprint headers
    │   │   ├── mockBackend.ts       # Offline in-memory mock repository for standalone dev/testing
    │   │   ├── queryClient.ts       # Configured TanStack React Query client instance
    │   │   └── types.ts             # ApiClientOptions, ApiResponse, ApiError definitions
    │   ├── auth/                # Identity and session management
    │   │   ├── authStore.ts         # Zustand store (session tokens, user profile, SSO sessions, SLO)
    │   │   ├── tokenStorage.ts      # Dedicated access token memory/localStorage manager
    │   │   ├── ProtectedRoute.tsx   # React Router route guard enforcing auth, tenant match, and RBAC
    │   │   ├── rbac.ts              # Role normalizer (`ADMIN`, `SUPPORT`, `USER`) & permission matrix
    │   │   └── types.ts             # User, UserRole, AuthState, and AuthActions contracts
    │   ├── config/              # Microservice routing configuration
    │   │   ├── serviceConfig.ts     # Unified BaseUrl resolver and endpoint directory for 14 backend services
    │   │   └── index.ts             # Barrel export for config helpers and types
    │   ├── i18n/                # Internationalization engine
    │   │   ├── index.ts             # i18next initialization with en, de, es, fr dictionaries
    │   │   ├── formatters.ts        # Locale-aware Intl helpers (formatCurrency, formatNumber, formatDate, formatTime)
    │   │   └── locales/             # Static translation dictionaries (en.ts, de.ts, es.ts, fr.ts)
    │   ├── tenant/              # Multi-tenancy kernel
    │   │   ├── schema.ts            # Zod validation schemas for TenantConfig, identity, branding, features
    │   │   ├── types.ts             # TypeScript definitions for TenantConfig, branding, and navigation
    │   │   ├── registry.ts          # Static pre-configured demo tenants (Apex Health, Nexus Logistics, Aura Fintech)
    │   │   ├── resolver.ts          # Deterministic 7-tier tenant resolution engine
    │   │   ├── adapter.ts           # Remote backend tenant loader and trusted origins validator
    │   │   ├── TenantContext.tsx    # React Context provider exposing active tenant and switcher
    │   │   ├── useTenant.ts         # Consumer hook for tenant context
    │   │   └── DevTenantSwitcher.tsx# Dropdown for swapping tenants during local dev and testing
    │   └── theme/               # Dynamic CSS Custom Property injection
    │       └── applyTheme.ts        # Injects --color-*, --radius-*, --font-family into document.documentElement
    ├── features/                # Domain-specific feature modules
    │   ├── auth/                # Authentication screens and IAM integrations
    │   │   ├── LoginPage.tsx        # Branded login form with demo credentials auto-fill
    │   │   ├── OidcCallbackPage.tsx # OAuth2 / OIDC federation callback and token redemption
    │   │   ├── services/iamApi.ts   # Comprehensive typed API integration with IAM Gateway (:4000)
    │   │   ├── types/iam.types.ts   # IAM DTOs (SSO handoff, tokens, OIDC providers, tenants)
    │   │   └── utils/cryptoUtils.ts # PKCE pair generator (Web Crypto SHA-256), Base64URL, JWT decoder
    │   ├── dashboard/           # Branded executive overview
    │   │   ├── DashboardPage.tsx    # Dynamic widget grid based on tenant configuration
    │   │   └── widgets/             # MetricsWidget, ActivityWidget, IndustrySpecificWidget, QuickActionsWidget
    │   ├── iam/                 # Identity & Access Control Plane
    │   │   ├── IamControlPlanePage.tsx  # Central admin cockpit for IAM
    │   │   └── components/          # ProfileAndAuthzTab, SsoSessionsTab, SsoTokenToolsTab, FederatedIdentitiesTab, OidcProvidersAdminTab, TenantsAdminTab
    │   ├── audit-monitoring/    # Real-time event and audit monitoring
    │   │   ├── AuditMonitoringApp.tsx   # Standalone embedded app container
    │   │   ├── AuditMonitoringPage.tsx  # Full audit page with KPI row, log explorer, telemetry, alerts
    │   │   ├── config.ts            # Microservice endpoint config for Audit, Grafana, Prometheus
    │   │   ├── services/auditApi.ts # Audit event fetching, mock fallback, and incident remediation
    │   │   ├── types.ts             # AuditLogItem, AlertIncident, MetricsSummary models
    │   │   ├── styles/audit-mfe.css # Scoped styling for audit widgets
    │   │   └── components/          # AuditLogExplorer, DrawerInspection, EmergencyBanner, AlertCenterTab, PrometheusTelemetryTab, GrafanaDashboardTab, KpiMetricsRow
    │   ├── records/             # Schema-driven Entity Explorer
    │   │   ├── RecordsPage.tsx      # Filterable and searchable entity record catalog
    │   │   ├── RecordModal.tsx      # Modal form powered by react-hook-form + Zod validation
    │   │   └── recordSchema.ts      # Zod schema for entity records (title, category, amount, status)
    │   ├── settings/            # Branding and configuration inspector
    │   │   └── SettingsPage.tsx     # Live CSS token viewer, localization overview, and tenant attributes
    │   └── system/              # Status and boundary pages
    │       ├── NotFoundPage.tsx     # 404 route fallback
    │       ├── TenantLoadingPage.tsx# Full-screen loader while tenant resolves
    │       └── UnknownTenantPage.tsx# Error screen shown when domain does not match any tenant in production
    ├── layouts/                 # Structural shell components
    │   ├── AppLayout.tsx        # Main application layout: dynamic navigation, user status, logout, mobile menu
    │   └── AuthLayout.tsx       # Centered card layout for public authentication and federation screens
    ├── routes/                  # Navigation declarations
    │   └── index.tsx            # React Router 7 setup with public vs protected route definitions
    ├── styles/                  # Global style foundation
    │   ├── tokens.css           # Master CSS Custom Property variables (colors, spacing, shadows, radii)
    │   ├── animations.css       # Keyframes for pulse, glow, fade-in, and slide transitions
    │   └── global.css           # CSS reset, typography, and utility classes
    └── test/                    # Automated Vitest test suites
        ├── setup.ts             # Vitest test setup (jest-dom matchers, localStorage cleanup, React cleanup)
        ├── vitest-dom.d.ts      # Custom DOM matchers TypeScript definition
        ├── apiClient.test.ts    # Tests for header injection, token attachment, and mock fallback
        ├── auditMonitoringBaseUrl.test.tsx # Tests for Audit BaseUrl resolution and service config
        ├── Button.test.tsx      # Tests for UI Button component variants and events
        ├── formatters.test.ts   # Tests for currency, date, time, and number localization
        ├── iamAuthComponents.test.tsx # Tests for LoginPage and OidcCallbackPage flows
        ├── iamUtilsAndApi.test.ts # Tests for cryptoUtils, PKCE, and IAM error extractors
        ├── serviceConfig.test.ts # Tests for unified 14-service BaseUrl resolution
        ├── tenantResolver.test.ts # Tests for 7-tier tenant resolution engine
        ├── tenantSchema.test.ts # Tests for Zod TenantConfig validation
        └── themeApply.test.ts   # Tests for dynamic CSS variable injection into DOM
```

---

## 3. Master Command Reference

All commands must be executed from `/Users/vinaykumar/Desktop/IMP/base/boilerplate/frontend`:

```bash
cd /Users/vinaykumar/Desktop/IMP/base/boilerplate/frontend
```

### 3.1 Primary Commands

| Action | Command | Description |
| :--- | :--- | :--- |
| **Install Dependencies** | `npm install` | Installs pinned packages using `package-lock.json`. Strictly use `npm`. |
| **Development Server** | `npm run dev` | Launches Vite dev server on port `3000` (proxies `/api` to `:4000`). |
| **Production Build** | `npm run build` | Compiles project references (`tsc -b`) and bundles static assets (`vite build`). |
| **Preview Build** | `npm run preview` | Starts local HTTP server on port `3000` to serve the `dist/` production build. |
| **Run Unit Tests** | `npm run test` | Executes Vitest test runner across all test suites (`vitest run`). |
| **Watch Unit Tests** | `npm run test:watch` | Runs Vitest in interactive watch mode (`vitest`). |
| **Test Coverage** | `npm run test:coverage` | Generates full test coverage report (`vitest run --coverage`). |
| **Type Checking** | `npm run typecheck` | Executes TypeScript type checker with zero emit (`tsc --noEmit`). |
| **Linting** | `npm run lint` | Runs ESLint on `src/` files with `--report-unused-disable-directives`. |

### 3.2 Pre-Commit & Completion Verification Sequence

Before concluding any turn or declaring a task complete, you must execute and observe passing status on:

```bash
# 1. Verify TypeScript types
npm run typecheck

# 2. Verify all Vitest test suites pass (10+ test files, 47+ tests)
npm run test

# 3. Verify production compilation and asset bundling
npm run build
```

---

## 4. Architectural Foundations & Subsystems

### 4.1 Deterministic Tenant Resolution Engine

When a user visits the platform, `src/core/tenant/resolver.ts` resolves their tenant context according to a deterministic 7-stage precedence cascade:

```
[Incoming Request]
       │
       ▼
 1. Dev Query Parameter (?tenant=<slug>) ──[Matches]──> Resolved (dev_override)
       │
       ▼
 2. LocalStorage Override (dev_tenant_override) ──[Matches]──> Resolved (dev_override)
       │
       ▼
 3. Path Prefix (/t/:slug or /tenant/:slug) ──[Matches]──> Resolved (path)
       │
       ▼
 4. Subdomain (<slug>.example.com) ──[Matches]──> Resolved (subdomain)
       │
       ▼
 5. Custom Domain (portal.enterprise.io via backend adapter) ──[Matches]──> Resolved (custom_domain)
       │
       ▼
 6. Development Fallback (localhost / preview) ──[Is Dev?]──> Resolved: 'apex-health' (default)
       │
       ▼
 7. Unknown Tenant Guard (Production Unmapped Domain) ──> Status: 'unknown' (Render UnknownTenantPage)
```

- In development, the active tenant can be swapped dynamically using the header `DevTenantSwitcher` or query parameter `?tenant=<slug>`.
- In production, unmapped or invalid hostnames reject gracefully into `<UnknownTenantPage />` without leaking internal application state.
- Remote tenant payloads received via `src/core/tenant/adapter.ts` are strictly validated using `validateTenantConfig()` (`schema.ts`).
- If a remote tenant's `runtime.apiBaseUrl` fails the `isTrustedApiUrl()` origin whitelist, it is automatically demoted to the system default API base URL.

### 4.2 White-Label Theming & Dynamic Token Injection

The platform completely decouples React components from tenant visual identity. No component contains hardcoded colors or conditional tenant branches for styling.

1. **Token Injection (`applyThemeTokens` in `src/core/theme/applyTheme.ts`)**:
   - When the tenant resolves, `TenantProvider` calls `applyThemeTokens(tenant.branding)`.
   - The injector maps branding hex colors into `:root` CSS custom properties:
     - `--color-primary`, `--color-primary-hover`, `--color-primary-subtle`
     - `--color-secondary`, `--color-secondary-hover`, `--color-secondary-subtle`
     - `--color-accent`, `--color-accent-hover`, `--color-accent-subtle`
     - `--color-background`, `--color-surface`, `--color-surface-hover`
     - `--color-text`, `--color-muted`, `--color-border`
     - `--font-family`, `--radius-md`, `--radius-sm`, `--radius-lg`
   - Sets `document.documentElement.setAttribute('data-theme', branding.themeMode || 'dark')`.
   - Updates `document.title` to `${tenant.identity.displayName} | Enterprise Portal`.
   - Updates the browser tab favicon link dynamically.

2. **Component Consumption**:
   - UI components consume CSS variables directly inside their localized CSS module:
     ```css
     /* Button.module.css */
     .primary {
       background-color: var(--color-primary);
       color: #ffffff;
       border-radius: var(--radius-md);
     }
     .primary:hover {
       background-color: var(--color-primary-hover);
     }
     ```

### 4.3 State Segregation Architecture

State is strictly partitioned based on its lifecycle and persistence:

1. **Client UI & Session State (Zustand 5)**:
   - Managed in `src/core/auth/authStore.ts`.
   - Holds the authenticated `User`, `token` (JWT access token), `refreshToken`, `sessionId` (SSO session identifier), `connectionMode` (`live` vs `demo`), and active login/logout methods.
   - Synchronizes tokens to `localStorage` via dedicated helper `src/core/auth/tokenStorage.ts`.

2. **Tenant State (React Context)**:
   - Managed in `src/core/tenant/TenantContext.tsx`.
   - Holds active `tenant` (`TenantConfig`), resolution `status` (`loading` | `resolved` | `unknown` | `invalid`), `tenantSlug`, available tenant profiles, and feature check function `isFeatureEnabled(featureName)`.

3. **Server Cache & Async Data (TanStack React Query 5)**:
   - Configured in `src/core/api/queryClient.ts`.
   - Used for all server-side entity queries, record lists, background revalidation, and optimistic mutations.
   - **Rule**: Never duplicate server cache data into Zustand stores.

### 4.4 Networking & Unified Microservices Gateway Integration

The platform connects to the backend microservices ecosystem through the central API Gateway on port `4000` (or relative path `/api/v1` via Vite dev proxy).

1. **Unified BaseUrl Resolution (`src/core/config/serviceConfig.ts`)**:
   - The platform maps 14 distinct backend microservices:
     `iam`, `audit`, `assets`, `config`, `notifications`, `scheduler`, `orders`, `transactions`, `search`, `inventory`, `ai`, `tenants`, `records`, `health`.
   - Resolves service URLs deterministically:
     $$\text{BaseUrl} = \text{ENV.VITE\_GATEWAY\_URL} + \text{ENV.VITE\_API\_BASE\_URL} + (\text{ENV.VITE\_<SERVICE>\_ENDPOINT} \mid \text{SERVICE\_CONFIG.ENDPOINTS[service]})$$
   - External services (e.g., Grafana, Prometheus) are resolved using `resolveExternalServiceUrl()`.

2. **ApiClient (`src/core/api/client.ts`)**:
   - Standard HTTP client wrapping native `fetch`.
   - Supports creating service-scoped clients via `ApiClient.forService('iam')`.
   - **Automatic Headers Injection**:
     - `Content-Type: application/json`, `Accept: application/json`.
     - `X-Tenant-ID`: Set to active tenant ID (e.g., `ten_apex_health_01`).
     - `X-Tenant-Slug`: Set to active tenant slug (e.g., `apex-health`).
     - `X-Device-Fingerprint`: Unique client fingerprint generated and persisted in `localStorage` (`web-<resolution>-<timestamp>-<random>`) to prevent session hijacking.
     - `Authorization: Bearer <token>`: Automatically attached for all protected URLs if a session token is present in `tokenStorage`.
   - **Mock Mode**: When `VITE_ENABLE_MOCK_API=true` or offline in dev mode, requests route seamlessly through `src/core/api/mockBackend.ts`.

### 4.5 Security, IAM & RBAC Control Plane

1. **Role Normalization (`src/core/auth/rbac.ts`)**:
   - Roles are normalized into three standard tiers:
     - `ADMIN`: Full tenant configuration, provider management, and audit access.
     - `SUPPORT`: Operator privileges, user lookup, telemetry review.
     - `USER`: Standard tenant operations and record access.
   - Platform Administrator: An `ADMIN` user with `tenantId === 'default'` or unset tenant ID.

2. **Route Guarding (`src/core/auth/ProtectedRoute.tsx`)**:
   - Verifies session authentication.
   - Verifies tenant scoping: prevents session leakage across differing demo tenants.
   - Verifies role authorization using `hasRole(user.role, allowedRoles)`.

3. **Enterprise SSO & OIDC Support (`src/features/auth/`)**:
   - PKCE flow implementation in `cryptoUtils.ts` (`generatePkcePair()` using Web Crypto SHA-256).
   - OIDC Callback page handling authorization codes, state verification, and token exchange.
   - Single Logout (SLO): Calls `/api/v1/iam/sso/logout`, clears local session tokens, and redirects to external IdP logout URLs (`idpLogoutUrl`) when configured.

### 4.6 Internationalization & Locale-Aware Formatters

- Initialized via `src/core/i18n/index.ts` with bundled dictionaries: `en`, `de`, `es`, `fr`.
- Dynamic formatting helpers in `src/core/i18n/formatters.ts` consume `tenant.localization`:
  - `formatCurrency(amount, tenant.localization)`: Uses `Intl.NumberFormat` with tenant currency code and decimal places.
  - `formatNumber(value, tenant.localization)`: Handles thousands grouping and decimal separators.
  - `formatDate(date, tenant.localization)`: Formats timestamps according to tenant `dateFormat` and `defaultTimeZone`.
  - `formatTime(date, tenant.localization)`: Formats time using `12h` or `24h` cycle and tenant timezone.

### 4.7 Feature Gating

- Tenants declare enabled feature flags in `tenant.features.enabledFeatures` (e.g., `{ billing: true, records: true, analytics: false }`).
- Guard entire UI blocks declaratively using `<FeatureGate feature="billing" fallback={<UpgradeNotice />}>`.
- Guard imperative actions using `const { isFeatureEnabled } = useTenant(); if (isFeatureEnabled('records')) { ... }`.
- Navigation items in `AppLayout.tsx` and dashboard widgets in `DashboardPage.tsx` are filtered automatically based on `requiredFeature`.

---

## 5. Coding Standards & Conventions

### 5.1 TypeScript Conventions

1. **No `any`**: Strictly disallow `any`. Use `unknown`, generic parameters, or explicit interfaces.
2. **Schema-First Typing**: External inputs (API responses, forms, remote tenant configs) must be validated with **Zod** schemas and inferred via `z.infer<typeof schema>`.
3. **Array Access Safety**: `noUncheckedIndexedAccess` is enabled. Always check array bounds or use optional chaining / non-null assertion with justification when destructuring known array splits.
4. **Explicit Return Types**: Top-level API functions and service adapters must declare explicit return types.

### 5.2 React Component Architecture

1. **Feature-Sliced File Structure**:
   - Reusable primitives live in `src/components/ui/<Component>/<Component>.tsx` with co-located `<Component>.module.css`.
   - Domain features live under `src/features/<feature>/`:
     - `components/`: Feature-bound components.
     - `services/`: API integration services.
     - `types/`: Feature DTOs and TypeScript models.
     - `styles/` or co-located `*.module.css`.
2. **Functional Components with Typed Props**:
   ```tsx
   import React from 'react';
   import styles from './MyComponent.module.css';

   interface MyComponentProps {
     title: string;
     onAction?: () => void;
     children?: React.ReactNode;
   }

   export const MyComponent: React.FC<MyComponentProps> = ({ title, onAction, children }) => {
     return (
       <div className={styles.container}>
         <h2 className={styles.title}>{title}</h2>
         {children}
       </div>
     );
   };
   ```
3. **Form Handling**: Combine `react-hook-form` with `@hookform/resolvers/zod` and define Zod validation schemas in separate `*Schema.ts` files (see `src/features/records/recordSchema.ts`).
4. **Icons**: Use `lucide-react` exclusively. Never import other icon packs.
5. **Fast Refresh Rule**: Avoid exporting non-component constants or contexts from component files. Keep React Context definitions in dedicated `*Context.tsx` files.

### 5.3 Styling Rules

1. **CSS Modules**: Every component should use `[Name].module.css`.
2. **Token Variables**: Always reference tokens defined in `src/styles/tokens.css` or injected by `applyThemeTokens()`:
   - Colors: `var(--color-primary)`, `var(--color-surface)`, `var(--color-text)`
   - Spacing: `var(--spacing-xs)`, `var(--spacing-md)`, `var(--spacing-xl)`
   - Radii: `var(--radius-sm)`, `var(--radius-md)`, `var(--radius-lg)`
   - Typography: `var(--font-family)`, `var(--font-size-sm)`, `var(--font-weight-semibold)`
3. **No Hardcoded Hex in Components**: Never write `#ffffff` or `#000000` directly in component files; use semantic CSS tokens.

### 5.4 Test Authoring Conventions

1. **Framework**: Vitest + React Testing Library + `@testing-library/jest-dom`.
2. **Test Location**: Put unit and integration tests under `src/test/`.
3. **Test Setup**: `src/test/setup.ts` automatically runs `cleanup()` and `localStorage.clear()` after each test.
4. **Mocking HTTP**:
   - Mock `global.fetch` using `vi.fn()` and restore in `afterEach()`.
   - Use `makeMockToken()` or mock JWT generators when testing authenticated flows.
5. **Wrapping Providers in Tests**: When rendering components that depend on routing, tenant context, or i18n, wrap them in a test helper harness with `<MemoryRouter>`, `<TenantContext.Provider>`, and `<I18nextProvider>`.

---

## 6. Guardrails & Forbidden Patterns

### 6.1 Tenant Isolation Guardrails
- **NEVER** bypass `resolveTenant()` or hardcode tenant properties (`primaryColor`, `displayName`, `id`) in application components.
- **NEVER** share cached data across tenant boundaries. When a tenant is switched, the application must invalidate queries or reload to ensure clean cache isolation.
- **NEVER** trust remote `apiBaseUrl` configurations without validating them against `TRUSTED_ORIGINS` via `isTrustedApiUrl()`.

### 6.2 Security & Credential Guardrails
- **NEVER** commit secret keys, credentials, or private tokens to source code or git.
- **NEVER** send authenticated requests without `X-Device-Fingerprint` and `X-Tenant-ID`.
- **NEVER** expose sensitive internal error stack traces on production screens; route uncaught runtime exceptions through `<ErrorBoundary />`.

### 6.3 Architectural Boundary Guardrails
- **NEVER** install heavyweight CSS-in-JS runtimes (Emotion, Styled Components) or utility CSS build chains that duplicate or conflict with the CSS Custom Property token architecture.
- **NEVER** perform direct database access, RabbitMQ connections, or file system operations from the frontend; all persistence flows through the REST/HTTP API Gateway (`:4000`).
- **NEVER** modify files in sibling projects (`boilerplate/monolith`, `boilerplate/backend-ms`, `boilerplate/mobile`, `RAG-agent`) when fulfilling frontend tasks.

---

## 7. Developer & AI Agent Workflows

### 7.1 Adding a New Tenant Profile

1. Open `src/core/tenant/registry.ts`.
2. Define a new entry conforming to `TenantConfig`:
   ```typescript
   export const DEMO_TENANTS: Record<string, TenantConfig> = {
     // ...
     'new-tenant': {
       identity: {
         id: 'ten_new_tenant_05',
         slug: 'new-tenant',
         displayName: 'New Enterprise Corp',
         legalName: 'New Enterprise Corporation Inc.',
         logoUrl: '/logos/new-tenant.svg',
         faviconUrl: '/favicon.svg',
         supportEmail: 'support@newenterprise.demo',
         supportUrl: 'https://newenterprise.demo/support',
         termsUrl: 'https://newenterprise.demo/terms',
         privacyUrl: 'https://newenterprise.demo/privacy',
       },
       branding: {
         primaryColor: '#2563eb',
         secondaryColor: '#3b82f6',
         accentColor: '#f59e0b',
         backgroundColor: '#0b0f19',
         surfaceColor: '#111827',
         textColor: '#f9fafb',
         mutedColor: '#6b7280',
         borderColor: '#1f2937',
         fontFamily: "'Inter', sans-serif",
         borderRadius: '8px',
         themeMode: 'dark',
       },
       localization: {
         defaultLocale: 'en-US',
         supportedLocales: ['en-US'],
         defaultCountryCode: 'US',
         defaultTimeZone: 'America/New_York',
         currencyCode: 'USD',
         dateFormat: 'MM/DD/YYYY',
         timeFormat: '12h',
         numberFormat: { decimalSeparator: '.', groupingSeparator: ',', decimalPlaces: 2 },
       },
       features: {
         enabledFeatures: { records: true, analytics: true },
         navigationItems: [
           { key: 'dashboard', labelKey: 'nav.dashboard', path: '/', icon: 'LayoutDashboard' },
           { key: 'records', labelKey: 'nav.records', path: '/records', icon: 'Database', requiredFeature: 'records' },
         ],
         dashboardWidgets: [
           { id: 'w1', widgetType: 'metrics', titleKey: 'widgets.metrics', layout: { colSpan: 12 } },
         ],
       },
       runtime: {
         apiBaseUrl: '/api/v1',
         authMode: 'jwt',
         sessionTimeoutMinutes: 60,
       },
       industry: 'generic',
     },
   };
   ```
3. Verify schema compliance by running:
   ```bash
   npm run test src/test/tenantSchema.test.ts
   ```

### 7.2 Connecting to a New Microservice Endpoint

1. Open `src/core/config/serviceConfig.ts`.
2. Add the service key to `ServiceKey` union type and default endpoint in `SERVICE_CONFIG.ENDPOINTS`.
3. Add the typed environment variable `VITE_<SERVICE>_ENDPOINT` to `src/vite-env.d.ts` and `.env.example`.
4. In your feature service, instantiate a scoped client:
   ```typescript
   import { ApiClient } from '@/core/api/client';
   const newServiceClient = ApiClient.forService('new-service');
   ```
5. Add unit tests in `src/test/serviceConfig.test.ts` verifying BaseUrl resolution.
6. Verify test execution:
   ```bash
   npm run test src/test/serviceConfig.test.ts
   ```

---

## 8. Definition of Done Checklist

Every frontend feature, enhancement, or bug fix must satisfy the following checklist before task completion:

- [ ] **TypeScript Typecheck**: `npm run typecheck` passes with zero errors.
- [ ] **Automated Unit Tests**: `npm run test` passes with 100% success on all test suites.
- [ ] **Production Build**: `npm run build` generates valid production bundles in `dist/`.
- [ ] **Multi-Tenant Scoping**: All API interactions inject `X-Tenant-ID`, `X-Device-Fingerprint`, and Bearer tokens when authenticated.
- [ ] **Zero Hardcoded Themes**: All visual styling relies on CSS Custom Properties injected by `applyThemeTokens()`.
- [ ] **Feature Flags**: New features include `<FeatureGate>` checks or check `isFeatureEnabled()`.
- [ ] **Accessibility & Responsiveness**: Mobile layout toggles and keyboard-accessible modal/form controls are preserved.

