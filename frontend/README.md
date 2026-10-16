# Enterprise Multi-Tenant White-Label React Platform

[![Framework](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Bundler](https://img.shields.io/badge/Vite-5.4-646CFF.svg?style=flat&logo=vite)](https://vitejs.dev)
[![Tests](https://img.shields.io/badge/Vitest-Passing-success.svg?style=flat&logo=vitest)](https://vitest.dev)

A lightweight, production-grade, industry-agnostic frontend platform designed to serve multiple businesses, brands, and customer organizations from a single, unified codebase with zero code duplication.

---

## Table of Contents

- [Architectural Overview](#architectural-overview)
- [Key Features](#key-features)
- [Directory Structure](#directory-structure)
- [Multi-Tenant Configuration Model](#multi-tenant-configuration-model)
- [Deterministic Tenant Resolution](#deterministic-tenant-resolution)
- [White-Label Design System](#white-label-design-system)
- [Internationalization & Formatters](#internationalization--formatters)
- [Developer Guides](#developer-guides)
  - [1. Running Locally](#1-running-locally)
  - [2. Adding a New Tenant](#2-adding-a-new-tenant)
  - [3. Adding a Feature Module with Feature Gates](#3-adding-a-feature-module-with-feature-gates)
- [Testing & Quality](#testing--quality)
- [Production Deployment](#production-deployment)

---

## Architectural Overview

This platform decouples platform capabilities from tenant-specific branding and business parameters:

```
                      +---------------------------------------+
                      |       Incoming HTTP Web Request       |
                      +-------------------+-------------------+
                                          |
                      +-------------------v-------------------+
                      |      Tenant Resolution Service        |
                      |  1. Dev URL Query Override (?tenant=) |
                      |  2. LocalStorage Dev Cache            |
                      |  3. Path Prefix (/t/:slug)            |
                      |  4. Subdomain (tenant.domain.com)     |
                      |  5. Custom Domain (portal.client.com) |
                      |  6. Fallback / Unknown Tenant Guard   |
                      +-------------------+-------------------+
                                          |
                 +------------------------+------------------------+
                 | (Valid Configuration)                           | (Unknown / Invalid)
                 v                                                 v
  +-------------------------------+                 +-------------------------------+
  |        TenantProvider         |                 |      UnknownTenantPage        |
  |  - Injects CSS Custom Tokens  |                 |  - Friendly error status      |
  |  - Updates Title & Favicon    |                 |  - Dev recovery switcher      |
  |  - Mounts Tenant Context      |                 +-------------------------------+
  +---------------+---------------+
                  |
  +---------------v---------------+
  |        Application Core       |
  |  +-------------------------+  |
  |  | TanStack Query + Cache  |  |
  |  +-------------------------+  |
  |  | Typed ApiClient         |  | ---> Injects X-Tenant-ID & Bearer JWT
  |  +-------------------------+  |
  |  | AuthStore (Zustand/RBAC)|  |
  |  +-------------------------+  |
  |  | Locale Formatters (Intl)|  |
  +---------------+---------------+
                  |
  +---------------v---------------+
  |   Dynamic Branded Interface   |
  |  - Dynamic Navigation         |
  |  - Configurable Widgets       |
  |  - Schema-driven Entity Forms |
  +-------------------------------+
```

---

## Key Features

1. **Zero Component Duplication**: All screens, navigation bars, cards, and forms adapt dynamically to the resolved tenant.
2. **Deterministic Resolution**: Reliable domain, subdomain, path, and dev-mode tenant discovery with strict fallback controls.
3. **Pure CSS Custom Property Theming**: Ultra-lightweight styling boundary using CSS Modules and `--color-*` tokens. No heavyweight CSS-in-JS runtimes.
4. **Locale-Aware Formatting**: Tailored currency, date, time, and numeric formatting driven by tenant localization configuration.
5. **Configurable Feature Gates**: Enable or disable features per tenant with `<FeatureGate feature="billing">` or `isFeatureEnabled('analytics')`.
6. **Built-in Mock API**: Fully testable and runnable standalone without requiring live backend services running.
7. **Production Strict Mode**: 100% strict TypeScript types, zero `any`, automated Vitest unit test suite.

---

## Directory Structure

```plaintext
frontend/
├── index.html                   # HTML entry point with dynamic favicon and font preconnects
├── package.json                 # Dependency manifest and scripts
├── tsconfig.json                # TypeScript strict configuration
├── vite.config.ts               # Vite bundler with @ alias mapping
├── vitest.config.ts             # Vitest unit test runner config
├── src/
│   ├── main.tsx                 # React DOM mount point
│   ├── App.tsx                  # Root component with providers
│   ├── assets/                  # Static assets
│   ├── config/                  # Environment and security origin configuration
│   ├── core/                    # Enterprise platform foundations
│   │   ├── api/                 # Typed ApiClient, X-Tenant-ID interceptor, TanStack Query
│   │   ├── auth/                # AuthStore (Zustand), ProtectedRoute, RBAC guards
│   │   ├── i18n/                # i18next init, multi-language dictionaries, formatters
│   │   ├── tenant/              # Types, Zod schema, resolver, context, registry, DevSwitcher
│   │   └── theme/               # Dynamic CSS token injector (applyThemeTokens)
│   ├── components/
│   │   ├── ui/                  # Reusable white-label design system (CSS Modules)
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Card/
│   │   │   ├── Badge/
│   │   │   ├── Modal/
│   │   │   ├── Select/
│   │   │   ├── Table/
│   │   │   ├── Spinner/
│   │   │   └── Alert/
│   │   └── common/              # TenantLogo, FeatureGate, LanguageSwitcher, ErrorBoundary
│   ├── layouts/                 # AppLayout (Sidebar/Header/Footer) & AuthLayout
│   ├── features/                # Industry-agnostic modular capabilities
│   │   ├── auth/                # Login page with demo credentials assistant
│   │   ├── dashboard/           # Dynamic widget grid based on tenant configuration
│   │   ├── records/             # Schema-driven Entity Explorer (React Hook Form + Zod)
│   │   ├── settings/            # Live branding token inspector & tenant settings
│   │   └── system/              # UnknownTenantPage, NotFoundPage, TenantLoadingPage
│   ├── routes/                  # React Router definition and guards
│   ├── styles/                  # tokens.css, global.css, animations.css
│   └── test/                    # Unit tests for resolver, schemas, api, tokens, components
└── public/                      # Static logos and favicons
```

---

## Multi-Tenant Configuration Model

Every tenant configuration strictly adheres to `TenantConfig`:

```typescript
export interface TenantConfig {
  identity: {
    id: string;              // Unique immutable ID (e.g. 'ten_apex_health_01')
    slug: string;            // URL-safe slug (e.g. 'apex-health')
    displayName: string;     // Brand name shown in UI
    legalName: string;       // Legal corporate entity for contracts/footers
    logoUrl: string;         // SVG or PNG logo URL
    faviconUrl: string;      // Favicon icon URL
    supportEmail: string;    // Direct support contact
    supportUrl: string;      // Help desk or documentation URL
    termsUrl: string;        // Terms of service URL
    privacyUrl: string;      // Privacy policy URL
  };
  branding: {
    primaryColor: string;    // Core brand color
    secondaryColor: string;  // Supporting accent color
    accentColor: string;     // Highlight color
    backgroundColor: string; // App background color
    surfaceColor: string;    // Container & card surface color
    textColor: string;       // Primary typography color
    mutedColor: string;      // Secondary typography color
    borderColor: string;     // Divider and border color
    fontFamily: string;      // Typography stack
    borderRadius: string;    // Border radius scale (e.g. '8px')
    themeMode?: 'dark' | 'light' | 'auto';
  };
  localization: {
    defaultLocale: string;   // e.g. 'en-US' or 'de-DE'
    supportedLocales: string[];
    defaultCountryCode: string;
    defaultTimeZone: string;
    currencyCode: string;    // e.g. 'USD', 'EUR'
    dateFormat: string;      // e.g. 'YYYY-MM-DD'
    timeFormat: '12h' | '24h';
    numberFormat: {
      decimalSeparator: string;
      groupingSeparator: string;
      decimalPlaces: number;
    };
  };
  features: {
    enabledFeatures: Record<string, boolean>;
    navigationItems: TenantNavigationItem[];
    dashboardWidgets: TenantDashboardWidget[];
    publicLandingEnabled?: boolean;
  };
  runtime: {
    apiBaseUrl: string;
    authMode: 'jwt' | 'session' | 'oauth2';
    sessionTimeoutMinutes: number;
    publicSettings?: Record<string, unknown>;
  };
  industry: 'healthcare' | 'logistics' | 'fintech' | 'retail' | 'education' | 'generic';
}
```

---

## Deterministic Tenant Resolution

When an end-user navigates to the application, `resolveTenant()` identifies the tenant context in the following priority order:

1. **Development Query Parameter**: `?tenant=<slug>` (Overrides during local dev & QA testing).
2. **Development LocalStorage**: `dev_tenant_override` saved in the browser.
3. **Path Prefix**: `/t/<slug>` or `/tenant/<slug>`.
4. **Subdomain Matching**: `<slug>.example.com` or `<slug>.localhost`.
5. **Custom Domain Mapping**: Matches custom domains configured via backend config adapter.
6. **Default Fallback (Dev Only)**: If running on `localhost` or preview environments, defaults to `apex-health`.
7. **Unknown Tenant Guard**: In production, unmapped or unrecognized domains explicitly redirect to `<UnknownTenantPage />` with clear user messaging.

---

## White-Label Design System

Branding is applied at a single application-level boundary (`applyThemeTokens()`), which injects CSS Custom Properties:

```css
:root {
  --color-primary: #0d9488;
  --color-primary-hover: #0f766e;
  --color-primary-subtle: rgba(13, 148, 136, 0.15);
  --color-secondary: #06b6d4;
  --color-background: #0a1118;
  --color-surface: #121f2d;
  --color-text: #f1f5f9;
  --color-border: #1e3349;
  --font-family: 'Inter', sans-serif;
  --radius-md: 8px;
}
```

Components simply consume standard tokens without conditional tenant styling:
```css
/* Button.module.css */
.primary {
  background-color: var(--color-primary);
  border-radius: var(--radius-md);
  color: #ffffff;
}
```

---

## Developer Guides

### 1. Running Locally

```bash
cd boilerplate/frontend

# Install dependencies
npm install

# Start Vite dev server on port 3000
npm run dev

# Run unit tests
npm run test

# Check TypeScript types
npm run typecheck

# Build for production
npm run build
```

### 2. Adding a New Tenant

1. Open `src/core/tenant/registry.ts`.
2. Add your tenant configuration adhering to `TenantConfig`:

```typescript
export const DEMO_TENANTS: Record<string, TenantConfig> = {
  // ... existing tenants
  'acme-retail': {
    identity: {
      id: 'ten_acme_retail_04',
      slug: 'acme-retail',
      displayName: 'Acme Retail Commerce',
      legalName: 'Acme Global Commerce Inc.',
      logoUrl: '/logos/acme.svg',
      faviconUrl: '/favicon.svg',
      supportEmail: 'help@acme.demo',
      supportUrl: 'https://acme.demo/support',
      termsUrl: 'https://acme.demo/terms',
      privacyUrl: 'https://acme.demo/privacy',
    },
    branding: {
      primaryColor: '#e11d48',
      secondaryColor: '#f43f5e',
      accentColor: '#fbbf24',
      backgroundColor: '#0c0a09',
      surfaceColor: '#1c1917',
      textColor: '#fafaf9',
      mutedColor: '#78716c',
      borderColor: '#292524',
      fontFamily: "'Outfit', sans-serif",
      borderRadius: '10px',
      themeMode: 'dark',
    },
    localization: {
      defaultLocale: 'en-US',
      supportedLocales: ['en-US', 'es-ES'],
      defaultCountryCode: 'US',
      defaultTimeZone: 'America/Chicago',
      currencyCode: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      numberFormat: { decimalSeparator: '.', groupingSeparator: ',', decimalPlaces: 2 },
    },
    features: {
      enabledFeatures: { analytics: true, records: true, billing: true },
      navigationItems: [
        { key: 'dashboard', labelKey: 'nav.dashboard', path: '/', icon: 'LayoutDashboard' },
        { key: 'records', labelKey: 'nav.records', path: '/records', icon: 'Database', requiredFeature: 'records' },
      ],
      dashboardWidgets: [
        { id: 'w1', widgetType: 'metrics', titleKey: 'widgets.retailMetrics', layout: { colSpan: 12 } },
      ],
    },
    runtime: {
      apiBaseUrl: '/api/v1',
      authMode: 'jwt',
      sessionTimeoutMinutes: 60,
    },
    industry: 'retail',
  },
};
```

3. Test by selecting `Acme Retail` from the Dev Tenant Switcher dropdown in the top header, or by browsing to `http://localhost:3000/?tenant=acme-retail`.

### 3. Adding a Feature Module with Feature Gates

To conditionally display an entire page, widget, or button based on tenant flags:

```tsx
import { FeatureGate } from '@/components/common/FeatureGate';

export const MyFeaturePanel = () => {
  return (
    <FeatureGate feature="billing" fallback={<p>Billing module not enabled for your organization.</p>}>
      <BillingDashboard />
    </FeatureGate>
  );
};
```

Or via hook:
```tsx
const { isFeatureEnabled } = useTenant();
if (isFeatureEnabled('auditLogs')) {
  // execute logic
}
```

---

## Testing & Quality

Run the comprehensive unit test suite:

```bash
npm run test
```

The test suite validates:
- **Tenant Resolution Strategy**: Dev query override, localStorage, path prefix, subdomain, localhost default, and unknown production domain rejection.
- **TenantConfig Schema**: Strict Zod validation, required fields, formatting rules, and email verification.
- **Theme Injection**: CSS Custom Properties applied to `document.documentElement`.
- **API Header Interception**: Verification that `X-Tenant-ID` and `Authorization` Bearer headers are attached.
- **Locale-Aware Formatting**: Accurate currency symbol placement and numeric decimal handling across locales.
- **Component Behaviors**: Button variant rendering, loading spinners, accessibility, and click handlers.

---

## Production Deployment

1. Set environment variables in your deployment pipeline:
```bash
VITE_APP_ENV=production
VITE_API_BASE_URL=https://api.yourdomain.com/api/v1
VITE_TRUSTED_API_ORIGINS=https://api.yourdomain.com
VITE_ENABLE_MOCK_API=false
```

2. Build optimized static assets:
```bash
npm run build
```

3. Serve the output `dist/` directory via any high-performance static hosting provider (NGINX, Cloudflare Pages, AWS S3 + CloudFront, or Vercel). Ensure standard Single Page Application (SPA) rewrite rules route fallback requests to `/index.html`.
