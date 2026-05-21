# Task List: Accounts & Wallets

- **Spec:** `context/spec/002-accounts-and-wallets/`
- **Approach:** Each slice is a complete vertical cut — runnable and testable before moving to the next.

---

## Slice 1: Infrastructure — `accounts-service` Starts Up

*Goal: `docker-compose up` brings up `accounts-service` (port 8002) and `accounts-db` without errors; `GET /health` returns `{"status": "ok"}` and the Alembic migration creates the `accounts` table.*

- [x] Add `accounts-db` (PostgreSQL, port 5433) and `accounts-service` (port 8002, built from `services/accounts-service/Dockerfile`) containers to `docker-compose.yml`; both join the existing `coinyan-net` bridge network; add `ACCOUNTS_SERVICE_URL=http://accounts-service:8002` env var to the `web-bff` service **[Agent: devops-infra]**
- [x] Scaffold `accounts-service`: FastAPI app with `GET /health` returning `{"status": "ok"}`, Pydantic `BaseSettings` config (`DATABASE_URL`, `DEFAULT_ACCOUNT_CURRENCY`, `SENTRY_DSN`), Loguru structured JSON logging, and a multi-stage `Dockerfile` (non-root user) — matching the `auth-service` pattern **[Agent: python-backend]**
- [x] Create the initial Alembic migration for `accounts-db` — `accounts` table with all columns from tech spec section 2.1: `id` (UUID PK), `user_id` (UUID, NOT NULL), `name` (TEXT, NOT NULL), `icon` (VARCHAR 50, NOT NULL), `currency` (VARCHAR 10, NOT NULL), `starting_balance` (NUMERIC 18,4, DEFAULT 0), `current_balance` (NUMERIC 18,4, DEFAULT 0), `status` (VARCHAR 30, DEFAULT 'active'), `deleted_at` (TIMESTAMPTZ, NULLABLE), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ); add indexes on `(user_id, status)` and `(user_id, deleted_at)` **[Agent: postgres-database]**
- [x] Add `ACCOUNTS_SERVICE_URL: str` to `web-bff/app/config.py` (matching the existing `Settings` BaseSettings pattern) **[Agent: python-backend]**
- [x] Verify: Run `docker-compose up --build`. Confirm `GET http://localhost:8002/health` returns `{"status": "ok"}`. Check `docker logs coinyan-accounts-service-1` to confirm the Alembic migration ran and created the `accounts` table without errors. **[Agent: devops-infra]**

---

## Slice 2: Accounts List — See Default Cash Account

*Goal: A signed-in user navigates to `/accounts` and sees a Cash account circle with balance 0. The Cash account is created automatically if it doesn't exist yet.*

- [x] Implement the `Account` SQLAlchemy ORM model in `accounts-service/app/models/account.py` mirroring the `accounts` table schema **[Agent: postgres-database]**
- [x] Implement `AccountRepository` in `accounts-service/app/repositories/account_repo.py` with async methods: `get_active_by_user_id(user_id)`, `create(user_id, name, icon, currency, starting_balance)` **[Agent: python-backend]**
- [x] Implement `AccountService.get_or_seed_accounts(user_id, session)` in `accounts-service/app/services/account_service.py`: calls `get_active_by_user_id`; if the result is empty, inserts a Cash account (`name="Cash"`, `icon="cash"`, `currency=settings.DEFAULT_ACCOUNT_CURRENCY`, `starting_balance=0`) using `INSERT ... ON CONFLICT DO NOTHING` to prevent duplicate seeds, then re-fetches; returns the list **[Agent: python-backend]**
- [x] Implement `GET /internal/accounts` in `accounts-service/app/routers/accounts.py`: reads `X-User-Id` from the request header via a `get_user_id` FastAPI dependency; calls `AccountService.get_or_seed_accounts`; returns the account list **[Agent: python-backend]**
- [x] Add `Account` Strawberry type (`id`, `name`, `icon`, `currency`, `currentBalance`, `status`, `deletedAt`, `createdAt`) and `accounts: [Account!]!` query resolver to the BFF schema in `web-bff/app/schema.py`; the resolver extracts `user_id` from the JWT Bearer token, sets `X-User-Id` header, and GETs `{ACCOUNTS_SERVICE_URL}/internal/accounts` **[Agent: python-backend]**
- [x] Create `entities/account` in the frontend: `Account` TypeScript type and `useAccounts` Apollo hook wrapping the `accounts` query **[Agent: react-frontend]**
- [x] Create `shared/lib/account-icons` in the frontend: a static map of icon keys to icon components/SVGs covering at least: `cash`, `card`, `savings`, `wallet`, `bank`, `piggybank` **[Agent: react-frontend]**
- [x] Build `AccountsPage` (`/accounts` route, protected) in `pages/accounts/AccountsPage.tsx`: horizontally scrollable row of account circles (72 px, icon centered, account name truncated and formatted balance below each); shows a `+` circle at the end; uses the `useAccounts` hook **[Agent: react-frontend]**
- [x] Add `/accounts` to `App.tsx` as a protected route; add a navigation link to `/accounts` from the home (`/`) placeholder page **[Agent: react-frontend]**
- [x] Verify: Sign in with a valid account. Navigate to `http://localhost:5173/accounts`. Confirm the Cash account circle is visible with name "Cash" and balance "0.00". Confirm the `+` circle appears to the right of Cash. Open a new browser tab, navigate directly to `/accounts` without signing in, and confirm a redirect to `/sign-in`. **[Agent: react-frontend]**

