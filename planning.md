# Platform Architecture Planning & Security Implementation Record

**Document:** `planning.md`  
**Status:** Living Architecture Plan & Implementation Roadmap  
**Scope:** Multi-Tenant Architecture, Cryptographic Token Hardening (Asymmetric RS256 / JWKS), Anti-Session Hijacking, Client-Side Device Hardening  
**Target:** Monolith API, Web Frontend, and Mobile Applications (iOS / Android)  

---

## 1. Executive Summary & Initial Architectural Discovery

### 1.1 Context & Initial Inquiries
During architectural review, three critical identity and device session dimensions were evaluated:
1. **Token Cryptography & Signing Scheme**:
   * *Finding*: The initial baseline used symmetric cryptography — `accessToken` and `refreshToken` encrypted with AES-256-GCM using symmetric secrets derived from `JWT_SECRET` and `JWT_REFRESH_SECRET`, while `idToken` used symmetric HMAC (`HS256`).
   * *Assessment*: While fast for a single monolith node, symmetric secrets prevent external microservices, microfrontends, or tenant-specific external integrations from verifying tokens independently without holding the master symmetric signing key.
2. **Device Fingerprinting across Shared IPs & VPNs**:
   * *Finding*: Fingerprints in `TokenService.generateFingerprint(context)` are calculated using `HMAC_SHA256(secret, "${ua}::${deviceHint}")`.
   * *Architectural Decision*: The client IP address was **intentionally excluded** from the token hash. This prevents session dropping when mobile users switch networks (e.g., Cellular to Wi-Fi) and prevents collisions when dozens of devices share a single VPN / NAT public IP address.
3. **Client-Side Reverse Engineering & Exploit Protections**:
   * *Finding*: No server secrets or private keys are bundled in client binaries. Mobile tokens are isolated in OS-level SecureStore (iOS Keychain / Android KeyStore).
   * *Hardening Recommendation*: Upgrade to asymmetric tokens (RS256 with published JWKS), add client-side persistent device fingerprinting headers (`X-Device-Fingerprint`), multi-tenant headers (`X-Tenant-ID`), and hardened web session handling.

---

## 2. Multi-Tenant Enterprise Architecture (Why It Is Mandatory)

### 2.1 The Core Business & Technical Drivers
To onboard any organization with similar or different industry to operate from the platform utilizing our SaaS services without requiring a separate login flow:
* **Single Sign-On (SSO) & Unified Identity**:
  - A user belongs to one or more organizations (`tenantId`).
  - Organizations can configure their own SSO identity providers (Google Workspace, Microsoft Entra ID / Azure AD, Okta) through a unified IAM gateway.
* **Tenant Data & Configuration Isolation**:
  - Relational tenant configuration overrides (`app_config.tenant_configurations` and `tenant_id` columns) allow white-label branding, customized policies, fee structures, and domain routing.
  - Strict tenant boundary validation prevents cross-tenant data leaks at the API layer.
* **Why Asymmetric JWT (RS256) is Superior to Symmetric (HS256) in Multi-Tenancy**:
  1. **Decoupled Verification (Zero-Trust Services)**: Services, microfrontends, background workers, and tenant portals can verify tokens using the published **Public Key** (`/.well-known/jwks.json`) without possessing the **Private Signing Key**.
  2. **No Shared Secrets Risk**: In a multi-tenant ecosystem, sharing a symmetric secret (`JWT_SECRET`) with third parties or distributed worker services is a catastrophic security risk. Asymmetric keys completely eliminate this risk.
  3. **High Performance**: Asymmetric signature verification can be cached and computed locally by any consuming service, eliminating database roundtrips for authentication.

---

## 3. Architecture & Implementation Roadmap

