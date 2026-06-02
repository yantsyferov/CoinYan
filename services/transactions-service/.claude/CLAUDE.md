# Transactions Service — Claude Code Instructions

## Launch & Test Commands

```bash
# Run tests (from service root)
pytest

# Run a single test file
pytest tests/path/to/test_file.py

# Start the service locally (requires transactions-db to be running)
uvicorn app.main:app --reload --port 8004

# Run with Docker Compose (preferred)
docker-compose up -d transactions-service

# Apply migrations manually (also runs automatically at startup via lifespan)
alembic upgrade head

# Generate a new migration after model changes
alembic revision --autogenerate -m "short_description"
```

The service is reachable at `http://localhost:8004`. The `/health` endpoint confirms liveness.

## Architecture Overview

The service owns a single PostgreSQL database (`transactions-db`) and follows a strict four-layer stack:

```
routers/  →  repositories/  →  models/  (no separate services/ layer yet)
```

There is no `services/` business logic layer in active use — all domain logic lives directly in `TransactionRepository` static methods. The `app/services/` directory exists but is currently empty.

**Startup sequence.** The `lifespan` context manager in `main.py` runs Alembic migrations synchronously via `ThreadPoolExecutor` before the app starts serving requests. This ensures the schema is always up-to-date on container start without a separate init container.

**Auth identity.** There is no JWT verification inside this service. The `X-User-Id` header is injected by the web-bff (acting as a trusted internal gateway). `get_user_id` in `core/dependencies.py` reads this header and 401s if it is absent.

**Database session.** `get_db()` yields an `AsyncSession` scoped to the request. It commits on success and rolls back on any exception. `expire_on_commit=False` is set so ORM objects remain usable after commit.

**Transfer pair model.** A transfer is stored as two linked `Transaction` rows (debit leg and credit leg), both with `type="transfer"`. The legs are cross-linked via `transfer_peer_id`. On the debit leg `account_id == from_account_id`; on the credit leg `account_id == transfer_to_account_id`. The pair is created with two flushes — the first assigns UUIDs, the second writes the cross-references.

**Multi-currency fields.** Each transaction stores both the amount in the source currency (`amount`, `source_currency`) and the amount converted to the account's native currency (`account_amount`, `account_currency`). An optional base-currency anchor stores the amount in the user's configured base currency (`base_currency_amount`, `base_currency_code`, `base_currency_rate`) for cross-currency dashboard aggregations. `base_currency_amount` is recomputed on edit as `amount * base_currency_rate`.

**Totals aggregation.** `get_totals` switches its amount expression based on whether `base_currency` is passed. When a base currency is provided it prefers `base_currency_amount` (falling back to `amount`) so that the dashboard can sum amounts across different account currencies.

## Rules and Conventions

- Never import code from other services. Communicate exclusively over HTTP.
- All repository methods are `async` static methods on `TransactionRepository`. Do not introduce instance state.
- Use `session.flush()` (not `session.commit()`) inside repository methods. The `get_db` dependency owns the commit boundary.
- Exception: `delete_transfer_pair` calls `session.commit()` directly because it deletes two rows atomically and must release the lock immediately. This is the only deliberate deviation.
- `transaction_date` must never be a future date — enforced in both the Pydantic schema (`@field_validator`) and the DB `CheckConstraint`.
- Expense transactions require `expense_category_id` and must have `income_source_id = None`. Income transactions must have `expense_category_id = None`. This is enforced by `model_validator` in Pydantic and by the `chk_transaction_type` DB constraint.
- All amount fields use `Numeric(19, 4)` (Decimal with 4 decimal places). All rate fields use `Numeric(18, 6)`. Never use `float` for monetary values in the ORM layer.
- List queries require at least one of `account_id`, `expense_category_id`, or `income_source_id` — the router enforces this at HTTP level, the repository re-validates it and raises `ValueError`.
- Sorting for list queries is always `transaction_date DESC, created_at DESC`.
- Migration files are named `YYYY-MM-DD_<description>.py`. Run `alembic revision --autogenerate` and rename the generated file to follow this convention.
- Loguru is configured at `main.py` startup with `serialize=True` (JSON output). Do not add plain `print` statements; use `logger.info/warning/error`.
- Sentry is only initialised when `SENTRY_DSN` is non-empty.

## Key Files and Structure

```
services/transactions-service/
├── alembic/                        # Migration history for transactions-db
│   └── versions/                   # One file per migration, named YYYY-MM-DD_*.py
├── alembic.ini
├── app/
│   ├── config.py                   # Settings (DATABASE_URL, SENTRY_DSN) via pydantic-settings
│   ├── main.py                     # FastAPI app, lifespan (runs migrations), Sentry + Loguru init
│   ├── core/
│   │   └── dependencies.py         # get_db (AsyncSession), get_user_id (X-User-Id header)
│   ├── models/
│   │   ├── base.py                 # DeclarativeBase
│   │   └── transaction.py          # Transaction ORM model; CheckConstraint + 4 partial indexes
│   ├── repositories/
│   │   └── transaction_repo.py     # All DB access: create, create_transfer_pair,
│   │                               #   list_by_filter, get_by_id, update_transaction,
│   │                               #   update_transfer_pair, delete_transfer_pair,
│   │                               #   get_totals, get_totals_by_currency,
│   │                               #   get_latest_rate, get_cumulative_balance
│   ├── routers/
│   │   ├── health.py               # GET /health → {"status": "ok"}
│   │   └── transactions.py         # All /internal/transactions/* endpoints
│   ├── schemas/
│   │   └── transaction.py          # Pydantic v2 request/response models
│   └── services/                   # Reserved; currently empty
└── pyproject.toml                  # Dependencies; asyncio_mode = "auto" for pytest
```

**Router endpoints summary (`/internal/transactions` prefix):**

| Method | Path | Description |
|---|---|---|
| `POST` | `` | Create expense or income transaction |
| `POST` | `/transfer` | Create a debit+credit transfer pair |
| `GET` | `` | List transactions (requires at least one filter) |
| `GET` | `/{transaction_id}` | Fetch a single transaction |
| `PATCH` | `/{transaction_id}` | Edit amount, note, date, exchange rate, base rate |
| `DELETE` | `/{transaction_id}` | Cancel transaction (transfer deletes both legs) |
| `GET` | `/balance` | Cumulative income-minus-expense up to a date |
| `GET` | `/totals` | Totals grouped by category/income-source for a month |
| `GET` | `/totals-by-currency` | Per-currency totals for a category or income source |
| `GET` | `/latest-rate` | Most recent account→base-currency exchange rate |

**Important URL ordering note.** The `GET /latest-rate` and `GET /balance` and `GET /totals` routes are registered before `GET /{transaction_id}` in `routers/transactions.py`. This order must be preserved to avoid FastAPI matching literal path segments as `transaction_id`.
