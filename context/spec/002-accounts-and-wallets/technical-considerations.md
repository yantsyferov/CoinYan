# Technical Specification: Accounts & Wallets

- **Functional Specification:** `context/spec/002-accounts-and-wallets/functional-spec.md`
- **Status:** Completed
- **Author(s):** CoinYan Team

---

## 1. High-Level Technical Approach

This feature introduces `accounts-service` — a new standalone FastAPI microservice with its own dedicated PostgreSQL database (`accounts-db`). It owns the complete lifecycle of a user's financial accounts: creation, editing, soft-deletion with a 30-day recovery window, and balance management.

The **Web BFF** gains a new set of GraphQL queries and mutations that translate frontend requests into REST calls against `accounts-service`. The user's identity is established by forwarding the JWT access token from the browser through the BFF to the service.

Balances are stored as a **denormalized `current_balance` column** on the account row, updated atomically via SQL `current_balance = current_balance + :delta`. In Phase 2 (transactions), the BFF will call a balance-adjustment endpoint on `accounts-service` whenever a transaction is created, edited, or deleted.

Default Cash account seeding happens lazily: when a user first fetches their accounts list and no accounts exist, `accounts-service` auto-creates the Cash account before returning.

**Systems affected:** `accounts-service` (new), `accounts-db` (new PostgreSQL database), `web-bff` (new GraphQL schema additions), `docker-compose.yml` (new containers), React frontend (new accounts screen and components).

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Data Model — `accounts-db`

**Table: `accounts`**

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | Unique account identifier |
| `user_id` | UUID | NOT NULL, indexed | Owning user (trusted from BFF; no FK to auth-db) |
| `name` | TEXT | NOT NULL | User-given label (e.g. "Main Card") |
| `icon` | VARCHAR(50) | NOT NULL | Icon key from predefined frontend library |
| `currency` | VARCHAR(10) | NOT NULL | ISO 4217 code — locked after creation |
| `starting_balance` | NUMERIC(18,4) | NOT NULL, DEFAULT 0 | Balance at the time the account was added |
| `current_balance` | NUMERIC(18,4) | NOT NULL, DEFAULT 0 | Denormalized live balance; equals `starting_balance` until transactions are logged |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'active' | `'active'` / `'archived'` / `'deleted_keep_history'` / `'deleted_all'` |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Set when any deletion or archival is initiated; NULL for active accounts |
| `created_at` | TIMESTAMPTZ | NOT NULL | Set on insert |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated on every modification |

Indexes:
- `(user_id, status)` — primary query pattern for the accounts list
- `(user_id, deleted_at)` — recovery window queries

Managed via SQLAlchemy async ORM + Alembic migrations.

---

### 2.2 Balance Calculation Strategy

`current_balance` is a **denormalized column** updated via an atomic SQL delta operation:

```
UPDATE accounts SET current_balance = current_balance + :delta, updated_at = now() WHERE id = :id
```

A positive `delta` represents credit (income, transfer-in); a negative `delta` represents debit (expense, transfer-out). Atomic SQL arithmetic prevents double-spend without application-level locking.

In Phase 1, `current_balance` equals `starting_balance` (no transactions yet). In Phase 2, the BFF will call `PATCH /internal/accounts/{id}/balance` after recording each transaction in `transactions-service`.

---

### 2.3 30-Day Recovery Implementation

Soft-deletion is tracked via the `status` and `deleted_at` columns:

- **Archive:** `status = 'archived'`, `deleted_at = now()`
- **Delete, keep history:** `status = 'deleted_keep_history'`, `deleted_at = now()`
- **Delete everything:** `status = 'deleted_all'`, `deleted_at = now()`

Recovery is available for 30 days: `deleted_at + INTERVAL '30 days' >= now()`.

A **daily background cleanup task** (registered in the FastAPI lifespan via `asyncio.create_task` with a 24-hour sleep loop) permanently removes rows where `status != 'active'` AND `deleted_at + INTERVAL '30 days' < now()`. For `'deleted_all'`, the cleanup also marks linked transactions as orphaned in Phase 2; in Phase 1 it simply deletes the row.

The active accounts list (`GET /`) filters for `status = 'active'` only. The recovery list (`GET /archived`) returns accounts where `status != 'active'` AND the 30-day window has not elapsed, ordered by `deleted_at DESC`.

---

### 2.4 Default Cash Account Seeding

When `GET /internal/accounts` is called for a user that has zero active accounts, `accounts-service` inserts a Cash account before returning:

- `name: "Cash"`, `icon: "cash"`, `currency: DEFAULT_ACCOUNT_CURRENCY` (env var, default `"USD"`), `starting_balance: 0`

