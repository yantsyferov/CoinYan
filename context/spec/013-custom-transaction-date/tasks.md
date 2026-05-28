# Task List: Custom Transaction Date

- **Spec:** `context/spec/013-custom-transaction-date/`
- **Status:** Completed

---

## Slice 1 — DB Migration: add `transaction_date` column

- [x] Add `transaction_date` column (`Date`, not nullable) to the `Transaction` SQLAlchemy model in `services/transactions-service/app/models/transaction.py` **[Agent: python-backend]**
- [x] Write an Alembic migration in `services/transactions-service/alembic/versions/` that adds `transaction_date DATE NOT NULL DEFAULT CURRENT_DATE` and backfills all existing rows from `created_at::date` in a single operation using `server_default` **[Agent: postgres-database]**
- [x] Restart the transactions-service container and verify the migration ran cleanly: connect to `transactions-db` and confirm the column exists and all existing rows have a non-null value **[Agent: qa-testing]**

---

## Slice 2 — Backend REST: accept and return `transaction_date`

- [x] Update `CreateTransactionRequest` in `services/transactions-service/app/schemas/transaction.py`: add `transaction_date: date` with `default_factory=date.today` and a Pydantic validator that rejects any date after today **[Agent: python-backend]**
- [x] Update `CreateTransferTransactionRequest` with the same `transaction_date` field and validator **[Agent: python-backend]**
- [x] Update `UpdateTransactionRequest`: add `transaction_date: date | None = None` with the same future-date validator **[Agent: python-backend]**
- [x] Update `TransactionResponse`: add `transaction_date: date` **[Agent: python-backend]**
- [x] Update `transaction_repo.py` — `create()` and `create_transfer_pair()`: accept and write `transaction_date` to the DB row(s) **[Agent: python-backend]**
- [x] Update `transaction_repo.py` — `update_transaction()` and `update_transfer_pair()`: write `transaction_date` only when explicitly provided (not `None`) **[Agent: python-backend]**
- [x] Update `transactions.py` router: forward `body.transaction_date` in `POST /internal/transactions`, `POST /internal/transactions/transfer`, and `PATCH /internal/transactions/{transaction_id}` **[Agent: python-backend]**
- [x] Verify via curl inside Docker: (a) create an expense with a past date → confirm `transaction_date` appears in response; (b) create an expense with a future date → confirm 422 validation error **[Agent: qa-testing]**

---

## Slice 3 — Backend Semantics: sort and filter by `transaction_date`

- [x] Update `list_by_filter()` in `transaction_repo.py`: change `ORDER BY` from `created_at DESC` to `transaction_date DESC, created_at DESC`; change month-range filter from `created_at` to `transaction_date` **[Agent: python-backend]**
- [x] Update `get_totals()`: switch month-range filter from `created_at` to `transaction_date` **[Agent: python-backend]**
- [x] Update `get_cumulative_balance()`: switch the `date_to` comparison from `created_at` to `transaction_date` **[Agent: python-backend]**
- [x] Verify via curl inside Docker: create one expense with today's date and one with last month's date; query transactions for last month → confirm only the older one appears; query this month → confirm only today's appears **[Agent: qa-testing]**

---

## Slice 4 — BFF GraphQL: expose `transaction_date`

- [x] Add `transaction_date: str | None` to the `Transaction` Strawberry type in `services/web-bff/app/schema.py` **[Agent: python-backend]**
- [x] Add `transaction_date: str | None = None` to `CreateExpenseTransactionInput`, `CreateIncomeTransactionInput`, `CreateTransferTransactionInput`, and `UpdateTransactionInput` **[Agent: python-backend]**
- [x] Update `_to_transaction()` helper: map `transaction_date=t.get("transaction_date")` **[Agent: python-backend]**
- [x] Update all four mutation resolvers (`create_expense_transaction`, `create_income_transaction`, `create_transfer_transaction`, `update_transaction`): include `"transaction_date": input.transaction_date` in the REST payload sent to the transactions-service **[Agent: python-backend]**
- [x] Verify via curl to the BFF GraphQL endpoint: run an `accountTransactions` query and confirm `transactionDate` is present in each returned transaction **[Agent: qa-testing]**

---

## Slice 5 — Frontend Data Layer: types, mutations, history display

- [x] Add `transactionDate?: string | null` to the `Transaction` TypeScript interface in `frontend/src/entities/transaction/model/types.ts` **[Agent: react-frontend]**
- [x] Update all mutation documents in `frontend/src/entities/transaction/api/transactions.mutations.ts`: add `transactionDate` to the variable input type declarations for all create and update mutations; add `transactionDate` to every response selection set **[Agent: react-frontend]**
- [x] Extract a shared `formatDate(iso: string): string` utility to `frontend/src/shared/lib/format-date.ts`, replacing the three inline duplicates **[Agent: react-frontend]**
- [x] Update `AccountDetailPage.tsx`, `ExpenseCategoryDetailPage.tsx`, and `IncomeSourceDetailPage.tsx`: switch date display from `formatDate(txn.createdAt)` to `formatDate(txn.transactionDate ?? txn.createdAt)` **[Agent: react-frontend]**
- [x] Verify in browser: open any account's history page and confirm transaction dates render without error (they reflect `createdAt` for now, since no date picker exists yet) **[Agent: qa-testing]**

---

## Slice 6 — Frontend Create Form: date picker in TransactionModal

- [x] In `frontend/src/features/transaction/TransactionModal.tsx`: add a `date` state variable initialized to today's ISO date (`new Date().toISOString().slice(0, 10)`); render a native `<input type="date">` with `max` set to today's date; include `transactionDate: date` in the `input` object for both the expense and income create mutations **[Agent: react-frontend]**
- [x] Verify in browser: open the create expense/income modal → date field appears pre-filled with today; select a date from last week → save → transaction appears in history with the selected past date displayed; attempting to pick a future date is blocked by the date picker **[Agent: qa-testing]**

---

## Slice 7 — Frontend Edit Form: date picker in EditTransactionDialog

- [x] In `frontend/src/features/transaction/EditTransactionDialog.tsx`: add a `date` state initialized from `transaction.transactionDate ?? transaction.createdAt.slice(0, 10)`; render the same native `<input type="date">` with `max` set to today; include `transactionDate: date` in the `UpdateTransactionInput` **[Agent: react-frontend]**
- [x] Verify in browser: open the edit dialog for an existing transaction → date field shows the current transaction date; change to a different past date → save → the transaction appears with the updated date and in the correct chronological position in the history list **[Agent: qa-testing]**

---

## Slice 8 — E2E Playwright Tests

- [x] Write a Playwright test: create an expense with a date set to 7 days ago → verify the transaction item in the account history displays the correct past date **[Agent: qa-testing]**
- [x] Write a Playwright test: open the create form without changing the date field → save → verify the displayed date equals today **[Agent: qa-testing]**
- [x] Write a Playwright test: edit an existing transaction's date to 14 days ago → verify the displayed date updates and the transaction moves to the correct position in the list **[Agent: qa-testing]**
- [x] Write a Playwright test: open the date picker in the create form → confirm that tomorrow's date and any later date cannot be selected (verify `max` attribute is set to today's date) **[Agent: qa-testing]**
