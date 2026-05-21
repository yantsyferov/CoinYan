# Technical Specification: Account Transfers

- **Functional Specification:** `context/spec/005-account-transfers/functional-spec.md`
- **Status:** Completed

---

## 1. High-Level Technical Approach

The feature spans 4 layers:

1. **transactions-service** — add `transfer` type, two new columns, new endpoints (create pair / delete)
2. **accounts-service** — no schema changes; existing `PATCH /balance` endpoint is reused
3. **web-bff** — new GraphQL mutations `createTransferTransaction` and `cancelTransaction`
4. **React frontend** — install `@dnd-kit`, add drag handler branch, create `TransferModal`

A transfer is stored as a **pair of linked transactions**: a debit leg (`account_id = from`) and a credit leg (`account_id = to`). Each row references the other via `transfer_peer_id`. This allows the transfer to appear in both accounts' histories without duplicating business logic.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Database — transactions-service

**Alembic migration (new file):**

| Change | Description |
|---|---|
| Drop `chk_transaction_type` | Existing CHECK only allows `income`/`expense` |
| Create new CHECK | Add branch: `(type='transfer' AND expense_category_id IS NULL AND income_source_id IS NULL)` |
| New column `transfer_to_account_id` | `UUID NULLABLE` — destination account ID |
| New column `transfer_peer_id` | `UUID NULLABLE` — ID of the paired transaction leg |
| Index on `transfer_peer_id` | Fast lookup for cancellation |

**Model** — add two nullable mapped columns to `Transaction`.

---

### 2.2 API — transactions-service

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/internal/transactions/transfer` | Create transfer pair (both legs) inside a single DB transaction. Body: `from_account_id`, `to_account_id`, `from_amount`, `to_amount`, `exchange_rate`, `note?` |
| `DELETE` | `/internal/transactions/{id}` | Delete a transaction. For `type=transfer`: find and delete both legs via `transfer_peer_id`, return amounts for balance reversal |

**Repository changes:**
- `create_transfer_pair()` — two INSERTs in a single `session.flush()`, then update `transfer_peer_id` on both rows, `session.commit()`
- `delete_transfer_pair()` — find both legs, delete, return `{from_amount, to_amount}` for reversal

**Schemas:**
- Add `CreateTransferTransactionRequest` with validation that `from_account_id != to_account_id`
- Extend `TransactionResponse` with `transfer_to_account_id`, `transfer_peer_id`, and `from_account_id`
- Relax `type` literal to `Literal["expense", "income", "transfer"]`

**`from_account_id` column (additional Alembic migration):**

Both legs of the transfer store `from_account_id = sender's account_id`. This allows the frontend to determine transfer direction without ambiguity:
- Debit leg: `account_id == from_account_id` (sender)
- Credit leg: `account_id != from_account_id` (receiver); `transfer_to_account_id == account_id` (receiver = destination)

---

### 2.3 API — web-bff (GraphQL)

**New input type:**
```
CreateTransferTransactionInput:
  fromAccountId, toAccountId,
  fromAmount, toAmount,
  exchangeRate (default 1.0),
  note (optional)
```

**New mutations:**
- `createTransferTransaction(input: CreateTransferTransactionInput!) -> Transaction` — call `POST /internal/transactions/transfer`, then concurrently (`asyncio.gather`): debit `fromAccount` by `-fromAmount` and credit `toAccount` by `+toAmount`
- `cancelTransaction(id: ID!) -> Boolean` — call `DELETE /internal/transactions/{id}`, receive amounts, concurrently reverse both balances

**Update `Transaction` GraphQL type** — add `toAccountId: ID`, `transferPeerId: ID`, `fromAccountId: ID`.

---

### 2.4 Frontend

**Install missing dependency (first step):**
```
npm install
```
`@dnd-kit/core` and `@dnd-kit/utilities` are declared in `package.json` but not installed. TypeScript currently fails on their imports.

**`src/pages/home/HomePage.tsx`** — add branch in `handleDragEnd`:
```
account:* → account-drop:*  (new branch)
  if fromId === toId → do nothing
  else → setPendingTransfer({ fromAccount, toAccount })
```
Use separate state `pendingTransfer: { fromAccount: Account; toAccount: Account } | null` — do not mix with existing `pendingTransaction` state.

**New component `src/features/transaction/TransferModal.tsx`:**

| Field | Description |
|---|---|
| From / To header | Account icons and names (read-only, from props) |
| Amount | Amount in `fromAccount.currency` |
| Exchange rate + to-amount preview | Visible only when `fromAccount.currency ≠ toAccount.currency`; rate auto-fetched from `/bff/exchange-rate` |
| Note | Optional free text |
| Cancel / Confirm | Confirm calls `CREATE_TRANSFER_TRANSACTION_MUTATION` |

`refetchQueries` on success: `ACCOUNTS_QUERY` + `ACCOUNT_TRANSACTIONS_QUERY` for both `fromAccount.id` and `toAccount.id` (refresh balances and both transaction lists).

**`src/entities/transaction/api/transactions.mutations.ts`** — add `CREATE_TRANSFER_TRANSACTION_MUTATION`.

**`src/entities/transaction/model/types.ts`** — add optional fields `toAccountId?: string`, `transferPeerId?: string`, `fromAccountId?: string`.

**Cancellation UI** — on `AccountDetailPage`, tapping a transfer entry shows a confirmation dialog and calls `CANCEL_TRANSACTION_MUTATION`.

---

## 3. Impact and Risk Analysis

**System Dependencies:**
- accounts-service — existing `/balance` endpoint used as-is, no changes
- Existing `createExpenseTransaction` / `createIncomeTransaction` are unaffected
- `get_totals` — already filters by `type = 'expense'`/`'income'`; transfer rows are excluded automatically. Add explicit `type != 'transfer'` guard for safety.

**Potential Risks & Mitigations:**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Inconsistency: BFF crashes between INSERT and PATCH /balance | Low but real | Both INSERTs are one DB transaction. If PATCH /balance fails — log to Sentry; manual correction acceptable for V1 |
| `transfer_peer_id` self-reference on INSERT | — | Two-flush pattern: INSERT both rows without peer_id, then UPDATE peer_id after UUIDs are assigned |
| `npm install` not run | Already broken | Run `npm install` as the first implementation step; TypeScript build is broken without it |
| Cancellation not idempotent | Low | Check transaction existence before deletion; return 404 if already cancelled |

---

## 4. Testing Strategy

- **transactions-service unit tests** — `create_transfer_pair()`: both rows created with cross-referencing `transfer_peer_id`; `delete_transfer_pair()`: both rows deleted, correct deltas returned
- **BFF integration tests** — `createTransferTransaction`: both balances updated; `cancelTransaction`: both balances reversed
- **Frontend** — manual drag & drop testing; same-currency and cross-currency form flows; cancellation via `AccountDetailPage`