This is idempotent (no accounts → create one → return). The user can edit the name and icon but cannot change the currency (consistent with all accounts). Currency selection during onboarding is a future improvement.

---

### 2.5 `accounts-service` Internal REST API

All routes are prefixed `/internal/accounts` and are not publicly exposed — only the BFF can reach them.

**Request authentication:** The BFF extracts `user_id` from the validated JWT access token and passes it as a trusted header (`X-User-Id`). `accounts-service` reads `X-User-Id` from the request header; it does not re-validate JWTs (trusts the BFF as a gateway).

| Method | Path | Request Body / Params | Response | Notes |
|---|---|---|---|---|
| `GET` | `/` | `X-User-Id` header | `[Account]` | Returns active accounts; seeds Cash if empty |
| `POST` | `/` | `{name, icon, currency, starting_balance?}` | `Account` | Creates account; validates currency code |
| `GET` | `/{account_id}` | — | `Account` | Returns account; 404 if not owned by user |
| `PATCH` | `/{account_id}` | `{name, icon}` | `Account` | Updates name and icon only; 400 if other fields sent |
| `PATCH` | `/{account_id}/balance` | `{delta: Decimal}` | `Account` | Atomic balance update; called by BFF in Phase 2 |
| `POST` | `/{account_id}/archive` | — | `204` | Sets status to `'archived'` |
| `POST` | `/{account_id}/delete` | `{option: "keep_history" \| "delete_all"}` | `204` | Soft-deletes the account |
| `POST` | `/{account_id}/restore` | — | `Account` | Restores if within 30-day window; 409 if expired |
| `GET` | `/archived` | `X-User-Id` header | `[Account]` | Lists recoverable accounts |

---

### 2.6 Web BFF — GraphQL Schema Additions

**New Types:**

```graphql
type Account {
  id: ID!
  name: String!
  icon: String!
  currency: String!
  currentBalance: Float!
  status: AccountStatus!
  deletedAt: String
  createdAt: String!
}

enum AccountStatus {
  ACTIVE
  ARCHIVED
  DELETED_KEEP_HISTORY
  DELETED_ALL
}

enum DeleteAccountOption {
  KEEP_HISTORY
  DELETE_ALL
}

input CreateAccountInput {
  name: String!
  icon: String!
  currency: String!
  startingBalance: Float
}

input UpdateAccountInput {
  name: String!
  icon: String!
}
```

**New Queries:**

```graphql
accounts: [Account!]!
archivedAccounts: [Account!]!
```

**New Mutations:**

```graphql
createAccount(input: CreateAccountInput!): Account!
updateAccount(id: ID!, input: UpdateAccountInput!): Account!
archiveAccount(id: ID!): Boolean!
deleteAccount(id: ID!, option: DeleteAccountOption!): Boolean!
restoreAccount(id: ID!): Account!
```

All resolvers extract `user_id` from the Bearer token (via the existing `get_current_user_id` pattern from auth-service), set `X-User-Id` header, and forward the call to `accounts-service`.

---

### 2.7 Frontend Structure (FSD)

**New Route:**

| Route | Page | Auth required |
|---|---|---|
| `/accounts` | `AccountsPage` | Yes |

**FSD layers:**

- `entities/account` — `Account` TypeScript type; `useAccounts` hook (Apollo `accounts` query); `useArchivedAccounts` hook
- `features/account/create-account` — "Add account" button + modal form (name, icon picker, currency search, starting balance); calls `createAccount` mutation; adds to accounts list on success
- `features/account/edit-account` — edit modal (name + icon only, currency shown as read-only); calls `updateAccount` mutation
- `features/account/delete-account` — deletion bottom sheet with 3 options; "Delete everything" shown last in red with a second confirmation dialog; calls `archiveAccount`, `deleteAccount` (keep history), or `deleteAccount` (delete all)
- `features/account/restore-account` — restore flow from the archived section
- `pages/accounts/AccountsPage` — horizontal scroll row of circles; each circle shows the icon; name and current balance appear beneath; "+" button to add a new account; link to archived accounts section
- `shared/lib/currencies` — static list of ISO 4217 currency codes with names, used for the searchable dropdown
- `shared/lib/account-icons` — static map of icon keys to icon components (predefined library)

**Account circle display:**
- Fixed-size circle (e.g. 72px) containing the icon centred
- Account name (truncated) and formatted balance (e.g. `$1,200.00`) displayed below each circle
- Row is horizontally scrollable with a "+" circle appended at the end

**Icon library (Phase 1):** A small static set of named icons covering common account types (cash, card, savings, wallet, bank, piggybank, etc.). Icon keys are plain strings stored in the database. The frontend maps keys to visual icon components. No AI generation in Phase 1.

