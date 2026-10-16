# Enterprise Multi-Tenant White-Label React Native Boilerplate

A production-grade, industry-agnostic, white-label, multilingual React Native mobile application foundation built with **Expo**, **Expo Router**, and **TypeScript** in strict mode.

Designed to serve multiple enterprises, diverse industries (Retail, Healthcare, Education, Logistics, Finance), and unique branding identities from a single codebase—without duplicating screens, components, or logic.

---

## Architecture Highlights

- **Multi-Tenant by Configuration**: Dynamic tenant resolution, Zod configuration validation, and runtime tenant switcher.
- **Dynamic White-Label Design System**: Token-driven styling engine that calculates color scales, contrast luminance, and elevations on the fly.
- **Multilingual from Day One**: Built with `i18next` and `react-i18next`, featuring English and Hindi out of the box with safe translation fallbacks and locale-aware number/currency/date formatters.
- **Feature Flag System**: Granular, typed feature flags (`profile`, `notifications`, `darkMode`, `languageSwitcher`, `orderTracking`, `appointmentBooking`) that conditionally render dashboard shortcuts and screen capabilities.
- **Robust Session & Credential Storage**: Secure credentials stored via `ExpoSecureStore` (`Keychain` on iOS, `KeyStore` on Android), with safe non-crashing fallbacks for Web and test runners.
- **Typed API & Offline Mock Adapter**: Centralized `ApiClient` injecting `Authorization`, `X-Tenant-ID`, and `X-Tenant-Slug` headers, request timeouts, normalized `ApiError` mapping, and self-contained mock services for instant preview.
- **Complete Test Suite**: Comprehensive unit tests covering tenant validation, theme token generation, feature flag evaluation, API errors, session cleanup, and i18n formatters.

---

## Technology Stack

| Domain | Technology |
| :--- | :--- |
| **Framework** | React Native `0.88.0` with Expo SDK `58` |
| **Navigation & Routing** | Expo Router `v58` (file-based navigation with route guards) |
| **Language** | TypeScript (Strict mode enabled) |
| **Server State** | TanStack Query (`@tanstack/react-query v5`) |
| **Local Session State** | Zustand (`zustand v5`) |
| **Forms & Validation** | React Hook Form with Zod schemas |
| **Internationalization** | `i18next` & `react-i18next` |
| **Secure Storage** | `expo-secure-store` |
| **Non-Sensitive Storage**| `@react-native-async-storage/async-storage` |
| **Testing** | Jest with `ts-jest` |

---

## Project Structure

```
mobile/
├── src/
│   ├── app/                      # Expo Router File-Based Routing
│   │   ├── _layout.tsx           # Root provider stack (QueryClient, Tenant, Theme, Auth)
│   │   ├── index.tsx             # Root index router (auth guard redirect)
│   │   ├── +not-found.tsx        # 404 handler
│   │   ├── (public)/             # Unauthenticated routes
│   │   │   ├── _layout.tsx       # Public stack guard
│   │   │   ├── welcome.tsx       # Onboarding & tenant showcase
│   │   │   └── login.tsx         # Login with React Hook Form & Zod
│   │   └── (protected)/          # Authenticated routes (protected by auth guard)
│   │       ├── _layout.tsx       # Protected stack guard
│   │       ├── home.tsx          # Configurable multi-tenant dashboard
│   │       ├── profile.tsx       # User profile & logout
│   │       ├── settings.tsx      # Dark mode & preferences
│   │       ├── language.tsx      # Runtime language switcher (EN / HI)
│   │       └── tenant-preview.tsx # White-label theme & token preview
│   │
│   ├── components/               # Centralized Design-Token UI Components
│   │   ├── ui/                   # AppButton, AppText, AppInput, AppCard, AppHeader, etc.
│   │   ├── layout/               # AppScreen (Safe area & scroll container)
│   │   └── feedback/             # AppLoader, AppError, AppEmptyState
│   │
│   ├── features/                 # Modular Domain Features
│   │   ├── auth/                 # LoginForm, useAuth, authService, types
│   │   ├── profile/              # ProfileCard, useProfile, profileService
│   │   ├── tenant/               # TenantSwitcherModal, TenantInfoCard
│   │   └── settings/             # Settings hooks & types
│   │
│   ├── core/                     # Core Platform Foundations
│   │   ├── api/                  # ApiClient, ApiError, MockAdapter, types
│   │   ├── auth/                 # AuthStore (Zustand), SessionManager
│   │   ├── features/             # Feature flag evaluator & useFeatureFlag
│   │   ├── i18n/                 # i18n initialization, formatters, translations
│   │   ├── storage/              # Safe SecureStore and AsyncStorage wrappers
│   │   ├── tenant/               # TenantRegistry, TenantResolver, Zod Schema, Context
│   │   │   └── tenants/          # Apex Retail, Nexus Health, Fallback Tenant
│   │   └── theme/                # Design tokens, themeGenerator, ThemeContext
│   │
│   └── locales/                  # Localized Resource Dictionaries
│       ├── en/                   # English: common.json, auth.json, home.json
│       └── hi/                   # Hindi: common.json, auth.json, home.json
│
├── tests/
│   ├── __mocks__/                # Native module test mocks
│   └── unit/                     # Unit test suites (all passing)
│
├── docs/                         # In-Depth Architectural Documentation
│   ├── architecture.md           # System design & separation of concerns
│   ├── tenant-configuration.md   # Schema reference & how to add tenants
│   ├── theming.md                # Design tokens & color calculations
│   ├── localization.md           # Adding languages & formatters
│   └── security.md               # Credentials, tenant headers, backend isolation
│
├── app.json                      # Expo configuration
├── package.json                  # Dependencies & npm scripts
└── tsconfig.json                 # TypeScript strict configuration
```

