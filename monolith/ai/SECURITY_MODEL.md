# Real Estate CareTaking — Security Architecture & Governance

**Document:** `SECURITY_MODEL.md`  
**Version:** 1.0  
**Authority:** Mandatory Security Standard  
**Compliance Standards:** OWASP Top 10, Zero-Trust Architecture, RFC 7517 (JWKS), RFC 7519 (JWT)

---

## 1. Authentication Architecture (Asymmetric Tokens & JWKS)

```
+-----------------------------------------------------------------------------------+
|                              IAM Token Engine (RS256)                             |
|                                                                                   |
|  +--------------------------------+       +------------------------------------+  |
|  |       Private Signing Key      |       |         Public Verify Key          |  |
|  | - Kept strictly in Monolith API|       | - Published via OpenID Connect     |  |
|  | - Signs short-lived RS256 JWTs |       |   JWKS (/.well-known/jwks.json)    |  |
|  | - 15-minute access token expiry|       | - Cached by microservices & edge   |  |
|  +----------------+---------------+       +-----------------+------------------+  |
|                   |                                         |                     |
|                   v                                         v                     |
|         [ Access Token (RS256) ]                  [ Zero-Trust Verification ]     |
|         - tenantId, role, sub, fgp                - Verifies signature locally    |
|         - mfaVerified flag                        - Zero database roundtrips      |
+-----------------------------------------------------------------------------------+
```

### 1.1 Token Cryptography Scheme
- **Access Tokens (`accessToken`)**:
  - Signed using asymmetric RSA (`RS256`).
  - Short-lived (15 minutes).
  - Claims payload includes: `sub` (User ID), `role`, `tenantId`, `mfaVerified`, `fgp` (device fingerprint hash), and `iss`.
- **Public JWKS Endpoint**:
  - Standard endpoint: `GET /api/iam/.well-known/jwks.json`.
  - Exposes RFC 7517 compliant public key JSON with `kty: "RSA"`, `alg: "RS256"`, `use: "sig"`, and unique `kid`.
  - Enables microfrontends, mobile apps, and third-party integrations to verify signatures independently without holding the private master key.
- **Refresh Tokens (`refreshToken`)**:
  - Encrypted using AES-256-GCM.
  - Long-lived (7 days), subject to 24-hour MFA re-verification window.

---

## 2. Anti-Session Hijacking Architecture

To prevent stolen JWT replay attacks while ensuring mobile users do not get logged out when moving between networks:

1. **Client Persistent Fingerprint**:
   - Web frontend and mobile clients compute a persistent device hardware/browser fingerprint passed via `X-Device-Fingerprint`.
2. **Cryptographic Fingerprint Binding**:
   - Server computes `HMAC_SHA256(fingerprintSecret, "${userAgent}::${deviceFingerprint}")` and embeds a truncated signature in the JWT `fgp` claim.
   - On incoming requests, `auth.middleware.ts` recomputes the HMAC from current request headers and compares against the claim. If mismatched, the session is terminated immediately with `401 Unauthorized`.
3. **Decoupled IP Strategy**:
   - Client IP is **intentionally excluded** from the token hash. This prevents session dropping when mobile users transition between Cellular (4G/5G) and Wi-Fi, and prevents false-positive collisions behind corporate NATs or VPNs.
   - Client IP is recorded in `iam.audit_logs` for anomaly analysis.

---

## 3. Dynamic Multi-Factor Authentication (MFA)

Protected routes can require elevated authentication stored in `iam.mfa_protected_routes`:

| Reverification Mode | Mechanism | Target Endpoints |
| :--- | :--- | :--- |
| `SESSION_24H` | Checks if `mfaLastVerifiedAt` was within the last 24 hours. If older, returns `403 MFA_REVERIFICATION_REQUIRED`. | Sensitive management operations, lease approvals, contractor payouts. |
| `EVERY_TIME` | Requires an immediate, one-time TOTP challenge on every invocation regardless of session age. | Password modification, bank account alteration, disabling MFA, ownership transfers. |

---

## 4. Role-Based Access Control (RBAC) & Caretaking Delegation

The platform enforces a strict deny-by-default access model across 8 roles:

```
[ Unauthenticated Request ]
          |
          v
   [ Auth Middleware ] ---> (Invalid / Expired Token) ---> 401 Unauthorized
          |
          v
   [ Tenant Guard ]   ---> (Cross-Tenant Mismatch)    ---> 403 Forbidden
          |
          v
    [ RBAC Guard ]    ---> (Role not in AllowedList)  ---> 403 Forbidden
          |
          v
 [ Caretaking Scope ] ---> (Action exceeds Scope/Limit) -> 403 Forbidden
          |
          v
  [ Route Controller ]
```

### Granular Caretaking Permission Scopes
Caretakers do not hold blanket access. Every action is checked against their active assignment:
- `INSPECT_PROPERTY`: Allows logging inspection notes and photos.
- `COLLECT_RENT`: Allows viewing rent ledger and recording physical collections.
- `SOLICIT_QUOTES`: Allows requesting vendor quotes for maintenance.
- `AUTHORIZE_MINOR_REPAIRS`: Allows approving repairs strictly below `spending_limit`.
- `SHOW_PROPERTY_TO_LEADS`: Allows accompanying prospective tenants and buyers.
- `MANAGE_KEYS`: Allows checking out and returning property physical keys.

**Instant Revocation (`FR-ASG-010`)**: When an assignment status is updated to `TERMINATED`, all scopes are invalidated immediately.

---

## 5. Security Audit Logging

All security-sensitive operations are recorded immutably in `iam.audit_logs`:
- **Recorded Events**: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `MFA_CHALLENGE_SUCCESS`, `MFA_CHALLENGE_FAILED`, `SESSION_HIJACK_ATTEMPT`, `PERMISSION_REVOKED`, `CRITICAL_ACTION_TRIGGERED`.
- **Log Attributes**: `user_id`, `event_type`, `ip_address`, `user_agent`, `status`, `details` (JSONB metadata), and timestamp.
- **Tamper Resistance**: No `UPDATE` or `DELETE` grants exist on `iam.audit_logs`.

---

## 6. OWASP Top 10 Mitigations Summary

| Threat | Mitigation Implementation |
| :--- | :--- |
| **Broken Access Control** | Deny-by-default Express router middleware; RBAC guards; tenant isolation checks. |
| **Cryptographic Failures** | Asymmetric RS256 for JWT; AES-256-GCM for refresh tokens; bcrypt/argon2 for passwords. |
| **Injection (SQL/Command)** | 100% parameterized SQL queries via `pg` connection pool; zero raw string concatenation. |
| **Insecure Design** | Maintenance Equilibrium Engine with pre-authorized escrow caps and dual-key quotation reviews. |
| **Security Misconfiguration** | Helmet security headers (HSTS, CSP, X-Frame-Options); CORS restricted to authorized client domains. |
| **Vulnerable Components** | Automated pnpm audit dependencies; strict lockfile enforcement. |
| **Identification & Auth** | RS256 JWKS tokens, device fingerprint anti-hijacking, TOTP MFA with dynamic protected routes. |
| **Software & Data Integrity** | Anti-fraud GPS check-in verification and photographic before/after telemetry for repairs. |
| **Logging & Monitoring** | Immutable `iam.audit_logs` capturing client IP, user agent, event, and correlation IDs. |
| **Server-Side Request Forgery** | Outbound notification/webhook URLs strictly validated against allowed protocols and hostnames. |

