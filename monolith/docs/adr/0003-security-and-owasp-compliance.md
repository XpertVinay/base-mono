# ADR 0003: Security & OWASP Top 10 (2025) Compliance

## Status
Accepted

## Context
Production web platforms are susceptible to authentication bypass, broken access control, injection attacks, and information leakage.

## Decision
1. **Deny-by-Default**: All mutating endpoints and personal resource endpoints require valid JWT authentication unless explicitly public (e.g. login/register).
2. **Resource-Level Authorization**: Ownership of orders, assets, and transactions is validated on the backend. The backend never trusts client-supplied user IDs or role claims.
3. **Input Validation**: All incoming HTTP payloads are validated against strict Zod schemas before reaching application use cases. Malformed requests are rejected with 400 Bad Request.
4. **Injection Defenses**: Raw SQL queries exclusively use parameterized placeholders (`$1, $2, ...`).
5. **Safe Error Handling**: Internal server errors return sanitized JSON responses without exposing database schemas, system internals, or stack traces.
6. **Transport & Network Protection**: Helmet enforces strict CSP, HSTS, X-Content-Type-Options: nosniff, and rate limiters protect against brute force and DoS.

## Consequences
- **Positive**: Comprehensive security posture aligned with OWASP Top 10 (2025) and API Security recommendations.
- **Positive**: Tested and verified by automated security test suites (`security-controls.test.ts`).
