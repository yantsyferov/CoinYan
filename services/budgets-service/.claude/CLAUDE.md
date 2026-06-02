# Budgets Service — Claude Code Instructions

## Launch & Test Commands

```bash
# Run from inside the service directory
cd services/budgets-service

# Install dependencies (including dev extras)
pip install -e ".[dev]"

# Run the service locally (requires DATABASE_URL env var)
uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload

# Run all tests
pytest

# Run a single test file
pytest tests/test_budget_limits.py

# Generate a new Alembic migration (autogenerate from model changes)
alembic revision --autogenerate -m "describe_change"

# Apply all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1
```

Migrations run automatically on startup via `lifespan` in `app/main.py`. The migration step uses `run_in_executor` because `alembic/env.py` calls `asyncio.run()` internally — it must not run inside the active event loop.

Required environment variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Async PostgreSQL DSN (`postgresql+asyncpg://...`) |
| `JWT_SECRET` | `dev-secret-change-in-production` | Shared secret; BFF validates JWTs, service trusts forwarded header |
| `SENTRY_DSN` | `""` | Empty string disables Sentry |

## Architecture Overview

The service owns `budgets-db` (PostgreSQL) and exposes a single REST resource: per-user, per-category monthly budget limits. It follows a strict layered flow:

```
HTTP request
  → app/routers/budget_limits.py   (FastAPI router, path params, body validation)
  → app/repositories/budget_limit_repository.py  (async SQLAlchemy queries)
  → budgets-db (PostgreSQL table: budget_limit)
```

Authentication is not performed here. The web-bff validates the JWT and injects `X-User-Id` header. `get_user_id` in `app/core/dependencies.py` reads that header and raises 401 if absent.

Database sessions come from `get_db` in `app/core/dependencies.py`. The session factory uses `expire_on_commit=False` so ORM objects remain accessible after commit. The session commits on clean exit and rolls back on any exception.

Alembic migration history is isolated to this service. There is currently one migration: `a1b2c3d4e5f6` (create_budget_limit). New migrations go in `alembic/versions/` following the filename pattern `YYYY-MM-DD_<description>.py`.

Logging is structured JSON to stdout via Loguru (`serialize=True`). Sentry is initialised in `app/main.py` only when `SENTRY_DSN` is non-empty.

## Rules and Conventions

**Upsert semantics.** There is at most one `BudgetLimit` row per `(user_id, expense_category_id)` pair, enforced by the unique constraint `uq_budget_limit_user_category`. The `PUT /{category_id}` endpoint always calls `BudgetLimitRepository.upsert`, which uses a PostgreSQL `INSERT … ON CONFLICT DO UPDATE`. Do not replace this with a read-then-write pattern.

**No cross-service imports.** Never import from any other service directory. All inter-service communication happens over HTTP. This service has no Redis dependency; do not add one without updating the spec.

**Async only.** All route handlers and repository methods use `async def` with `await`. Never use synchronous SQLAlchemy calls or `requests` inside route handlers.

**Decimal arithmetic.** `amount` is stored as `Numeric(19, 4)` and represented as `Decimal` in Python. The router converts the incoming `float` to `Decimal` via `Decimal(str(body.amount))` to avoid floating-point precision loss. Keep this conversion; do not accept `Decimal` directly from JSON.

**Positive amount constraint.** Enforced both at the DB level (`ck_budget_limit_amount_positive`) and in the Pydantic schema (`amount_must_be_positive` validator on `UpsertBudgetLimitRequest`). Both layers must stay in sync.

**`updated_at` column.** The upsert sets `updated_at` to `func.now()` explicitly inside `on_conflict_do_update`. There is no application-level trigger; the DB server default only fires on INSERT. Preserve this explicit update in the repository.

**Router prefix.** All budget limit endpoints are under `/internal/budget-limits`. The `/internal` prefix signals that these routes are not reachable by end-users — the BFF is the only authorised caller.

**`redirect_slashes=False`.** Set on the router to prevent FastAPI from issuing 307 redirects for trailing-slash mismatches. Do not remove this.

**Health endpoint.** `GET /health` returns `{"status": "ok"}` with HTTP 200. It must remain at this path for Docker container probes.

**Pydantic response model.** `BudgetLimitResponse` uses `model_config = {"from_attributes": True}` for ORM-mode compatibility. It does not expose `user_id` (the caller already knows their own identity).

**Ruff lint rules.** E, F, I, UP. Line length 100. Target Python 3.12. Run `ruff check .` before committing.

## Key Files and Structure

```
services/budgets-service/
├── app/
│   ├── main.py                          # FastAPI app init, lifespan, Sentry, Loguru
│   ├── config.py                        # Settings (DATABASE_URL, JWT_SECRET, SENTRY_DSN)
│   ├── core/
│   │   └── dependencies.py             # get_db (AsyncSession), get_user_id (X-User-Id header)
│   ├── models/
│   │   ├── base.py                      # DeclarativeBase
│   │   └── budget_limit.py             # BudgetLimit ORM model (table: budget_limit)
│   ├── repositories/
│   │   └── budget_limit_repository.py  # get_by_user, upsert, get_by_user_and_category, delete
│   ├── routers/
│   │   ├── health.py                   # GET /health
│   │   └── budget_limits.py           # GET, PUT, DELETE /internal/budget-limits[/{category_id}]
│   └── schemas/
│       └── budget_limit.py            # BudgetLimitResponse, UpsertBudgetLimitRequest
├── alembic/
│   ├── env.py                          # Async migration runner; calls asyncio.run() — see startup note
│   └── versions/
│       └── 2026-05-21_create_budget_limit.py  # Revision a1b2c3d4e5f6 — sole migration
├── alembic.ini
├── pyproject.toml                       # asyncio_mode = auto; dev deps: pytest, pytest-asyncio, httpx
└── Dockerfile
```

**Endpoints summary:**

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Liveness/readiness probe |
| `GET` | `/internal/budget-limits` | `X-User-Id` header | List all limits for the user |
| `PUT` | `/internal/budget-limits/{category_id}` | `X-User-Id` header | Upsert limit for a category |
| `DELETE` | `/internal/budget-limits/{category_id}` | `X-User-Id` header | Remove limit; 404 if absent |
