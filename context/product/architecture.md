# System Architecture Overview: CoinYan

_This document describes the high-level technical architecture of CoinYan — a web-first personal finance platform built on a microservices foundation, designed to scale toward crypto, multi-currency, and mobile platforms._

---

## System Design Philosophy

CoinYan follows a **layered microservices architecture**:

```
PostgreSQL DBs (per service)
        ↓
Backend Microservices (FastAPI — domain services)
        ↓
BFF Layer (FastAPI + GraphQL — one BFF per platform)
        ↓
Frontend Clients (React Web / future: iOS, Android)
```

- Each domain microservice owns its own PostgreSQL database (Database-per-Service pattern).
- The **Web BFF** aggregates calls to multiple services and exposes a single GraphQL API to the React frontend.
- Internal service-to-service communication uses REST (HTTP + JSON).
- The BFF layer scales horizontally per platform — a future Mobile BFF will serve iOS/Android with a tailored API.

---

## 1. Application & Technology Stack

- **Frontend Framework:** React + Vite (TypeScript SPA)
- **GraphQL Client:** Apollo Client — communicates with the Web BFF via GraphQL
- **Web BFF:** Python + FastAPI + Strawberry (GraphQL) — aggregates microservice REST calls into a unified GraphQL schema for the web frontend
- **Backend Microservices:** Python + FastAPI — one service per domain:
  - `auth-service` — sign-up, login, JWT token issuance and refresh
  - `accounts-service` — user accounts/wallets and balance management
  - `transactions-service` — income entries, expense entries, and account transfers
  - `categories-service` — custom user-defined expense categories
  - `budgets-service` — per-category monthly budget limits and alert logic
  - `reports-service` — aggregated chart data, monthly/weekly spending reports
  - `rates-service` — fiat exchange rate lookups; routes today's date to Open Exchange Rates API and historical dates to Frankfurter API; caches results in its own Redis instance (`rates-redis`)
- **FE ↔ BFF Protocol:** GraphQL over HTTP
- **BFF ↔ Microservices Protocol:** REST (HTTP + JSON)
- **Python ORM:** SQLAlchemy (async) with Pydantic v2 for data validation

---

## 2. Data & Persistence

- **Primary Database:** PostgreSQL — each microservice has its own isolated database instance (Database-per-Service pattern). Financial data is inherently relational; PostgreSQL provides strong ACID guarantees for accurate balance calculations.
- **Database Strategy:** Database-per-Service — `auth-db`, `accounts-db`, `transactions-db`, `categories-db`, `budgets-db`, `reports-db`
- **Rate Cache:** `rates-redis` — a dedicated Redis instance owned by `rates-service`; used exclusively for exchange rate caching (key pattern `rate:{from}:{to}:{date}`, TTL 1 hour for today's rate, 30 days for historical rates)
- **ORM & Migrations:** SQLAlchemy (async) + Alembic — version-controlled schema migrations per service
- **Caching Layer:** Redis — used by the BFF and services to cache dashboard aggregations, JWT token blocklist (for logout), and rate-limiting state

---

## 3. Infrastructure & Deployment

- **Hosting (V1):** Railway or Render — managed container hosting. Low operational overhead for early-stage development. Each microservice and BFF deployed as an independent Docker container.
- **Containerization:** Docker — all services containerized with Dockerfiles
- **Local Development:** Docker Compose — orchestrates all services, databases (PostgreSQL instances), and Redis locally in a single command
- **Scalability Path:** When scale demands it, migrate to AWS ECS (Elastic Container Service) with RDS (managed PostgreSQL) and ElastiCache (managed Redis). Docker ensures zero-friction migration.
- **CI/CD:** GitHub Actions — automated test, build, and deploy pipeline on push to main
- **Database Migrations:** Alembic — run as part of each service's startup or CI/CD pipeline

---

## 4. External Services & APIs

- **Authentication:** Custom JWT implementation — FastAPI + `bcrypt` (password hashing) + `python-jose` (JWT signing). Access tokens (short-lived) + refresh tokens (stored in Redis). No external auth dependency.
- **Fiat Exchange Rates (Live):** Hybrid strategy — **Open Exchange Rates API** (today's rates, requires `OPEN_EXCHANGE_RATES_APP_ID` env var) + **Frankfurter API** (free, no key, historical rates back to 1999). Proxied via `rates-service`; results cached in `rates-redis`. Stale cached rates served with a `stale: true` flag when both APIs are unreachable.
- **Crypto & Commodity Rates (Phase 5):** CoinGecko API — crypto (BTC, ETH, etc.) and commodity (Gold) price feeds. Used for the Base Value Anchor feature when users select crypto or gold as their reference currency.
- **Transactional Email:** Resend — password reset emails, budget alert notifications, welcome emails. Simple REST API, 100 emails/day on free tier.

---

## 5. Observability & Monitoring

- **Structured Logging:** Loguru (Python) — all microservices emit structured JSON logs. Logs are aggregated via the hosting platform's built-in log drain (Railway/Render log streaming → future: Datadog or CloudWatch).
- **Error Tracking:** Sentry — installed in all FastAPI services and the React frontend. Captures unhandled exceptions with full stack traces, release tracking, and basic performance monitoring.
- **Health Checks:** Each FastAPI service exposes a `/health` endpoint for container orchestration readiness/liveness probes.