---

## Slice 3: Create a New Account

*Goal: A user taps `+` and creates a new account with a name, icon, currency, and optional starting balance; it appears in the list immediately with the correct balance.*

- [x] Add `VALID_CURRENCIES` (set of ISO 4217 three-letter codes) and `VALID_ICONS` (set of allowed icon keys) constants to `accounts-service/app/core/constants.py` **[Agent: python-backend]**
- [x] Implement `POST /internal/accounts` in `accounts-service`: Pydantic v2 schema validation — `name` required and non-empty, `icon` must be in `VALID_ICONS`, `currency` must be in `VALID_CURRENCIES`, `starting_balance` optional (defaults to 0, must be ≥ 0); creates the account row with `current_balance = starting_balance`; returns the created account **[Agent: python-backend]**
- [x] Add `CreateAccountInput` input type and `createAccount(input: CreateAccountInput!): Account!` mutation resolver to the BFF Strawberry schema; resolver POSTs to `{ACCOUNTS_SERVICE_URL}/internal/accounts` with the `X-User-Id` header **[Agent: python-backend]**
- [x] Create `shared/lib/currencies` in the frontend: a static array of `{code: string, name: string}` objects for all ISO 4217 currencies, used by the searchable dropdown **[Agent: react-frontend]**
- [x] Build `features/account/create-account` in the frontend: a modal/bottom-sheet triggered by the `+` circle; form fields — name text input, icon picker grid (icons from `shared/lib/account-icons`), currency searchable dropdown (from `shared/lib/currencies`), optional starting balance numeric input; name and currency are required; calls `createAccount` Apollo mutation on submit; appends the new account to the list (Apollo cache update) and closes the modal on success **[Agent: react-frontend]**
- [x] Verify: On the accounts page, tap `+`. Fill in name "Main Card", select the card icon, choose "EUR" currency, enter starting balance "1500". Save. Confirm the "Main Card" circle appears in the row showing "€1,500.00" (or "1,500.00 EUR"). Attempt to save without entering a name — confirm a validation error appears. Attempt to save without selecting a currency — confirm a validation error appears. **[Agent: react-frontend]**

---

## Slice 4: Edit an Account (Name and Icon)

*Goal: A user taps an existing account and can change its name and icon; updates are reflected immediately. The currency field is visible but cannot be changed.*

- [x] Implement `GET /internal/accounts/{account_id}` in `accounts-service`: returns the account if owned by the requesting user; returns 404 if not found or owned by a different user **[Agent: python-backend]**
- [x] Implement `PATCH /internal/accounts/{account_id}` in `accounts-service`: validates `name` is non-empty; validates `icon` is in `VALID_ICONS`; updates only `name` and `icon` (currency and balance fields are ignored); returns the updated account **[Agent: python-backend]**
- [x] Add `UpdateAccountInput` input type and `updateAccount(id: ID!, input: UpdateAccountInput!): Account!` mutation to the BFF Strawberry schema **[Agent: python-backend]**
- [x] Build `features/account/edit-account` in the frontend: tapping an account circle opens an edit modal pre-filled with the current name and icon; the currency field is displayed as read-only text (not an input); calls `updateAccount` mutation on save; updates the circle's name and icon in the Apollo cache immediately on success; shows a validation error if the name is cleared **[Agent: react-frontend]**
- [x] Verify: Tap the Cash account circle. Change the name to "Spending Wallet" and select a different icon. Save. Confirm the circle now shows "Spending Wallet" with the new icon. Open the edit modal again and confirm the currency field (e.g. "USD") is visible but cannot be interacted with. **[Agent: react-frontend]**

