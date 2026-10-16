# Tenant Configuration & Multi-Tenancy Guide

## 1. Tenant Configuration Schema

Every tenant profile in the platform implements the typed `TenantConfig` interface and is validated at runtime using Zod (`src/core/tenant/tenantConfig.schema.ts`).

### Schema Definition:

| Property | Type | Description |
| :--- | :--- | :--- |
| `tenantId` | `string` | Unique global identifier (e.g., `tenant-apex-001`) |
| `tenantSlug` | `string` | Lowercase URL-safe identifier (e.g., `apex-retail`) |
| `displayName` | `string` | Brand name displayed to end users |
| `tagline` | `string?` | Optional marketing or organizational subtitle |
| `industry` | `IndustryType` | `retail`, `healthcare`, `education`, `logistics`, `finance`, etc. |
| `logo` | `string` | Asset path or remote image URL |
| `splashScreen` | `object` | Background color and splash icon specifications |
| `primaryColor` | `HexColor` | Dominant brand color (used for CTAs, highlights) |
| `secondaryColor` | `HexColor` | Complementary brand color |
| `accentColor` | `HexColor` | Accent color for badges and alerts |
| `backgroundColor` | `HexColor` | Screen background color |
| `surfaceColor` | `HexColor` | Card and modal surface color |
| `textColor` | `HexColor` | Base typographic color |
| `defaultLocale` | `string` | Default fallback locale (`en`, `hi`) |
| `supportedLocales`| `string[]` | Array of permitted locale codes |
| `currencyCode` | `string` | ISO 4217 3-letter currency code (`USD`, `INR`, `EUR`) |
| `dateFormat` | `string` | Display date format (e.g., `MM/DD/YYYY` or `DD/MM/YYYY`) |
| `timeFormat` | `'12h' \| '24h'` | Clock display convention |
| `enabledFeatures` | `Record<string, boolean>` | Feature flag toggles for the tenant |
| `apiBaseUrl` | `string` | Trusted API host endpoint |
| `supportEmail` | `string` | Customer support contact email |
| `termsUrl` | `string` | Terms of service URL |
| `privacyUrl` | `string` | Privacy policy URL |

---

## 2. Included Demo Tenants

The boilerplate ships with two distinct demo tenants demonstrating disparate branding, industries, currencies, and feature sets:

### A. Apex Retail (`apex-retail`)
- **Industry**: Retail & E-Commerce
- **Primary Color**: `#2563EB` (Royal Blue)
- **Accent Color**: `#F59E0B` (Amber)
- **Currency**: `USD ($)`
- **Enabled Features**:
  - `profile: true`
  - `notifications: true`
  - `darkMode: true`
  - `analytics: true`
  - `orderTracking: true`
  - `appointmentBooking: false`

### B. Nexus Health (`nexus-health`)
- **Industry**: Healthcare & Medical Clinics
- **Primary Color**: `#059669` (Emerald Green)
- **Accent Color**: `#0D9488` (Teal)
- **Currency**: `INR (₹)`
- **Default Locale**: `hi` (Hindi)
- **Enabled Features**:
  - `profile: true`
  - `notifications: false`
  - `darkMode: false`
  - `orderTracking: false`
  - `appointmentBooking: true`

---

## 3. How to Add a New Tenant

1. Create a new config file in `src/core/tenant/tenants/yourTenant.ts`:
   ```ts
   import { TenantConfig } from '../types';

   export const acmeLogisticsTenant: TenantConfig = {
     tenantId: 'tenant-acme-003',
     tenantSlug: 'acme-logistics',
     displayName: 'Acme Logistics',
     industry: 'logistics',
     logo: 'https://example.com/logo.png',
     splashScreen: { backgroundColor: '#1E293B' },
     primaryColor: '#EA580C', // Orange
     secondaryColor: '#C2410C',
     accentColor: '#38BDF8',
     backgroundColor: '#F8FAFC',
     surfaceColor: '#FFFFFF',
     textColor: '#0F172A',
     defaultLocale: 'en',
     supportedLocales: ['en', 'hi'],
     defaultCountryCode: 'US',
     dateFormat: 'YYYY-MM-DD',
     timeFormat: '24h',
     numberFormat: { decimalSeparator: '.', groupingSeparator: ',', decimalPlaces: 2 },
     currencyCode: 'USD',
     enabledFeatures: {
       profile: true,
       notifications: true,
       helpAndSupport: true,
       languageSwitcher: true,
       darkMode: true,
       analytics: true,
       orderTracking: true,
       appointmentBooking: false,
       inventorySearch: true,
     },
     apiBaseUrl: 'https://api.acmelogistics.com/v1',
     supportEmail: 'support@acmelogistics.com',
     supportUrl: 'https://acmelogistics.com/help',
     termsUrl: 'https://acmelogistics.com/terms',
     privacyUrl: 'https://acmelogistics.com/privacy',
   };
   ```

2. Register the tenant in `src/core/tenant/tenantRegistry.ts`:
   ```ts
   this.register(acmeLogisticsTenant);
   ```

3. Re-run tests to confirm validity:
   ```bash
   npm run test
   ```

---

## 4. Crucial Security Principle: Backend Tenant Isolation

> [!WARNING]
> Client-side tenant selection is strictly for **presentation and branding customization**. The mobile application **never** trusts client-side tenant flags for data isolation or security.
>
> The backend API must independently enforce:
> 1. Authentication token validation.
> 2. Cross-tenant authorization checks.
> 3. Scoped data queries based on the authenticated user's server-stored tenant record.
