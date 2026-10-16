# Industry-Agnostic Dynamic Enterprise Boilerplate

[![Architecture](https://img.shields.io/badge/Architecture-Modular%20Monolith%20%7C%20Microservices-blue.svg)](#architecture-overview)
[![Infrastructure](https://img.shields.io/badge/Infra-Docker%20%7C%20Kubernetes%20%7C%20Cloud%20IaC-326CE5.svg)](#infrastructure--devops-infra)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%2B-61DAFB.svg)](#frontend-web-application-frontend)
[![Mobile](https://img.shields.io/badge/Mobile-React%20Native-61DAFB.svg)](#mobile-application-mobile)
[![Communication](https://img.shields.io/badge/IPC-gRPC%20%2B%20Event--Driven-red.svg)](#backend-microservices-backend)
[![AI Enabled](https://img.shields.io/badge/AI%20Assisted-.ai%20Agent%20Governed-green.svg)](#ai-assistant-governance-ai)

A production-grade, enterprise boilerplate designed to bootstrap multi-tenant, industry-agnostic software systems. Powered by dynamic database-driven configuration, a dual deployment architecture (Modular Monolith $\leftrightarrow$ Distributed Microservices), full infrastructure orchestration, and native AI coding assistant directives.

---

## Table of Contents

- [Architectural Overview](#architectural-overview)
- [Key Architectural Tenets](#key-architectural-tenets)
- [Repository Structure](#repository-structure)
- [Module Deep-Dives](#module-deep-dives)
  - [1. Backend Microservices (`/backend`)](#1-backend-microservices-backend)
  - [2. Modular Monolith (`/monolith`)](#2-modular-monolith-monolith)
  - [3. Frontend Web Application (`/frontend`)](#3-frontend-web-application-frontend)
  - [4. Mobile Application (`/mobile`)](#4-mobile-application-mobile)
  - [5. Infrastructure & DevOps (`/infra`)](#5-infrastructure--devops-infra)
  - [6. AI Assistant Engine (`/.ai`)](#6-ai-assistant-engine-ai)
  - [7. CI/CD Workflows (`/.github`)](#7-cicd-workflows-github)
- [DB Configuration-Driven Engine](#db-configuration-driven-engine)
- [Monolith $\leftrightarrow$ Microservices Parity Strategy](#monolith--microservices-parity-strategy)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quickstart with Docker Compose](#quickstart-with-docker-compose)
  - [Running on Kubernetes](#running-on-kubernetes)
- [Development Workflow](#development-workflow)
- [License](#license)

---

## Architectural Overview

This platform is engineered to eliminate the trade-off between speed-to-market and hyperscale adaptability:

```
                                  +---------------------------------------+
                                  |         Clients (Web & Mobile)        |
                                  |   React Web SPA  /  React Native App  |
                                  +-------------------+-------------------+
                                                      |
                                                      | HTTPS / WSS / REST / GraphQL
                                                      v
                                  +---------------------------------------+
                                  |           API Gateway / Ingress       |
                                  |       (Traefik / NGINX / Kong)        |
                                  +-------------------+-------------------+
                                                      |
                    +---------------------------------+---------------------------------+
                    | (Mode A: Microservices)                                           | (Mode B: Modular Monolith)
                    v                                                                   v
     +------------------------------+                                    +------------------------------+
     |   Distributed Services Hub   |                                    |      Modular Monolith        |
     |                              |                                    |                              |
     |  +------------------------+  |                                    |  +------------------------+  |
     |  | Configuration Service  |  |                                    |  | Module: Config & Meta  |  |
     |  +------------------------+  |                                    |  +------------------------+  |
     |              | (gRPC)        |                                    |              | (Internal Bus)|
     |  +------------------------+  |                                    |  +------------------------+  |
     |  | Identity & Auth Service|  |                                    |  | Module: Identity & Auth|  |
     |  +------------------------+  |                                    |  +------------------------+  |
     |              |               |                                    |              |               |
     |  +------------------------+  |                                    |  +------------------------+  |
     |  | Domain / Industry Svc  |  | <====== Architectural Mirror =====>|  | Module: Domain/Industry|  |
     |  +------------------------+  |                                    |  +------------------------+  |
     |              |               |                                    |              |               |
     |  +------------------------+  |                                    |  +------------------------+  |
     |  | Notification / Mail Svc|  |                                    |  | Module: Notifications  |  |
     |  +------------------------+  |                                    |  +------------------------+  |
     |              |               |                                    |              |               |
     |  +------------------------+  |                                    |  +------------------------+  |
     |  | Distributed Scheduler  |  |                                    |  | Module: Cron Scheduler |  |
     |  +------------------------+  |                                    |  +------------------------+  |
     +--------------+---------------+                                    +--------------+---------------+
                    |                                                                   |
                    +---------------------------------+---------------------------------+
                                                      |
                    +---------------------------------+---------------------------------+
                    |                                 |                                 |
                    v                                 v                                 v
        +-----------------------+         +-----------------------+         +-----------------------+
        |   Event Stream Broker |         |  Elasticsearch Cluster  |         |    Datastores (RDBMS/ |
        |  Kafka / NATS / Rabbit|         |  Full-Text Search & Log |         |     NoSQL / Redis)    |
        +-----------------------+         +-----------------------+         +-----------------------+
```

---

## Key Architectural Tenets

1. **Industry-Agnostic Core**: The core business domains do not hardcode single-vertical assumptions (e.g. "patient", "property", "vehicle", or "product"). Instead, entities, fields, relationships, and validation rules are resolved dynamically through the **Configuration Service**.
2. **Dual-Deployment Parity (Monolith $\leftrightarrow$ Microservices)**: Code written in the modular monolith mirrors microservice domain boundaries 1:1. The system can be deployed as an all-in-one modular binary for lightweight deployments, or disassembled into isolated microservices without domain refactoring.
3. **High-Performance Inter-Process Communication**: High-throughput inter-service synchronization using **gRPC (Protocol Buffers)** for synchronous queries and an **Event-Driven Architecture (EDA)** for asynchronous cross-domain state propagation.
4. **Resilient Distributed Scheduling & Search**: Built-in centralized cron orchestration and out-of-the-box **Elasticsearch** indexing for multi-tenant, schema-flexible full-text querying.
5. **AI-Native Governance (`.ai`)**: Built-in system blueprints, knowledge items, code templates, and prompts allowing AI coding agents to deterministically generate, customize, and extend domain modules for newly configured industries.

---

## Repository Structure

```plaintext
.
├── .ai/                    # AI assistant instructions, context prompts, and schema rules
├── .github/                # GitHub Actions workflows for CI/CD and automation
├── backend/                # Distributed microservices ecosystem
│   ├── services/           # Independent microservices (Auth, Config, Domain, Scheduler, etc.)
│   ├── common/             # Shared libraries (gRPC protos, DB utils, logging, middleware)
│   └── event-bus/          # Event streaming publishers, consumers, and message schemas
├── frontend/               # Web UI application (React, dynamic config-driven components)
├── mobile/                 # Cross-platform mobile application (React Native)
├── monolith/               # Modular monolithic application mirroring backend microservices
│   ├── modules/            # Isolated domain modules (matching backend/services)
│   ├── core/               # Shared kernel, in-memory event bus, and database orchestration
│   └── main/               # Application entry point and server bootstrap
└── infra/                  # Infrastructure as Code, containerization, and orchestration
    ├── docker/             # Dockerfiles and multi-stage build definitions
    ├── docker-compose/     # Multi-container local orchestration profiles
    ├── k8s/                # Kubernetes manifests (deployments, services, HPA, ingress)
    ├── helm/               # Helm charts for automated cloud deployments
    └── terraform/          # Cloud infrastructure scaffolding (AWS / GCP / Azure)
```

---

## Module Deep-Dives

### 1. Backend Microservices (`/backend`)

The distributed backend microservices suite is architected around high cohesion, loose coupling, and decoupled communication:

- **gRPC RPC Layer**: Ultra-fast internal communication using Protocol Buffers (`.proto`) definitions with strict typing and backward compatibility.
- **Event-Driven Broker**: Kafka / NATS / RabbitMQ event integration with Outbox Pattern to guarantee at-least-once message delivery.
- **Elasticsearch Engine**: Real-time indexing pipeline syncing dynamic entity configurations and tenant data for fuzzy search, faceting, and analytics.
- **Distributed Scheduler**: Cluster-safe cron job scheduler (supporting quartz/distributed locks via Redis) to handle tenant-specific periodic tasks, reports, and reminders.
- **Common & Domain Services**:
  - `config-service`: Manages industry schemas, form structures, permissions, and tenant metadata.
  - `auth-service`: Authentication, RBAC/ABAC authorization, and JWT/OAuth2 session issuance.
  - `notification-service`: Multi-channel alerting (Email, SMS, WebSockets, Push Notifications).
  - `industry-domain-service`: Dynamic workflow orchestrator adapting behavior based on tenant configuration.

### 2. Modular Monolith (`/monolith`)

The monolith acts as a direct counterpart to the microservices ecosystem, offering the same capabilities in a unified runtime:

- **Hexagonal / Clean Architecture**: Each module in `/monolith/modules` contains its own domain, application, and infrastructure layers.
- **In-Memory & Distributed Event Bridge**: Modules communicate via an internal domain event dispatcher that can transparently switch between in-process memory buses and external message brokers.
- **Frictionless Portability**: Code models, DTOs, and business logic can be copied or extracted into `/backend/services` with zero friction when splitting services.

### 3. Frontend Web Application (`/frontend`)

Modern, high-performance web interface built with **React**:

- **Config-Driven UI Components**: Form generators, data tables, detail views, and navigation menus are rendered dynamically from the Configuration Service schema.
- **Clean Design System**: Themeable token system supporting white-labeling and industry-specific branding across tenants.
- **State & Query Orchestration**: Optimistic updates, normalized caching, and resilient network synchronization.
- **Micro-Frontend Ready**: Built to allow separate domain panels to be loaded standalone or as a unified dashboard.

### 4. Mobile Application (`/mobile`)

Cross-platform application built with **React Native**:

- **Universal Mobile Experience**: Native iOS and Android application with unified UI paradigms.
- **Dynamic Screens**: Dynamic schema-based form engines and component rendering adapted for mobile touch interactions.
- **Offline-First Synchronization**: Local caching with background delta synchronization when network connectivity fluctuates.

### 5. Infrastructure & DevOps (`/infra`)

Production-ready infrastructure scaffolding to deploy anywhere:

- **Dockerization (`/infra/docker`)**: Multi-stage, minimal image footprint builds optimized for caching, security, and fast startup.
- **Kubernetes Scaling (`/infra/k8s`)**:
  - Horizontal Pod Autoscalers (HPA) configured for CPU, memory, and custom metrics.
  - Ingress controllers, TLS cert-manager configurations, and network security policies.
  - Separation of environments (dev, staging, production) via namespaces and Kustomize.
- **Cloud Scaffolding (`/infra/terraform`)**: Declarative scripts for provisioning managed databases, Kubernetes clusters, object storage, and VPC networks.

### 6. AI Assistant Engine (`/.ai`)

Dedicated workspace rules and context assets for AI coding partners (e.g. Antigravity, GitHub Copilot, Cursor):

- **Industry Expansion Blueprints**: Standard operating procedures for how the AI should generate a new industry schema and instantiate corresponding UI layouts.
- **Coding Standards & Architectural Guidelines**: Guardrails enforcing clean code, boundary isolation, and protocol conventions.
- **Context Injection**: Pre-computed system prompts mapping out service interactions, schema specifications, and event contracts.

### 7. CI/CD Workflows (`/.github`)

Automated pipelines located in `/.github/workflows`:

- Automated linting, static analysis, unit testing, and contract verification.
- Container image build, security vulnerability scanning, and push to container registries.
- Automated Kubernetes manifest rollout and health check verification.

---

## DB Configuration-Driven Engine

Rather than rebuilding backend schemas and frontend forms for every new vertical (e.g. Real Estate, Healthcare, Education, E-Commerce), this project uses a metadata configuration layer:

```json
{
  "industry": "healthcare",
  "entities": {
    "primaryRecord": {
      "name": "PatientRecord",
      "displayLabel": "Patient File",
      "fields": [
        { "key": "identifier", "type": "string", "required": true, "searchable": true },
        { "key": "bloodGroup", "type": "enum", "options": ["A+", "O+", "B+", "AB+"] },
        { "key": "admissionDate", "type": "datetime", "indexed": true }
      ],
      "searchConfig": {
        "fullTextSearchKeys": ["identifier", "notes"],
        "facetKeys": ["bloodGroup"]
      }
    }
  }
}
```

1. **Backend**: Schema validation engines evaluate requests against the tenant's registered JSON schema dynamically.
2. **Search**: Dynamic mapping templates in Elasticsearch index dynamic field attributes automatically.
3. **Frontend & Mobile**: Generic layout engines read schema definitions to render customized form controls, validations, and list filters automatically.

---

## Monolith $\leftrightarrow$ Microservices Parity Strategy

| Dimension | Distributed Microservices (`/backend`) | Modular Monolith (`/monolith`) |
| :--- | :--- | :--- |
| **Deployment Unit** | Independent containers per service | Single container / unified binary |
| **Communication** | gRPC (synchronous) + Message Broker (asynchronous) | In-process interfaces + Internal Event Dispatcher |
| **Data Storage** | Database-per-service pattern | Logical schema separation / multi-tenant database |
| **Scaling Profile** | Fine-grained independent horizontal auto-scaling | Coarse-grained horizontal scaling of the entire monolith |
| **Ideal Use Case** | Large engineering teams, hyperscale workloads | Early-stage velocity, cost-optimized setups, edge nodes |

Both patterns share the exact same domain logic, DTO contracts, and validation rules, enabling continuous migration back and forth as scaling needs evolve.

---

## Getting Started

### Prerequisites

- **Node.js** (v20+ recommended) & **npm** / **yarn** / **pnpm**
- **Docker** (v24+) & **Docker Compose** (v2+)
- **Kubectl** & **Minikube** / **Kind** / Cloud K8s cluster (optional, for Kubernetes deployments)
- **Protobuf Compiler** (`protoc`) for compiling gRPC schemas

### Quickstart with Docker Compose

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd base
   ```

2. Inspect and configure environment variables:
   ```bash
   cp .env.example .env
   ```

3. Launch the infrastructure prerequisites (PostgreSQL/MongoDB, Redis, Elasticsearch, Kafka/NATS):
   ```bash
   docker compose -f infra/docker-compose/docker-compose.infra.yml up -d
   ```

4. Choose your backend operational mode:
   - **Mode 1: Launch Modular Monolith**
     ```bash
     docker compose -f infra/docker-compose/docker-compose.monolith.yml up --build
     ```
   - **Mode 2: Launch Microservices Fleet**
     ```bash
     docker compose -f infra/docker-compose/docker-compose.microservices.yml up --build
     ```

5. Launch the Client Applications:
   - **Frontend (Web)**:
     ```bash
     cd frontend && npm install && npm run dev
     ```
   - **Mobile (React Native)**:
     ```bash
     cd mobile && npm install && npm run start
     ```

### Running on Kubernetes

Deploy to a local or remote cluster using Kustomize:

```bash
# 1. Apply base infrastructure (Databases, Message Broker, Elastic)
kubectl apply -k infra/k8s/overlays/local/infra

# 2. Deploy microservices and auto-scalers
kubectl apply -k infra/k8s/overlays/local/apps

# 3. Check deployment status
kubectl get pods -w
```

---

## Development Workflow

1. **Defining a New Service or Module**:
   - Create protocol definitions in `backend/common/proto/`.
   - Implement the domain logic in `monolith/modules/<module-name>` or `backend/services/<service-name>`.
2. **Extending an Industry Dynamic Schema**:
   - Add new schema metadata via the Configuration Service or API endpoints.
   - Frontend and Mobile dynamic view generators will pick up the updated definitions immediately.
3. **Prompting the AI Coding Assistant**:
   - Reference `/.ai/rules` and `/.ai/prompts` to guide the assistant on creating new industry workflows that conform strictly to project design patterns.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
