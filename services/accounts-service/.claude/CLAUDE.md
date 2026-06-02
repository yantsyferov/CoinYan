# Accounts Service — Claude Code Instructions

## Launch & Test Commands

Start the service (requires `accounts-db` PostgreSQL container to be running):

```bash
cd services/accounts-service
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

Run tests:

```bash
cd services/accounts-service
pytest
```

Run a single test file:

```bash
cd services/accounts-service
pytest tests/<file>.py -v
```

Start the full dependency stack (all services):

```bash
docker-compose up -d
```

Generate a new Alembic migration (run from the service root, with `accounts-db` reachable):

```bash
cd services/accounts-service
alembic revision --autogenerate -m "describe_the_change"
```

Apply migrations manually:

```bash
cd services/accounts-service
alembic upgrade head
```

Note: migrations also run automatically at startup via `_run_migrations()` executed in a `ThreadPoolExecutor` inside the `lifespan` handler. This is required because `alembic/env.py` calls `asyncio.run()` internally, which cannot run inside an already-running event loop.

## Architecture Overview

This service is a standalone FastAPI microservice that owns the `accounts-db` PostgreSQL database. It is called exclusively by the web-bff; no other service communicates with it directly.

**Request flow:**

```
web-bff (HTTP) → /internal/accounts/* router → AccountService → AccountRepository → accounts-db
```

**User identity:** The BFF validates the JWT and forwards the subject claim as the `X-User-Id` HTTP header. The `get_user_id` dependency reads this header — there is no JWT verification inside this service.

**Balance lifecycle:** `current_balance` is NOT recalculated from transactions here. The transactions-service calls `PATCH /internal/accounts/{account_id}/balance` with a `delta` field whenever a transaction is created, updated, or deleted. The service applies the delta atomically using a SQL `UPDATE ... SET current_balance = current_balance + delta` to avoid read-modify-write races.

**Soft deletion and recovery:** Deleting an account sets its `status` to `deleted_keep_history` or `deleted_all` and records `deleted_at`. A background task (`_cleanup_expired_accounts`) runs once per day and hard-deletes accounts whose `deleted_at` is older than 30 days. Accounts can be restored within that window via `POST /internal/accounts/{account_id}/restore`.

**First-access seeding:** If a user has no active accounts, `AccountService.get_or_seed_accounts` automatically creates a default Cash account using `DEFAULT_ACCOUNT_CURRENCY` (env var, defaults to USD). This is intentionally non-idempotent under concurrent first-requests in V1.

## Rules and Conventions

- **Never import code from another microservice.** All cross-service communication is HTTP only.
- Use `async def` for all route handlers, service methods, and repository methods. Never block the event loop with synchronous I/O.
- All DB access goes through `AccountRepository` static methods. Service methods orchestrate logic; they do not construct SQLAlchemy queries directly (exception: `adjust_balance` issues a targeted `UPDATE` inside the service for atomicity).
- The `get_db` dependency commits on success and rolls back on exception — do NOT call `session.commit()` inside repository or service methods. Use `await session.flush()` to populate DB-generated fields (e.g., `id`, `created_at`) before the commit.
- Route path `/internal/accounts/archived` MUST be declared before `/{account_id}` in the router file to prevent FastAPI from matching the literal string "archived" as an `account_id` path parameter.
- Pydantic schemas use `field_validator` (Pydantic v2) with `@classmethod`. Validators import `VALID_ICONS` and `VALID_CURRENCIES` from `app.core.constants` lazily (inside the validator body) to avoid circular imports.
- `AccountResponse` sets `model_config = {"from_attributes": True}` so it can be constructed directly from SQLAlchemy ORM objects.
- Balances use `Decimal` end-to-end (Python `Decimal`, Pydantic `Decimal`, SQLAlchemy `NUMERIC(18, 4)`). Never use `float` for monetary amounts.
- All timestamps are timezone-aware (`DateTime(timezone=True)`). Use `datetime.now(timezone.utc)` when constructing datetimes in Python code.
- Log with Loguru (`from loguru import logger`). Structured JSON output is configured once in `main.py`; do not reconfigure it elsewhere.
- Add Sentry error tracking for unexpected exceptions. `sentry_sdk.init` is called in `main.py` only when `SENTRY_DSN` is non-empty.
- Line length limit is 100 characters (ruff). Target Python 3.12+.

## Key Files and Structure

```
services/accounts-service/
├── alembic/
│   ├── env.py                          # Async Alembic runner; reads DATABASE_URL from settings
│   └── versions/
│       └── 2026-05-17_create_accounts_table.py  # Initial migration (revision a3f7c2d81b4e)
├── alembic.ini                         # Alembic config; sqlalchemy.url is overridden at runtime
├── pyproject.toml                      # Dependencies, pytest asyncio_mode=auto, ruff config
└── app/
    ├── main.py                         # FastAPI app, lifespan (migrations + cleanup task), Sentry/Loguru init
    ├── config.py                       # Pydantic BaseSettings: DATABASE_URL, DEFAULT_ACCOUNT_CURRENCY, SENTRY_DSN
    ├── core/
    │   ├── constants.py                # VALID_ICONS (6 values), VALID_CURRENCIES (ISO 4217 full set)
    │   └── dependencies.py            # get_db (async session with commit/rollback), get_user_id (X-User-Id header)
    ├── models/
    │   └── account.py                  # Account ORM model; Base declared here; indexes on (user_id, status) and (user_id, deleted_at)
    ├── repositories/
    │   └── account_repo.py            # AccountRepository — all SQLAlchemy queries; static methods only
    ├── schemas/
    │   └── account.py                  # AccountResponse, CreateAccountRequest, UpdateAccountRequest, DeleteAccountRequest
    ├── services/
    │   └── account_service.py         # AccountService — business logic, first-access seeding, atomic balance adjustment
    └── routers/
        ├── health.py                   # GET /health → {"status": "ok"}
        └── accounts.py                 # All /internal/accounts/* endpoints (prefix set on router, not main.py)
```

**Key endpoint reference:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness/readiness probe |
| GET | /internal/accounts | List active accounts; seeds default Cash account on first access |
| POST | /internal/accounts | Create a new account |
| GET | /internal/accounts/archived | List recoverable (soft-deleted/archived) accounts within 30-day window |
| GET | /internal/accounts/{account_id} | Get a single account |
| PATCH | /internal/accounts/{account_id} | Update name and icon |
| PATCH | /internal/accounts/{account_id}/balance | Adjust balance by delta (called by transactions-service) |
| POST | /internal/accounts/{account_id}/archive | Archive account (status → "archived") |
| POST | /internal/accounts/{account_id}/delete | Soft-delete account (option: "keep_history" or "delete_all") |
| POST | /internal/accounts/{account_id}/restore | Restore account within 30-day recovery window |
