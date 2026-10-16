# OWASP Top 10 (2025) & API Security Alignment

| OWASP Vulnerability | Architecture Defense & Implementation | Verified In Code |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Deny-by-default on all resource endpoints. Backend validates resource ownership (`userId === order.userId`) and enforces RBAC via `requireRole('ADMIN')`. | `shared/presentation/auth.middleware.ts`, `tests/security/` |
| **A02: Cryptographic Failures** | Bcrypt with configurable salt rounds (min 10) for passwords. Strong JWT secrets validated at startup. Passwords never logged or returned in DTOs. | `shared/infrastructure/crypto.service.ts`, `modules/iam/` |
| **A03: Injection (SQL / Command)** | 100% parameterized SQL queries via `pg.Pool`. Zero raw string concatenation in SQL queries. Strict input validation with Zod schemas. | `infrastructure/database/connection-pool.ts`, all repositories |
| **A04: Insecure Design** | Strict module isolation. Clean Architecture separating domain rules from transport mechanisms. Decoupled asynchronous event integration. | `apps/api/src/tests/architecture/` |
| **A05: Security Misconfiguration** | Helmet security headers (CSP, HSTS, X-Content-Type-Options: nosniff). Validated environment variables with fail-fast Zod schema at startup. | `config/env.ts`, `app.ts` |
| **A06: Vulnerable & Outdated Components** | Pinned modern dependencies in `pnpm-lock.yaml`. Monorepo workspace linking. | `package.json`, `pnpm-workspace.yaml` |
| **A07: Identification & Auth Failures** | Sliding window rate limiting on authentication routes to stop brute force attacks. Strict token verification with expiration. | `shared/presentation/rate-limiter.middleware.ts` |
| **A08: Software & Data Integrity Failures** | Safe deserialization. Strongly typed schemas for all external contracts in `@monolith/contracts`. | `packages/contracts/` |
| **A09: Security Logging & Monitoring** | Structured JSON logging with correlation IDs (`X-Request-Id`) across all executions. Ready/live health checks. | `shared/infrastructure/logger.js`, `presentation/request-context.js` |
| **A10: SSRF & DoS Defenses** | Request payload size limit (1MB max). Sliding-window IP rate limiting. | `app.ts`, `rate-limiter.middleware.ts` |
