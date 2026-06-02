# Categories Service — Claude Code Instructions

## Launch & Test Commands

Start the service via Docker Compose from the repo root:
```bash
docker-compose up -d categories-service
```

The service listens on **port 8003** inside the container (mapped to host port 8003).

Run the test suite from the service root:
```bash
cd services/categories-service && pytest
```

`asyncio_mode = auto` is set in `pyproject.toml`, so no `@pytest.mark.asyncio` decoration is needed on async test functions.

Linting:
```bash
cd services/categories-service && ruff check app/
```

Alembic — generate a new migration (run inside the container or with the correct DATABASE_URL set):
```bash
alembic revision --autogenerate -m "describe_change"
alembic upgrade head
```

Migrations run **automatically at startup** via `lifespan` in `app/main.py` — Alembic is invoked in a `ThreadPoolExecutor` to avoid conflicts with the running asyncio event loop.

## Architecture Overview

categories-service owns a dedicated PostgreSQL database (`categories-db`) and is called exclusively by the web-bff. It is never imported by other services — all communication is over HTTP.

**Request flow:**
```
web-bff  →  HTTP  →  router  →  service  →  repository  →  AsyncSession  →  categories-db
```

**Two parallel domain tracks, structurally identical:**

| Domain | Table | Router prefix | Service | Repository |
|---|---|---|---|---|
| Expense categories | `expense_categories` | `/internal/expense-categories` | `ExpenseCategoryService` | `ExpenseCategoryRepository` |
| Income sources | `income_sources` | `/internal/income-sources` | `IncomeSourceService` | `IncomeSourceRepository` |

**Identity / auth:** The web-bff validates the JWT and injects the subject claim as the `X-User-Id` request header. The `get_user_id` dependency in `app/core/dependencies.py` reads this header — the service never touches JWTs directly.

**Seeding:** Expense categories only. `ExpenseCategoryService.get_or_seed` inserts 9 default categories (Groceries, Rent, Transport, etc.) for a user on their first `GET /internal/expense-categories` call, using `INSERT ... ON CONFLICT DO NOTHING`. Income sources have no defaults and start empty.

**Database session lifecycle:** `get_db` in `app/core/dependencies.py` wraps each request in an `AsyncSession`, commits on clean exit, and rolls back on any exception. Repository methods call `session.flush()` after writes — the commit happens at the dependency level when the request completes cleanly.

**Unique constraints:** Both tables enforce `(user_id, name)` uniqueness at the database level. `IntegrityError` on create/update is caught in the service layer and re-raised as HTTP 409.

## Rules and Conventions

- All endpoints are under `/internal/…` — these are BFF-internal routes, not public API.
- Both `expense_categories` and `income_sources` share one schema module: `app/schemas/category.py`. The schemas `CategoryResponse`, `CreateCategoryRequest`, and `UpdateCategoryRequest` serve both domains.
- `icon` values are validated against `VALID_ICONS` in `app/core/constants.py`: `{"cash", "card", "savings", "wallet", "bank", "piggybank"}`. Any value outside this set returns HTTP 422.
- `currency` is a 3-character ISO 4217 string (e.g. `"USD"`, `"EUR"`). It defaults to `"USD"` on both create request and column `server_default`. On `PATCH`, passing `null` / omitting `currency` leaves the existing value unchanged.
- `updated_at` is set by the database `server_default` on insert. It is NOT automatically updated on `PATCH` — if you add a trigger or ORM `onupdate`, add a migration.
- Repository methods are static methods on plain classes — no instantiation needed. Do not convert them to instance methods or inject the session via `__init__`.
- Keep `HTTPException` imports inside service method bodies (as currently done) to prevent circular imports between `app.services` and `app.routers`.
- Never import across service boundaries. If you need data from another service, call it over HTTP.
- Loguru is configured in `main.py` to emit structured JSON to stdout at INFO level. Use `from loguru import logger` — do not use `logging` from the standard library.
- Sentry is initialized only when `SENTRY_DSN` is non-empty (opt-in via env var).
- Line length is 100 characters (`ruff`, `pyproject.toml`). Target Python 3.12.

## Key Files and Structure

```
services/categories-service/
├── app/
│   ├── main.py                          # FastAPI app, lifespan (Alembic), Sentry, Loguru, router mounts
│   ├── config.py                        # Settings (DATABASE_URL, SENTRY_DSN) via pydantic-settings
│   ├── core/
│   │   ├── constants.py                 # VALID_ICONS set — the only allowed icon values
│   │   └── dependencies.py              # get_db (AsyncSession), get_user_id (X-User-Id header)
│   ├── models/
│   │   ├── base.py                      # DeclarativeBase
│   │   ├── expense_category.py          # ExpenseCategory ORM model
│   │   └── income_source.py             # IncomeSource ORM model
│   ├── repositories/
│   │   ├── expense_category_repo.py     # ExpenseCategoryRepository (get_by_user, bulk_create, create, get_by_id, update, delete)
│   │   └── income_source_repo.py        # IncomeSourceRepository (get_by_user, create, get_by_id, update, delete)
│   ├── routers/
│   │   ├── health.py                    # GET /health → {"status": "ok"}
│   │   ├── expense_categories.py        # CRUD under /internal/expense-categories
│   │   └── income_sources.py            # CRUD under /internal/income-sources
│   ├── schemas/
│   │   └── category.py                  # CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest
│   └── services/
│       ├── expense_category_service.py  # ExpenseCategoryService (get_or_seed, create, update, delete)
│       └── income_source_service.py     # IncomeSourceService (create, update, delete)
├── alembic/
│   ├── env.py
│   └── versions/
│       ├── 2026-05-18_create_categories_tables.py   # revision b1c2d3e4f5a6 — initial tables
│       └── 2026-05-27_add_currency_to_categories.py # revision c2d3e4f5a6b7 — adds currency column
├── alembic.ini
└── pyproject.toml                       # deps, ruff config, pytest asyncio_mode=auto
```

**Environment variables (required at runtime):**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Async PostgreSQL DSN, e.g. `postgresql+asyncpg://user:pass@categories-db:5432/categories` |
| `SENTRY_DSN` | Optional. Sentry error tracking DSN. Leave empty to disable. |
