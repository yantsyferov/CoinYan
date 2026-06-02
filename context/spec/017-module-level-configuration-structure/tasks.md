# Task List: Module-Level Configuration Structure

- **Spec:** `context/spec/017-module-level-configuration-structure/`
- **Status:** Ready

---

- [x] **Slice 1: Frontend — `frontend/.claude/CLAUDE.md`**
  _Highest priority: migrates the existing Playwright protocol from root into the correct home._

  - [x] Create `frontend/.claude/` directory and write `CLAUDE.md` with all four sections: Launch & Test Commands (npm run dev, npx playwright test, docker-compose up -d prerequisite), Architecture Overview (React 18 + TypeScript SPA, Apollo Client, feature-sliced design), Rules and Conventions (full Playwright debugging protocol migrated from root CLAUDE.md, 2-attempt cap, Apollo-only data fetching, E2E tests only), Key Files and Structure. **[Agent: react-frontend]**
  - [x] Verify: read `frontend/.claude/CLAUDE.md` and confirm all four sections are present with frontend-specific (non-generic) content. **[Agent: react-frontend]**

---

- [x] **Slice 2: Auth Service — `services/auth-service/.claude/CLAUDE.md`**
  _Auth has unique complexity: JWT, Redis, Resend email._

  - [x] Create `services/auth-service/.claude/` directory and write `CLAUDE.md` with all four sections: Launch & Test (docker-compose + pytest inside container), Architecture Overview (JWT issuance + refresh, bcrypt, Redis token blocklist, Resend email, port 8000, owns `auth-db`), Rules (SQLAlchemy async, Pydantic v2, Alembic for all schema changes, never expose JWT secrets in logs), Key Files (`app/main.py`, `app/config.py`, `app/core/`, `app/routers/`, `app/models/`, `app/services/`, `alembic/`). **[Agent: python-backend]**
  - [x] Verify: read `services/auth-service/.claude/CLAUDE.md` and confirm all four sections with auth-specific content. **[Agent: python-backend]**

---

- [x] **Slice 3: Domain Backend Services batch — accounts, categories, transactions, budgets**
  _These four services share the same internal pattern: FastAPI + SQLAlchemy + Alembic + PostgreSQL._

  - [x] Create `services/accounts-service/.claude/CLAUDE.md` (owns `accounts-db`, port 8002; responsible for wallets and balance recalculation). **[Agent: python-backend]**
  - [x] Create `services/categories-service/.claude/CLAUDE.md` (owns `categories-db`, port 8003; manages expense categories and income sources). **[Agent: python-backend]**
  - [x] Create `services/transactions-service/.claude/CLAUDE.md` (owns `transactions-db`, port 8004; handles expense, income, and transfer entries; balance side-effects live here). **[Agent: python-backend]**
  - [x] Create `services/budgets-service/.claude/CLAUDE.md` (owns `budgets-db`, port 8005; per-category monthly budget limits and alert thresholds). **[Agent: python-backend]**
  - [x] Verify: read all four files and confirm each has four sections with content unique to its domain (no copy-paste across files). **[Agent: python-backend]**

---

- [x] **Slice 4: Rates Service — `services/rates-service/.claude/CLAUDE.md`**
  _Unique profile: no PostgreSQL, Redis-only, wraps two external APIs._

  - [x] Create `services/rates-service/.claude/` directory and write `CLAUDE.md` with all four sections: Launch & Test (docker-compose + `pytest tests/test_cache.py`), Architecture Overview (stateless cache layer, wraps Open Exchange Rates API for live rates + Frankfurter API for historical, all state in `rates-redis`, port 8006), Rules (no Alembic/no ORM — stateless by design; TTL contract: 1 h today, 30 days historical; always serve stale with `stale: true` flag when APIs unreachable), Key Files (`app/main.py`, `app/config.py`, `app/routers/`, `app/services/`, `tests/test_cache.py`). **[Agent: python-backend]**
  - [x] Verify: read `services/rates-service/.claude/CLAUDE.md` and confirm rates-specific content in all four sections. **[Agent: python-backend]**

---

- [x] **Slice 5: Web BFF — `services/web-bff/.claude/CLAUDE.md`**
  _Most complex backend module: GraphQL gateway orchestrating all 6 services, 75 KB schema._

  - [x] Create `services/web-bff/.claude/` directory and write `CLAUDE.md` with all four sections: Launch & Test (docker-compose + pytest), Architecture Overview (only public-facing backend; translates GraphQL → REST to all 6 services; no owned DB; Redis for dashboard cache; `app/schema.py` is the full 75 KB GraphQL contract, port 8001), Rules (Strawberry for all type and resolver definitions; zero business logic in BFF — domain rules belong in domain services; every schema change requires a matching downstream endpoint change; never call a service that is irrelevant to the resolver), Key Files (`app/main.py`, `app/schema.py`, `app/routers/`, `app/config.py` — note internal structure of schema.py: organized by domain resolver groups). **[Agent: python-backend]**
  - [x] Verify: read `services/web-bff/.claude/CLAUDE.md` and confirm all four sections with BFF-specific content. **[Agent: python-backend]**

---

- [x] **Slice 6: Root CLAUDE.md cleanup** _(must run after all module files are verified)_
  _Removes module-specific content from root, leaving only the global Docker startup requirement._

  - [x] Remove from root `CLAUDE.md`: Test Debugging Protocol section, Test Commands table, Services section (`npm run dev` note), General Rules section. **[Agent: general-purpose]**
  - [x] Add a short replacement note to root `CLAUDE.md` explaining that module-specific instructions now live in each module's `.claude/CLAUDE.md`, and retain the `docker-compose up -d` requirement as a global prerequisite. **[Agent: general-purpose]**
  - [x] Verify: read root `CLAUDE.md` and confirm it no longer contains Playwright commands or the test debugging protocol, and still contains the Docker startup requirement. **[Agent: general-purpose]**