```
+-----------------------------------------------------------------------------------+
|                                 Client Layer                                      |
|                                                                                   |
|  +-------------------------------------+   +------------------------------------+ |
|  |             Mobile App              |   |             Web Client             | |
|  | - ExpoSecureStore (Keychain/Keystore|   | - Persistent Browser Fingerprint   | |
|  | - Injects X-Device-Fingerprint      |   | - Injects X-Device-Fingerprint     | |
|  | - Injects X-Tenant-ID & Slug        |   | - Injects X-Tenant-ID              | |
|  | - SSL Pinning & Integrity Hooks     |   | - Strict CSP & Safe Storage        | |
|  +------------------+------------------+   +------------------+-----------------+ |
+---------------------|-----------------------------------------|-------------------+
                      |                                         |
                      +--------------------+--------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                              IAM Monolith API Gate                                |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | auth.middleware.ts:                                                         |  |
|  | - Validates X-Device-Fingerprint & User-Agent (Anti-Hijacking Check)         |  |
|  | - Verifies Asymmetric RS256 Tokens (via RSA Public Key) & AES-256-GCM       |  |
|  | - Extracts tenantId & attaches AuthenticatedUser to Request Context         |  |
|  +-----------------------------------------------------------------------------+  |
|  | TokenService:                                                               |  |
|  | - Asymmetric RSA Key Pair (Private Sign / Public Verify)                    |  |
|  | - Standard OpenID Connect JWKS (/api/iam/.well-known/jwks.json)             |  |
|  | - Embeds tenantId, role, mfaVerified, and fgp into claims                  |  |
|  | - AES-256-GCM Encrypted Refresh Tokens with 24h MFA Session Expiry          |  |
|  +-----------------------------------------------------------------------------+  |
|  | iam.audit_logs:                                                             |  |
|  | - Immutable security audit trail recording IP, UA, event, status, tenantId  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 3.1 Phase Breakdown & Status

| Phase | Milestone | Scope | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **PRD & Planning Baseline** | Document multi-tenancy requirements, asymmetric JWT rationale, and session hijacking prevention in `PRD.md` and `planning.md`. | **COMPLETED** |
| **Phase 2** | **Backend Asymmetric Token Engine** | Implement RSA key management in `TokenService`, RS256 signing, `tenantId` in claims, and JWKS endpoint (`/.well-known/jwks.json`). | **COMPLETED** |
| **Phase 3** | **Auth Middleware & Tenant Binding** | Update `auth.middleware.ts` to verify RS256 tokens using the public key, support cookie sessions, and extract `X-Tenant-ID` / `X-Tenant-Slug`. | **COMPLETED** |
| **Phase 4** | **Mobile App Client Hardening** | Inject `X-Device-Fingerprint`, `X-Tenant-ID` in `ApiClient`, integrate `DeviceSecurity`, and document certificate pinning / integrity. | **COMPLETED** |
| **Phase 5** | **Web Client Hardening** | Implement persistent browser fingerprinting and `X-Tenant-ID` injection in `monolith/apps/web` and `boilerplate/frontend`. | **COMPLETED** |
| **Phase 6** | **Verification & Unit Tests** | Add unit tests verifying RS256 token generation, JWKS endpoint retrieval, multi-tenant claims, and anti-hijacking validation. | **COMPLETED** |
| **Phase 7** | **Asset Management & Storage Ports (Sprint 05)** | Implement `asset.assets` multi-tenancy, MIME validation gate, `IStorageProvider` port, `LocalStorageProvider`, two-phase upload lifecycle, and quarantine. | **COMPLETED** |
| **Phase 8** | **Cloud Storage Adapters & Factory (Sprint 06)** | Deliver AWS S3 SigV4 and GCS V4 adapters, dynamic `StorageProviderFactory`, tenant bucket overrides, Docker volume mapping, and anti-traversal defenses. | **COMPLETED** |
| **Phase 9** | **Multi-Tenant Inventory & Concurrency (Sprint 07)** | Multi-tenant stock items, optimistic concurrency control (`version`), atomic reservations lifecycle (`RESERVE` -> `COMMIT` / `RELEASE`), and unit tests. | **COMPLETED** |
| **Phase 10** | **Multi-Tenant Orders, Pricing & Inventory Linkage (Sprint 08)** | Multi-tenant order persistence (`tenant_id`), state machine transitions (`PENDING` -> `RESERVED` -> `PAID` -> `FULFILLED`), pricing invariants, inventory reservation linkage & rollback. | **COMPLETED** |
| **Phase 11** | **Multi-Gateway Payment Routing & Webhook Idempotency (Sprint 09)** | Multi-tenant transaction ledgers, dynamic gateway routing (Stripe/Razorpay/Mock), HMAC-SHA256 signature verification, idempotent event ledger (`transactions.webhook_events`). | **COMPLETED** |
| **Phase 12** | **Shared Services Multi-Tenancy (Sprint 10)** | Multi-channel notifications (Email, SMS, WhatsApp, Push), cron scheduler & run history (`scheduler.job_runs`), full-text search indexing with event projection. | **COMPLETED** |
| **Phase 13** | **Property Portfolio Domain Foundation (Sprint 11)** | Property registry, units, floorplans, dynamic pricing matrices, ownership split ledgers, and automated test coverage. | **COMPLETED** |
| **Phase 14** | **Caretaker Assignments & Service Scopes (Sprint 12)** | Caretaker onboarding profiles, property assignments, service scopes, spending threshold limits, instant revocation. | **COMPLETED** |
| **Phase 15** | **Vendor Management, Trade Categories & Rate Cards (Sprint 13)** | Vendor onboarding, business tax identifiers, trade specializations, multi-tenant rate cards, work orders. | **ACTIVE** |

### 3.2 Implementation Audit & Verification Results
* **`caretaking-assignments.test.ts`**: 28/28 tests passing (multi-tenant caretaker profiles, KYC status lifecycle, assignment state machine transitions, granular permission scopes, owner-defined spending caps, FR-ASG-010 instant revocation, multi-tenant quarantine, public API facade, domain event projections).
* **`property-portfolio.test.ts`**: 18/18 tests passing (multi-tenant property registration, address validation, rentable units & occupancy lifecycle, multi-owner equity split 100.00% invariant, presentation controller boundary, public API facades).
* **`shared-services.test.ts`**: 20/20 tests passing (multi-tenant notifications across 5 channels, template data interpolation, developer dry-run outbox, scheduler lifecycle and run history, full-text search token matching and type filtering, presentation controllers, public APIs).
* **`transaction-processing.test.ts`**: 20/20 tests passing (state machine lifecycle transitions, multi-tenant quarantine, cryptographic HMAC-SHA256 signature verification, replay defense idempotency, order settlement linkage, multi-gateway routing).
* **`order-processing.test.ts`**: 20/20 tests passing (pricing calculations & rounding precision, state machine transitions, multi-tenant quarantine & boundary isolation, two-phase inventory reservation & rollback compensation, controller validation, OrderModule public API).
* **`inventory-concurrency.test.ts`**: 18/18 tests passing (mathematical equilibrium invariant, multi-tenant SKU isolation, optimistic locking version conflicts, two-phase reservation lifecycle, public API).
* **`storage-adapters.test.ts`**: 24/24 tests passing (StorageProviderFactory dynamic resolution, S3 SigV4 presigned upload/download, GCS V4 signing, tenant bucket overrides, anti-traversal defense, AssetModule pluggable integration).
* **`asset-management.test.ts`**: 20/20 tests passing (MIME validation, size limits, presigned upload & confirmation, tenant quarantine 403, state integrity, storage provider port decoupling).
* **`token-hardening.test.ts`**: 11/11 tests passing (AES-GCM encryption, asymmetric RS256 signing, tenant claim propagation, anti-session hijacking on both symmetric and asymmetric tokens, RFC 7517 JWKS output).
* **`iam-mfa-strict-auth.test.ts`**: 24/24 tests passing (MFA enrollment, 24h expiration timeframe, token refresh, dynamic route protection, audit logs).
* **`enterprise-mobile`**: 26/26 tests passing across 7 test suites (session manager, tenant resolution, theme generator, API error handling).
* **`enterprise-white-label-frontend`**: 16/16 tests passing across 6 test suites (API client, tenant resolver, formatting, theme application).
* **TypeScript Build**: `@monolith/contracts` and `@monolith/api` compile cleanly with 0 type errors.

---

## 4. Security Controls & Standards Reference

1. **RFC 7519**: JSON Web Token (JWT)
2. **RFC 7517**: JSON Web Key (JWK) and JWKS
3. **NIST SP 800-63B**: Digital Identity Guidelines (Authentication and Lifecycle Management)
4. **OWASP Top 10 (2025)**: Broken Access Control & Identification / Authentication Failures
5. **OWASP Mobile Application Security Verification Standard (MASVS)**: Storage, Network, and Anti-Tampering.
