# Technical Specification: Custom Transaction Date

- **Functional Specification:** `context/spec/013-custom-transaction-date/functional-spec.md`
- **Status:** Completed
- **Author(s):** yantsyferov

---

## 1. High-Level Technical Approach

Three layers require changes in sequence: the **transactions-service** (new DB column, migration, schema, repository, router), the **web-bff** (GraphQL type and all transaction input/output types), and the **React frontend** (date picker in the create and edit forms, updated date display in all history lists).

No new libraries or services are introduced. The native HTML `<input type="date">` control is sufficient for the date picker on the frontend — no third-party date library is needed.

The critical semantic change: all sorting and month-range filtering in the transactions-service switches from the internal record creation timestamp to the user-supplied transaction date. A transaction logged today for last month now appears and counts in last month's totals.

Existing transactions in the database will be backfilled via the Alembic migration: each row receives a `transaction_date` equal to the calendar date of its existing creation timestamp.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Data Model — New Column

**Service:** `transactions-service`  
**Table:** `transactions`

| Column | Type | Constraints | Default |
|---|---|---|---|
| `transaction_date` | `DATE` | `NOT NULL` | `CURRENT_DATE` |

The column stores only the calendar date (no time, no timezone). It is user-controlled and semantically separate from `created_at`, which remains as an immutable audit timestamp.

Both legs of a transfer pair receive the same `transaction_date`.

### 2.2 Alembic Migration

**Location:** `services/transactions-service/alembic/versions/`

One new migration file performs two operations in order:
1. Add `transaction_date DATE` with a `server_default` of `CURRENT_DATE` — this allows Postgres to backfill all existing rows in a single pass without a separate `UPDATE`.
2. After the column exists, confirm it is `NOT NULL` (the `server_default` satisfies this for all pre-existing rows).

No manual `UPDATE` statement is needed. The backfill approach ensures existing transactions get the calendar date of when they were originally created, which is correct.

### 2.3 Pydantic Schemas — transactions-service

**File:** `services/transactions-service/app/schemas/transaction.py`

| Schema | Change |
|---|---|
| `CreateTransactionRequest` | Add `transaction_date: date` with `default_factory=date.today` and a validator rejecting dates after today |
| `CreateTransferTransactionRequest` | Same `transaction_date` field |
| `UpdateTransactionRequest` | Add `transaction_date: date \| None = None`; if provided, same future-date validator applies |
| `TransactionResponse` | Add `transaction_date: date` |

The future-date validator is a Pydantic field validator: if `transaction_date > date.today()`, raise a `ValueError`. This is the authoritative server-side guard.

### 2.4 Repository — transactions-service

**File:** `services/transactions-service/app/repositories/transaction_repo.py`

| Method | Change |
|---|---|
| `create()` | Accept and write `transaction_date` to the new column |
| `create_transfer_pair()` | Accept and write `transaction_date` to both transaction rows |
| `list_by_filter()` | Switch month-range filter from `created_at` to `transaction_date`; change `ORDER BY` from `created_at DESC` to `transaction_date DESC, created_at DESC` (secondary sort preserves stable ordering for same-day entries) |
| `get_totals()` | Switch month-range filter from `created_at` to `transaction_date` |
| `get_cumulative_balance()` | Switch `date_to` comparison from `created_at` to `transaction_date` |
| `update_transaction()` | If `transaction_date` is present in the update payload, write it |
| `update_transfer_pair()` | Same — update `transaction_date` on both legs |

### 2.5 Router — transactions-service

**File:** `services/transactions-service/app/routers/transactions.py`

| Endpoint | Change |
|---|---|
| `POST /internal/transactions` | Forward `body.transaction_date` to the repo `create()` call |
| `POST /internal/transactions/transfer` | Forward `body.transaction_date` to `create_transfer_pair()` |
| `PATCH /internal/transactions/{transaction_id}` | Forward `body.transaction_date` (optional) to `update_transaction()` / `update_transfer_pair()` |

No new endpoints. No changes to query parameter endpoints (`GET /internal/transactions`, `/balance`, `/totals`).

### 2.6 Web BFF — GraphQL Schema

**File:** `services/web-bff/app/schema.py`

**`Transaction` output type:**

| Field | Type | Notes |
|---|---|---|
| `transaction_date` | `str \| None` | ISO date string, e.g. `"2026-05-20"` |

**Input types — add `transaction_date: str | None = None` to each:**

- `CreateExpenseTransactionInput`
- `CreateIncomeTransactionInput`
- `CreateTransferTransactionInput`
- `UpdateTransactionInput`

**`_to_transaction()` helper:** Add `transaction_date=t.get("transaction_date")` to the mapping.

**Mutations — forward to transactions-service REST payload:**

