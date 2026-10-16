# Runbook: Local Development

## Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0 (`npm install -g pnpm`)
- Optional: Docker / Docker Compose (for local PostgreSQL container)

## 1. Quick Start (Zero-Setup Mode)
The modular monolith includes resilient in-memory storage fallbacks for local testing without Docker:

```bash
cd /Users/vinaykumar/Desktop/IMP/base/monolith

# Install workspace dependencies
pnpm install

# Run all test suites (Architecture, Security, Integration)
pnpm test

# Build all packages
pnpm build

# Start API dev server (Port 4000)
pnpm dev

# In a separate terminal, start React frontend (Port 5173)
pnpm dev:web
```

Open `http://localhost:5173` to view the interactive dashboard.

---

## 2. Full PostgreSQL Development Mode

To run with live PostgreSQL 16:

```bash
# 1. Start PostgreSQL with Docker
docker compose -f infrastructure/docker-compose.yml up -d postgres

# 2. Run Database Migrations
pnpm migrate

# 3. Start API server
pnpm dev
```

Health check verification:
```bash
curl http://localhost:4000/health
```

---

## 3. Running Automated Checks

```bash
# Run all unit, security, and architecture tests
pnpm test

# Run architecture boundary tests exclusively
pnpm test:arch

# Run OWASP security tests exclusively
pnpm test:security

# Typecheck entire monorepo
pnpm typecheck
```