---

## Slice 5: Archive, Delete, and Restore Accounts

*Goal: A user can archive an account (removed from active list but recoverable), delete it with two history options, and restore any deleted/archived account within 30 days. "Delete everything" requires double confirmation and shows a red warning.*

- [x] Implement `POST /internal/accounts/{account_id}/archive` in `accounts-service`: sets `status = 'archived'` and `deleted_at = now()` on the account row; returns 404 if not found or not owned by the user **[Agent: python-backend]**
- [x] Implement `POST /internal/accounts/{account_id}/delete` in `accounts-service`: accepts body `{option: "keep_history" | "delete_all"}`; sets the corresponding status (`'deleted_keep_history'` or `'deleted_all'`) and `deleted_at = now()`; returns 404 if not found or not owned **[Agent: python-backend]**
- [x] Implement `GET /internal/accounts/archived` in `accounts-service`: returns accounts for the user where `status != 'active'` AND `deleted_at + INTERVAL '30 days' >= now()`; ordered by `deleted_at DESC` **[Agent: python-backend]**
- [x] Implement `POST /internal/accounts/{account_id}/restore` in `accounts-service`: checks that the 30-day window has not elapsed — returns 409 with a clear message if it has; otherwise sets `status = 'active'`, clears `deleted_at`; returns the restored account **[Agent: python-backend]**
- [x] Implement `PATCH /internal/accounts/{account_id}/balance` in `accounts-service`: accepts `{delta: Decimal}`; executes atomic `current_balance = current_balance + :delta`; returns the updated account (this endpoint will be used by Phase 2 transactions) **[Agent: python-backend]**
- [x] Register a daily background cleanup task in the `accounts-service` FastAPI lifespan: an `asyncio.create_task` wrapping a loop that sleeps 24 hours then runs `DELETE FROM accounts WHERE status != 'active' AND deleted_at + INTERVAL '30 days' < now()` **[Agent: python-backend]**
- [x] Add the following to the BFF Strawberry schema: `DeleteAccountOption` enum (`KEEP_HISTORY`, `DELETE_ALL`), `archiveAccount(id: ID!): Boolean!` mutation, `deleteAccount(id: ID!, option: DeleteAccountOption!): Boolean!` mutation, `restoreAccount(id: ID!): Account!` mutation, `archivedAccounts: [Account!]!` query — all forwarding to the corresponding `accounts-service` endpoints with `X-User-Id` header **[Agent: python-backend]**
- [x] Build `features/account/delete-account` in the frontend: tapping an account circle shows a menu (accessible via a long-press or a context button) with three options — "Archive", "Delete, keep history", "Delete everything" (last, styled in red); selecting "Delete everything" opens a second confirmation dialog with a red destructive-action button and the warning text from the functional spec; each confirmed action calls the appropriate mutation and removes the account from the active Apollo cache **[Agent: react-frontend]**
- [x] Build an archived accounts section in the frontend (e.g. a link/button "Archived" on the accounts page navigating to `/accounts/archived`): lists accounts from the `archivedAccounts` query showing the account name, icon, status label, and days remaining in the recovery window; each row has a "Restore" button that calls `restoreAccount` and moves the account back to the active list **[Agent: react-frontend]**
- [x] Verify: Create a "Test Card" account. Tap it and choose "Archive" — confirm it disappears from the active list. Navigate to the archived section and confirm "Test Card" appears there with a restore button. Click "Restore" — confirm it reappears in the active list. Create another account "To Delete". Tap it, choose "Delete everything" — confirm the second red confirmation dialog appears. Confirm deletion — confirm "To Delete" is removed from the active list. Navigate to archived and confirm "To Delete" does NOT appear there (it was a delete_all, status = deleted_all, still visible in archived for restore). Actually it should appear in archived — it has a 30-day window. Confirm it appears in the archived list with status "Deleted" and a restore option. **[Agent: react-frontend]**
