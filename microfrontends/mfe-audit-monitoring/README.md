# Audit Trails & Monitoring Micro-Frontend (MFE)

[![Prometheus](https://img.shields.io/badge/Metrics-Prometheus%20v2.49-E6522C?logo=prometheus)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Dashboard-Grafana%20v10.3-F46800?logo=grafana)](https://grafana.com/)
[![React 18](https://img.shields.io/badge/MFE-React%2018%20%2B%20Vite-61DAFB?logo=react)](https://react.dev/)
[![Observability](https://img.shields.io/badge/SLA-Real--Time%20Customer%20Safeguards-10B981)](#incident-prevention--quick-remediation)

A mission-critical enterprise **Micro-Frontend (MFE)** providing unified audit trails, real-time Prometheus telemetry, embedded Grafana intelligence dashboards, and proactive incident remediation to detect and neutralize backend anomalies before they result in customer churn or business loss.

---

## 🌟 Key Capabilities

### 1. Live Audit Log Stream & Visual Trace Explorer
- **Multi-Service Telemetry Aggregation**: Streams and visualizes audit events across `iam-service`, `transaction-service`, `order-service`, `config-service`, `inventory-service`, and `audit-service`.
- **Cross-Service Correlation Traceability**: Trace requests end-to-end using distributed `correlationId` and span markers.
- **Deep Log Inspection Drawer**: Slide-over drawer detailing formatted JSON payloads, actor email, IP address, user agents, stack traces, and severity flags (`CRITICAL`, `ERROR`, `WARN`, `INFO`).

### 2. Prometheus Telemetry & Anomaly Detection
- **Dynamic Risk Score Engine**: Calculates a real-time **Customer Churn Risk Index (0–100)** based on transaction error velocity and critical audit events.
- **Microservices Scrape Health Matrix**: Live status indicators for all microservices on `:4011/metrics`, `:4000/metrics`, `:4001/metrics`, etc.
- **Interactive PromQL Sandbox**: Run live vector queries (`rate(audit_events_total[1m])`, `customer_impact_risk_score`, `sum(audit_errors_total)`) directly from the UI.
- **Automated Prometheus Alerting Rules**:
  - `CriticalAuditAnomalyDetected`: Fires instantly when critical security or data integrity events occur.
  - `HighTransactionFailureSpike`: Fires when transaction failure rate > 0.2/sec to avoid revenue drop.
  - `AuditErrorRateElevated`: Alerts when error ratio exceeds 5%.
  - `ServiceLatencyBreach`: P99 latency > 1500ms warning.

### 3. Grafana Visualizer & Embedded Dashboard
- **Embedded Kiosk Mode**: Live embedded Grafana dashboard (`/d/audit-telemetry-dashboard`) with pre-provisioned Prometheus datasources.
- **High-Fidelity Native Mirror**: Built-in SVG gauges, velocity sparklines, and annotation overlays if Grafana is booting or running behind VPN.
- **Grafana Annotation Markers**: Direct link connecting audit events (`/api/v1/audit/grafana/annotations`) to performance graph spikes.

### 4. Incident Prevention & Quick Remediation
- **Customer Churn Prevention Banner**: Flashing alert banner highlighting affected customer counts and financial exposure.
- **One-Click Remediation Actions**:
  - ⚡ **Auto-Retry Failed Transaction**: Resubmits stuck or dropped Stripe/payment transactions.
  - 🛡️ **Quarantine IP / Actor**: Imposes gateway rate limiting on brute-force attackers.
  - 📢 **Page On-Call SRE**: Dispatches high-priority alerts to PagerDuty/Slack channels.
  - ⚙️ **Scale Database Connection Pool**: Adjusts pool limits under sudden traffic surges.
  - ✅ **Acknowledge Incident & Trace**: Automatically records the remediation action back into `audit.audit_logs`.

---

## 🏗️ Architecture & Deployment Modes

### Mode A: Standalone Micro-Frontend
Run the MFE independently on its own port (`http://localhost:5174`):
```bash
cd boilerplate/microfrontends/mfe-audit-monitoring
npm install
npm run dev
```

### Mode B: Integrated Shell Host
The MFE is pre-integrated into the main white-label frontend:
```bash
cd boilerplate/frontend
npm run dev
```
Navigate to:
- `http://localhost:5173/audit-monitoring` (or click **Audit & Observability** in the sidebar navigation).

### Component Integration Example
```tsx
import { AuditMonitoringApp } from '@mfe/audit-monitoring';

export const MyObservabilityView = () => (
  <AuditMonitoringApp
    standalone={false}
    tenantId="enterprise-healthcare"
    apiBaseUrl="/api/v1/audit"
    grafanaUrl="http://localhost:3000"
    prometheusUrl="http://localhost:9090"
  />
);
```

---

## 🐳 Docker Compose Stack (Prometheus + Grafana)

The microservices stack in `boilerplate/backend-ms/docker-compose.yml` includes Prometheus and Grafana:

```bash
cd boilerplate/backend-ms
docker compose up -d prometheus grafana audit-service api-gateway
```

- **Prometheus UI**: `http://localhost:9090`
- **Grafana Dashboard**: `http://localhost:3000` (User: `admin`, Password: `admin`, Anonymous view enabled)
- **Audit Service API**: `http://localhost:4011`
- **API Gateway**: `http://localhost:4000/api/v1/audit`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/audit/logs` | Fetch filtered audit logs (`severity`, `resource`, `limit`) |
| `GET` | `/api/v1/audit/metrics/summary` | Telemetry KPIs (Risk Score, SLA %, Error Counts) |
| `GET` | `/api/v1/audit/alerts` | Active customer-risk alerts & incidents |
| `POST` | `/api/v1/audit/remediate` | Trigger instant quick remediation action |
| `GET` | `/metrics` | Raw Prometheus OpenMetrics scrape output |
| `GET` | `/api/v1/audit/grafana/annotations` | Grafana event overlay annotations |
