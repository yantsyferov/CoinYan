# Technical Specification: Module-Level Configuration Structure

- **Functional Specification:** `context/spec/017-module-level-configuration-structure/functional-spec.md`
- **Status:** Completed
- **Author:** yantsyferov

---

## 1. High-Level Technical Approach

This is a pure developer-tooling change — no application source code, databases, APIs, or infrastructure are modified. The work consists of two actions:

1. Creating a `.claude/CLAUDE.md` file inside each of the 8 modules
2. Updating the root `CLAUDE.md` to remove module-specific content that migrates into those files

---

## 2. Proposed Solution & Implementation Plan

### 2.1 File Locations

| Module | New file path |
|---|---|
| auth-service | `services/auth-service/.claude/CLAUDE.md` |
| accounts-service | `services/accounts-service/.claude/CLAUDE.md` |
| categories-service | `services/categories-service/.claude/CLAUDE.md` |
| transactions-service | `services/transactions-service/.claude/CLAUDE.md` |
| budgets-service | `services/budgets-service/.claude/CLAUDE.md` |
| rates-service | `services/rates-service/.claude/CLAUDE.md` |
| web-bff | `services/web-bff/.claude/CLAUDE.md` |
| frontend | `frontend/.claude/CLAUDE.md` |

The root `.claude/` folder is unchanged. It continues to hold `agents/`, `commands/`, `skills/`, `settings.json`.

---

### 2.2 Standard CLAUDE.md Template

All 8 module instruction files follow the same four-section heading structure:

```markdown
# [Service Name] — Claude Code Instructions

## Launch & Test Commands
## Architecture Overview
## Rules and Conventions
## Key Files and Structure
```

---

### 2.3 Root CLAUDE.md Migration

The current root `CLAUDE.md` contains content that is Playwright/frontend-specific. After restructuring it is redistributed as follows:

| Content block | Today | After |
|---|---|---|
| Test Debugging Protocol | Root `CLAUDE.md` | `frontend/.claude/CLAUDE.md` |
| Test Commands table | Root `CLAUDE.md` | `frontend/.claude/CLAUDE.md` |
| General Rules (2-attempt cap, background processes) | Root `CLAUDE.md` | `frontend/.claude/CLAUDE.md` |
| `docker-compose up -d` startup note | Root `CLAUDE.md` | Root `CLAUDE.md` (global prerequisite, stays) |

After migration the root `CLAUDE.md` becomes a short file — one section covering the Docker startup requirement that applies to all modules.

---

### 2.4 Module-Specific Content Outlines

**Five domain backend services** (auth, accounts, categories, transactions, budgets — same pattern):
- **Launch & Test:** `docker-compose up -d` to start infrastructure; `docker exec -it <container> pytest` to run tests inside the container
- **Architecture Overview:** service's domain responsibility; owned PostgreSQL database (`*-db`) and port; which BFF resolver groups call it via `/internal/*` endpoints
- **Rules:** SQLAlchemy async session patterns; Pydantic v2 for all request/response schemas; Alembic for every schema change (no manual ALTER TABLE); router files map 1-to-1 with domain resources
- **Key Files:** `app/main.py`, `app/config.py`, `app/routers/`, `app/models/`, `app/services/`, `app/schemas/`, `alembic/`

**rates-service** (no DB; Redis + two external APIs):
- **Launch & Test:** `docker-compose up -d`; `pytest tests/test_cache.py`
- **Architecture Overview:** lightweight exchange rate cache layer; wraps Open Exchange Rates API (today's live rates) and Frankfurter API (historical rates back to 1999); all state lives in `rates-redis` — no PostgreSQL
- **Rules:** stateless by design — no Alembic, no ORM models; TTL discipline is the only persistence contract (1 h for today's rate, 30 days for historical); serve cached stale rates with `stale: true` flag when both APIs are unreachable
- **Key Files:** `app/main.py`, `app/config.py`, `app/routers/`, `app/services/`, `tests/test_cache.py`

**web-bff** (GraphQL gateway — most complex backend module):
- **Launch & Test:** `docker-compose up -d`; `pytest`
- **Architecture Overview:** the only backend module exposed to the frontend; translates GraphQL operations into REST calls to all 6 domain services; no owned PostgreSQL database; uses Redis for dashboard aggregation cache; `schema.py` is 75 KB and defines the entire public GraphQL contract
- **Rules:** Strawberry for all type and resolver definitions; no business logic in the BFF — domain rules stay in their respective services; every GraphQL schema change requires a corresponding change in the downstream service endpoint; never call services not relevant to the resolver
- **Key Files:** `app/main.py`, `app/schema.py` (full GraphQL schema — 75 KB, organized by domain resolver groups), `app/routers/`, `app/config.py`

**frontend** (most complex module — 37+ Playwright test files, feature-sliced architecture):
- **Launch & Test:** `npm run dev` (port 5173); `npx playwright test`; `npm run test:headed`; requires `docker-compose up -d` first
- **Architecture Overview:** React 18 + TypeScript SPA; communicates exclusively with web-bff via Apollo Client over GraphQL; feature-sliced design: `app/` (shell/routing), `features/` (domain feature modules), `entities/` (shared domain models), `pages/` (route-level components), `shared/` (UI components, utilities, API client), `widgets/` (composed blocks)
- **Rules:** Full Playwright test debugging protocol (migrated from root CLAUDE.md); Apollo Client for all data fetching — no direct REST calls anywhere; E2E tests only (no unit/component tests); maximum 2 fix attempts per failing test before escalating
- **Key Files:** `src/main.tsx`, `src/app/`, `src/features/`, `src/shared/api/`, `src/pages/`, `tests/`, `playwright.config.ts`, `vite.config.ts`

---

### 2.5 No Additional Nested Folders

Despite `web-bff/app/schema.py` being 75 KB and the frontend having 37+ test files, neither module requires a nested `.claude/` subfolder structure. Complexity is managed through clear section organization within a single `CLAUDE.md`.

---

## 3. Impact and Risk Analysis

**System Dependencies:** None. This change is invisible at runtime — no services restart, no data migrates, no APIs change.

| Risk | Mitigation |
|---|---|
| Content removed from root CLAUDE.md is not added to module files | Task checklist enforces a 1-to-1 migration: every removed block must appear in its destination file before root is modified |
| Module CLAUDE.md files go stale as services evolve | No automated enforcement — treat as living docs; update CLAUDE.md whenever commands or architecture change |
| Inconsistent section headings across modules | The four-section template is the enforced standard; all 8 files must use identical section headings |

---

## 4. Testing Strategy

Manual verification — this is a documentation change with no executable logic.

**Checklist:**
- [ ] All 8 `.claude/CLAUDE.md` files exist at the specified paths
- [ ] Each file contains all four required sections with module-specific (non-generic) content
- [ ] Root `CLAUDE.md` no longer contains the test debugging protocol or Playwright commands
- [ ] Root `CLAUDE.md` retains the Docker startup requirement
- [ ] Application tests remain green after the change (`docker-compose up -d && cd frontend && npx playwright test`)
