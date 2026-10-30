# Sprint 02: Identity & Authentication

**Sprint ID:** `SPRINT_02`  
**Theme:** Platform Foundation — User Identity, Cryptographic Tokens & Account Lifecycle  
**Status:** `COMPLETED / VERIFIED`  
**Core Components:** User registration, login, authentication, account lifecycle, password security, asymmetric JWT (RS256) & JWKS

---

## 1. Objectives & Scope

1. Deliver user registration, credential hashing, login, and secure session management.
2. Upgrade token signing to asymmetric RSA (`RS256`) and publish an RFC 7517 compliant OpenID Connect JWKS endpoint (`/.well-known/jwks.json`).
3. Encrypt refresh tokens using AES-256-GCM with a 24-hour MFA expiration window.
4. Implement persistent client device fingerprinting (`X-Device-Fingerprint`) to thwart session hijacking while intentionally decoupling client IP from token hash to support mobile roaming.

---

## 2. Delivered Artifacts

- **IAM Module (`apps/api/src/modules/iam`)**:
  - `User` entity with roles, email uniqueness, password hash, and active status.
  - `RegisterUserUseCase` & `LoginUserUseCase` enforcing strict password hashing (bcrypt/argon2).
  - `TokenService`: Generates RSA key pairs, signs short-lived RS256 JWTs (15 min), and encrypts refresh tokens (7 days).
  - Public JWKS endpoint mounted at `GET /api/iam/.well-known/jwks.json`.
- **Anti-Session Hijacking**:
  - Device fingerprint validation binding `X-Device-Fingerprint` and User-Agent HMAC into JWT `fgp` claims.
  - Verification middleware terminating mismatched sessions with `401 Unauthorized`.
- **Audit Logging**:
  - `iam.audit_logs` storing immutable authentication attempts, login failures, and security events.

---

## 3. Verification & Quality Gates

- `token-hardening.test.ts`: 11/11 tests passed (RS256 signing, JWKS endpoint RFC 7517 output, AES-GCM encryption, session hijacking defense).
- `iam-mfa-strict-auth.test.ts`: Passed all token lifecycle and authentication challenge tests.
