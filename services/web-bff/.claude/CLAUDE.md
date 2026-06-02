# Web BFF — Claude Code Instructions

## Launch & Test Commands

Start all services (required before running the BFF):
```bash
docker-compose up -d
```

Run the BFF in isolation (hot-reload for development):
```bash
cd services/web-bff
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Build the Docker image:
```bash
docker build -t web-bff services/web-bff
```

Install dependencies locally:
```bash
cd services/web-bff && pip install -e ".[dev]"
```

Run tests:
```bash
cd services/web-bff && pytest
```

Lint:
```bash
cd services/web-bff && ruff check app/
```

Health check (once running):
```bash
curl http://localhost:8001/health
```

Open GraphiQL IDE (once running):
```
http://localhost:8001/graphql
```


## Architecture Overview

The Web BFF is a GraphQL gateway — the only backend service exposed to the React frontend. It owns no PostgreSQL database. All persistent data lives in the six downstream services; the BFF only fans out HTTP requests and assembles responses.

```
React (Apollo Client)
        |
        | /graphql  (Strawberry GraphQL)
        v
   web-bff :8001
   /health  (liveness probe)
   /exchange-rate  (REST passthrough to Frankfurter)
        |
        | httpx (internal REST calls with X-User-Id or Authorization headers)
        v
  ┌─────────────────────────────────────────────────┐
  │ auth-service       :8000   /internal/auth/*     │
  │ accounts-service   :8002   /internal/accounts/* │
  │ categories-service :8003   /internal/*-categ/*  │
  │ transactions-service :8004 /internal/transact/* │
  │ budgets-service    :8005   /internal/budgets/*  │
  │ rates-service      :8006   /internal/rates/*    │
  └─────────────────────────────────────────────────┘
        |
        v
   Redis :6379/0   (dashboard cache, base-currency cache)
```

Authentication flow: the frontend passes a JWT `Authorization: Bearer <token>` header. The BFF extracts `user_id` from the JWT payload locally via `_extract_user_id()` (no verification — downstream services verify). It forwards the raw `Authorization` header to auth-service and forwards `X-User-Id: <uuid>` to all other internal services.

Redis is used for two purposes only:
- `user_base_currency:<user_id>` — 5-minute TTL cache of each user's base currency (avoids an auth-service call on every transaction write and dashboard load).
- The key is invalidated immediately when `updateProfile` changes `base_currency`.

Base-currency computation for transactions:
- Case A (one side is the base currency): computed synchronously in `_compute_base_currency_fields_case_a()`.
- Case B (neither side is the base currency): async call to rates-service in `_compute_base_currency_fields_case_b()`. If rates-service is unavailable, the transaction still saves without base currency fields — this is a graceful degradation, not an error.

Account balance-in-base-currency resolution uses a two-step priority:
1. Most recent `base_currency_rate` stored on the account's own transactions (via `transactions-service /internal/transactions/latest-rate`).
2. Fall back to rates-service for the currency pair when no stored rate exists.


## Rules and Conventions

**Zero business logic in the BFF.** Resolvers translate GraphQL operations into REST calls and assemble typed responses. Anything beyond translation (validation rules, domain constraints, calculations derived from persisted data) belongs in the downstream service.

The sole exception is base-currency field computation (`_compute_base_currency_fields_case_a/b`): this lives here because it requires combining user context (base currency) with transaction input before the payload is sent to transactions-service.

**No cross-service imports.** Never import code from another service directory. The BFF communicates with downstream services exclusively over HTTP.

**GraphQL contract owns the frontend API surface.** Every field added to a Strawberry type or resolver requires a matching endpoint change in the relevant downstream service. Never add a GraphQL field that the downstream service cannot yet return.

**Only call services relevant to the resolver.** The `dashboard` query is the most complex — it fans out to four services concurrently (`asyncio.gather`). Single-entity queries must call only the service that owns that entity.

**Propagate cookies for auth operations.** The auth-service sets the `refresh_token` HttpOnly cookie. Mutations like `signIn`, `signUp`, `signOut`, `refresh`, and `resetPassword` must forward `Set-Cookie` response headers from auth-service to the browser via `info.context["response"].headers.append(...)`.

**Handle downstream failures gracefully.** Non-critical services (budgets, categories in dashboard context) should degrade silently: log a warning, return partial data, and never surface a 500 to the frontend. Critical services (transactions totals in `dashboard`) return a zeroed summary instead of raising.

**User identity in headers.** Internal service calls use `X-User-Id` (accounts, categories, transactions, budgets). Auth-service calls use the raw `Authorization` header. Never mix the two.

**Async throughout.** All resolvers are `async def`. `httpx.AsyncClient` is used as an async context manager per call. Do not create a shared client instance — the lifespan only initialises Redis.

**Line length:** 100 characters (ruff enforced). Python 3.12+.


## Key Files and Structure

```
services/web-bff/
├── app/
│   ├── main.py          # FastAPI app, lifespan (Redis init/close), GraphQLRouter mount,
│   │                    # get_context() injection, /exchange-rate REST endpoint,
│   │                    # Loguru JSON logging, Sentry init
│   ├── config.py        # Settings (pydantic-settings BaseSettings): all 6 service URLs,
│   │                    # REDIS_URL, SENTRY_DSN — loaded from .env
│   ├── schema.py        # Entire GraphQL contract — ~1900 lines, single file
│   └── routers/
│       └── health.py    # GET /health → {"status": "ok"}
├── Dockerfile           # python:3.12-slim multi-stage; exposes 8001; runs as non-root appuser
└── pyproject.toml       # Dependencies: fastapi, strawberry-graphql[fastapi], httpx,
                         # pydantic-settings, loguru, sentry-sdk[fastapi], redis[asyncio]
```

### schema.py internal organisation

The file is structured in this order:

1. **Helper: `_extract_user_id(authorization)`** — decodes JWT payload without verification to extract the `sub` claim (user UUID).

2. **Output types** (`@strawberry.type`):
   - `User` — auth-service user with `base_currency`
   - `AuthPayload` — access token + User
   - `RefreshPayload` — access token only
   - `Account` — includes optional `balance_in_base_currency` and `base_currency`
   - `Category` — reused for both expense categories and income sources; optional `total`, `monthly_limit`, `budget_percent`
   - `Transaction` — full transaction shape covering expense, income, and transfer legs
   - `DashboardCategoryItem` / `DashboardSummary` — dashboard aggregate types
   - `CurrencyTotal` — per-currency spending breakdown
   - `ExchangeRateResult` — rate lookup result with `stale` flag
   - `DeleteAccountOption` — `@strawberry.enum` with `KEEP_HISTORY` / `DELETE_ALL`

3. **Input types** (`@strawberry.input`):
   - Auth: `SignUpInput`, `SignInInput`, `ResetPasswordInput`, `UpdateProfileInput`, `ChangePasswordInput`
   - Accounts: `CreateAccountInput`, `UpdateAccountInput`
   - Categories: `CreateCategoryInput`, `UpdateCategoryInput`
   - Transactions: `CreateExpenseTransactionInput`, `CreateIncomeTransactionInput`, `CreateTransferTransactionInput`, `UpdateTransactionInput`

4. **Private helpers** (module-level `async def` / `def`):
   - `_to_transaction(t: dict) -> Transaction` — maps raw JSON dict to Transaction type
   - `_adjust_balance(user_id, account_id, delta)` — PATCH accounts-service balance
   - `_get_user_base_currency(user_id, authorization, redis_client)` — Redis-cached base currency
   - `_compute_base_currency_fields_case_a(...)` — synchronous Case A base-currency computation
   - `_compute_base_currency_fields_case_b(...)` — async Case B, calls rates-service
   - `_fetch_account_rate(from_currency, to_currency)` — fetch today's rate from rates-service
   - `_get_account_rate_from_transactions(account_id, base_currency, user_id)` — fetch stored rate from transactions-service

5. **`@strawberry.type class Mutation`** — all write operations:
   - Auth: `signUp`, `signIn`, `signOut`, `refresh`, `forgotPassword`, `resetPassword`, `updateProfile`, `changePassword`, `changeEmail`, `confirmEmailChange`
   - Accounts: `createAccount`, `updateAccount`, `archiveAccount`, `deleteAccount`, `restoreAccount`
   - Categories/Income sources: `createExpenseCategory`, `createIncomeSource`, `updateExpenseCategory`, `updateIncomeSource`, `deleteExpenseCategory`, `deleteIncomeSource`
   - Budget limits: `setExpenseCategoryLimit`
   - Transactions: `createExpenseTransaction`, `createIncomeTransaction`, `createTransferTransaction`, `updateTransaction`, `cancelTransaction`

6. **`@strawberry.type class Query`** — all read operations:
   - `health` — static `"ok"` string
   - `me` — current user from auth-service
   - `accounts` — active accounts with base-currency balance conversion
   - `archivedAccounts` — soft-deleted accounts
   - `expenseCategories` — fan-out to categories + transactions totals + budgets (3 concurrent calls)
   - `incomeSources` — fan-out to categories + transactions totals (2 concurrent calls)
   - `accountTransactions(accountId, limit, offset)` — paginated by account
   - `expenseCategoryTransactions(categoryId, limit, offset)` — paginated by category
   - `incomeSourceTransactions(sourceId, limit, offset)` — paginated by income source
   - `dashboard(year?, month?)` — fan-out to 4 services; computes totals, account balance sum, category breakdown with budget percentages
   - `categoryTotalsByCurrency(categoryId, month)` — per-currency spending for a category
   - `incomeTotalsByCurrency(incomeSourceId, month)` — per-currency income for a source
   - `exchangeRate(from, to, date?)` — proxies rates-service with stale flag

7. **`schema = strawberry.Schema(query=Query, mutation=Mutation)`** — the Strawberry schema instance imported by `main.py`.