**Currency validation:** ISO 4217 three-letter codes. The frontend uses a local static list for the searchable picker. `accounts-service` validates the submitted code against the same list (imported as a Python constant) and returns 422 if invalid.

---

### 2.8 `accounts-service` Project Structure

```
accounts-service/
├── app/
│   ├── main.py               # FastAPI app, router registration, lifespan (cleanup task)
│   ├── config.py             # Pydantic BaseSettings (env vars)
│   ├── routers/
│   │   ├── accounts.py       # All /internal/accounts/* endpoints
│   │   └── health.py         # GET /health
│   ├── services/
│   │   └── account_service.py  # Business logic: create, edit, delete, restore, seed
│   ├── repositories/
│   │   └── account_repo.py   # Async SQLAlchemy queries for Account
│   ├── models/
│   │   └── account.py        # SQLAlchemy Account ORM model
│   ├── schemas/
│   │   └── account.py        # Pydantic v2 request/response models
│   └── core/
│       ├── constants.py      # VALID_CURRENCIES set, VALID_ICONS set, DEFAULT_CURRENCY
│       └── dependencies.py   # get_db, get_user_id (reads X-User-Id header)
├── alembic/
│   └── versions/             # Migration scripts
├── Dockerfile
└── pyproject.toml
```

**Required environment variables:**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Async PostgreSQL connection string for accounts-db |
| `SENTRY_DSN` | Optional Sentry error tracking DSN |
| `DEFAULT_ACCOUNT_CURRENCY` | ISO code for the auto-created Cash account (default: `USD`) |

No Redis dependency in Phase 1. Redis may be added in Phase 2 for caching balance aggregations.

---

### 2.9 Infrastructure Changes

**`docker-compose.yml` additions:**
- `accounts-service` container (port `8002`), built from `services/accounts-service/Dockerfile`
- `accounts-db` PostgreSQL container (port `5433`) with its own named volume
- `web-bff` environment: add `ACCOUNTS_SERVICE_URL=http://accounts-service:8002`
- Network: both new containers join the existing `coinyan-net` bridge network

**`web-bff` config addition:**
- `ACCOUNTS_SERVICE_URL` env var pointing to the accounts-service internal URL

---

## 3. Impact and Risk Analysis

**System Dependencies:**

- `accounts-db` (PostgreSQL) must be provisioned and migrated before `accounts-service` starts
- `web-bff` depends on `accounts-service` being reachable; GraphQL resolvers for accounts will return service-unavailable errors if `accounts-service` is down
- In Phase 2, `transactions-service` will call `accounts-service` (via BFF coordination) to adjust balances — introducing a cross-service choreography dependency

**Potential Risks & Mitigations:**

| Risk | Mitigation |
|---|---|
| Balance drift if BFF crashes mid-mutation (after creating a transaction but before adjusting balance) | In Phase 2, design the BFF to call balance adjustment first, then record the transaction — or implement idempotency keys. Acceptable for Phase 1 where no transactions exist. |
| Two concurrent BFF calls adjusting the same account balance simultaneously | Atomic SQL (`current_balance = current_balance + :delta`) prevents lost updates without application locking. |
| Restore attempted after 30-day window | `POST /{account_id}/restore` checks `deleted_at + INTERVAL '30 days' >= now()` and returns 409 with a clear message if the window has passed. |
| Cash account seeded with wrong currency for non-USD users | Acceptable for Phase 1; log a warning and note it as a future UX improvement (currency preference at sign-up). |
| `deleted_all` cleanup in Phase 2 must also remove linked transactions | Keep a record of `deleted_all` account IDs post-30-days for Phase 2 reconciliation. Cleanup job in Phase 1 simply deletes the account row. |
| Icon or currency key in database becomes invalid after frontend library changes | `accounts-service` validates on write only; existing stored keys are trusted on read. Document this invariant in constants. |

---

## 4. Testing Strategy

- **Unit tests (pytest):** `account_service.py` logic (seeding, soft-delete state transitions, balance delta math) with mocked repository; Pydantic schema validation (empty name, invalid currency code, invalid icon key, negative balance)
- **Integration tests (pytest + testcontainers):** Full account create → list → edit → archive → restore flow against a real PostgreSQL instance; 30-day window enforcement (mock `datetime.now` to advance time); balance delta atomic update under concurrent requests; duplicate seeding prevention (two simultaneous empty-list calls must not create two Cash accounts — use `INSERT ... ON CONFLICT DO NOTHING`)
- **Frontend tests (Vitest + React Testing Library):** Account circle rendering with correct name and balance; create-account form validation (empty name, no currency selected); delete flow step rendering (3 options, second confirmation for "Delete everything"); restore flow from archived list
- **End-to-end (Playwright, future):** Full flow: sign in → see Cash account → add new account → edit name/icon → archive → restore golden path