- `create_expense_transaction`: include `"transaction_date": input.transaction_date`
- `create_income_transaction`: include `"transaction_date": input.transaction_date`
- `create_transfer_transaction`: include `"transaction_date": input.transaction_date`
- `update_transaction`: include `"transaction_date": input.transaction_date`

### 2.7 Frontend — TypeScript Types

**File:** `frontend/src/entities/transaction/model/types.ts`

Add `transactionDate?: string | null` to the `Transaction` interface. The `createdAt` field is retained as-is (immutable audit timestamp, still returned by the BFF).

### 2.8 Frontend — GraphQL Mutations

**File:** `frontend/src/entities/transaction/api/transactions.mutations.ts`

For all four create mutations and the update mutation:
- Add `transactionDate` to the GraphQL variable `input` type declarations.
- Add `transactionDate` to the response selection set so Apollo Client caches the field.

### 2.9 Frontend — Transaction Creation Form

**File:** `frontend/src/features/transaction/TransactionModal.tsx`

- Add a `date` state variable, initialized to today in `YYYY-MM-DD` format: `new Date().toISOString().slice(0, 10)`.
- Render a native `<input type="date">` field. Set `max` attribute to today's date (same `YYYY-MM-DD` string) — this grays out and disables future dates in the browser's native picker without any custom library.
- Include `transactionDate: date` in both the expense and income mutation `input` objects.

### 2.10 Frontend — Transaction Edit Form

**File:** `frontend/src/features/transaction/EditTransactionDialog.tsx`

- Add a `date` state initialized from `transaction.transactionDate ?? transaction.createdAt.slice(0, 10)`.
- Render the same native `<input type="date">` with `max` set to today.
- Include `transactionDate: date` in the `UpdateTransactionInput`.

### 2.11 Frontend — Transaction History Display

**Files:** `frontend/src/pages/accounts/AccountDetailPage.tsx`, `frontend/src/pages/categories/ExpenseCategoryDetailPage.tsx`, `frontend/src/pages/categories/IncomeSourceDetailPage.tsx`

All three pages currently call a local `formatDate(txn.createdAt)`. Change each call to `formatDate(txn.transactionDate ?? txn.createdAt)` so user-set dates are shown.

Optionally, extract the shared `formatDate` function to `frontend/src/shared/lib/format-date.ts` to eliminate the three-way duplication. This is clean-up within scope of this change.

---

## 3. Impact and Risk Analysis

**System Dependencies:**
- The `transactions-service` is called by the `web-bff`, the `reports-service` (Phase 4), and the `budgets-service`. The month-range semantic change (using `transaction_date` instead of `created_at`) affects totals computed by the BFF dashboard mutations. This is the intended behavior — the dashboard totals should reflect the date of the transaction, not the entry date.
- The `accounts-service` is not affected: balance changes are triggered by transaction creation/cancellation, not by the transaction date.

**Potential Risks & Mitigations:**

| Risk | Mitigation |
|---|---|
| A browser that doesn't fully support `<input type="date">` still allows future dates | The backend validator on `transaction_date` is the authoritative guard — the frontend `max` attribute is a UX convenience only |
| Both legs of a transfer pair must share the same `transaction_date` | Enforced in `create_transfer_pair()` — a single `transaction_date` value is written to both rows |
| Changing sort/filter from `created_at` to `transaction_date` changes month totals for previously logged transactions | Backfill uses `created_at::date`, so existing transactions are unaffected in practice |
| If a user updates only the amount (not the date) on an existing transaction, `transaction_date` must not be accidentally cleared | `UpdateTransactionRequest.transaction_date` is `None` by default — the repository only updates the column if the value is explicitly provided, not `None` |

---

## 4. Testing Strategy

**Backend (pytest — transactions-service):**
- Unit tests for the `transaction_date` Pydantic validator: today is accepted, past dates are accepted, tomorrow and further future dates are rejected.
- Integration tests for `POST /internal/transactions`: verify `transaction_date` is persisted correctly and returned in the response.
- Integration tests for `GET /internal/transactions`: verify that a transaction with `transaction_date` in a prior month appears in that month's results (not the current month), confirming the semantic switch.
- Integration tests for `PATCH /internal/transactions/{id}`: verify `transaction_date` updates correctly; verify that omitting `transaction_date` from the payload leaves the existing value unchanged.
- Alembic migration test: verify the migration runs cleanly and existing rows receive `transaction_date = created_at::date`.

**Frontend (Playwright E2E):**
- Creating an expense with a past date: verify the transaction appears with the correct date displayed in the account history.
- Creating a transaction without changing the date field: verify it defaults to today.
- Editing an existing transaction's date: verify the new date is shown after saving and the list re-orders correctly.
- Attempting to select a future date: verify future dates are not selectable in the date picker (the `max` attribute is present).