---

## Quick Start

### 1. Prerequisites
- Node.js `20+` or `22+`
- npm `10+`

### 2. Installation
```bash
cd mobile
npm install --legacy-peer-deps
```

### 3. Start the Development Server
```bash
npm run start
```
From the Expo interactive CLI:
- Press `i` to open in iOS Simulator.
- Press `a` to open in Android Emulator.
- Press `w` to open in Web Browser.

### 4. Running Quality Checks & Tests
```bash
# Run all unit tests
npm run test

# Run TypeScript strict type verification
npm run typecheck
```

---

## Multi-Tenant White-Label Showcase

The boilerplate includes two demo tenants illustrating dynamic branding:

| Tenant | Industry | Brand Color | Accent | Default Locale | Currency | Key Features |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Apex Retail** | Retail & E-Commerce | `#2563EB` (Royal Blue) | `#F59E0B` (Amber) | `en` (English) | `USD ($)` | Order Tracking, Dark Mode, Notifications |
| **Nexus Health**| Healthcare & Clinics | `#059669` (Emerald) | `#0D9488` (Teal) | `hi` (Hindi) | `INR (₹)` | Appointment Booking, Clinical Care |
| **Platform Default** | Generic Platform | `#3B82F6` (Slate Blue) | `#8B5CF6` (Purple) | `en` (English) | `USD ($)` | Base Features |

### How to Switch Tenants at Runtime
1. On the **Welcome Screen** or the **Home Dashboard**, tap the **Palette Icon** or **"Switch Tenant"** button.
2. Select **Apex Retail** or **Nexus Health**.
3. Observe all colors, cards, icons, currency symbols, and enabled feature shortcuts re-render instantly to match the selected tenant.

---

## Authentication & Demo Credentials

The login screen supports quick auto-fill for testing:
- **Email**: `admin@apex-retail.com` (or tap the **"Fill Demo Credentials"** button)
- **Password**: `password123`

The authentication flow restores sessions from `ExpoSecureStore` automatically on app boot and safely wipes all tenant-scoped tokens and cached user data on logout.

---

## How to Extend the Platform

### Adding a New Tenant
1. Create a configuration in `src/core/tenant/tenants/yourTenant.ts`.
2. Register it in `src/core/tenant/tenantRegistry.ts`:
   ```ts
   this.register(yourTenant);
   ```
3. Read [docs/tenant-configuration.md](file:///Users/vinaykumar/Desktop/IMP/base/boilerplate/mobile/docs/tenant-configuration.md) for full schema details.

### Adding a New Language
1. Add translation files in `locales/<lang>/` (`common.json`, `auth.json`, `home.json`).
2. Register the namespace in `src/core/i18n/translations.ts`.
3. Add the locale code to `supportedLocales` in the tenant configs.
4. Read [docs/localization.md](file:///Users/vinaykumar/Desktop/IMP/base/boilerplate/mobile/docs/localization.md) for details.

### Connecting a Real Backend
1. In `src/core/tenant/tenants/<tenant>.ts`, configure `apiBaseUrl: 'https://api.yourdomain.com/v1'`.
2. In `src/features/auth/services/authService.ts`, uncomment the live `apiClient.post` call.
3. Every request automatically transmits `X-Tenant-ID`, `X-Tenant-Slug`, and `Authorization: Bearer <token>`.

---

## Production Readiness Checklist

- [x] TypeScript strict mode enabled with 0 errors.
- [x] Unit test suite passing with 100% test success across all core modules.
- [x] Secure credential storage utilizing device Keychain/KeyStore.
- [x] No hardcoded tenant secrets or production credentials in bundle.
- [x] Dynamic contrast calculation to guarantee WCAG accessibility on dynamic colors.
- [x] Safe area and keyboard avoidance handled across iOS, Android, and Web.
- [x] Full architectural documentation provided in `docs/`.
