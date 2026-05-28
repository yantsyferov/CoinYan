# Technical Specification: Edit Transaction

- **Functional Specification:** `context/spec/008-edit-transaction/functional-spec.md`
- **Status:** Completed
- **Author(s):** yantsyferov

---

## 1. High-Level Technical Approach

Add a `PATCH /internal/transactions/{transaction_id}` endpoint to `transactions-service` that updates `amount`, `account_amount`, and `note` in place, returning the old amounts so the BFF can compute balance deltas. The BFF gains an `updateTransaction` GraphQL mutation that calls the PATCH endpoint, then issues corrective balance adjustments via the existing `_adjust_balance` helper on `accounts-service`. On the frontend, the current single-click-to-cancel behavior on every transaction row is replaced by a context menu (Edit / Delete) — implemented inline per page, matching the existing cancel-dialog pattern. A new shared `EditTransactionDialog` component handles the edit form across all three pages.

**Systems affected:** `transactions-service`; `web-bff`; frontend — `AccountDetailPage`, `ExpenseCategoryDetailPage`, `IncomeSourceDetailPage`, new `EditTransactionDialog`, `transactions.mutations.ts`.

---

## 2. Proposed Solution & Implementation Plan

### Architecture Changes

No new services. This is an in-place enhancement: `transactions-service` gains one PATCH endpoint, the BFF gains one mutation, and the frontend gains one new dialog component plus context-menu state on three pages.

### Data Model / Database Changes

**None — no migration required.** The `transactions` table already has `amount`, `account_amount`, `note`, `transfer_peer_id`, and `from_account_id`. Only application logic changes.

### API Contracts

**`transactions-service`** — new endpoint:

| Method | Path | Description |
|---|---|---|
| `PATCH` | `/internal/transactions/{transaction_id}` | Update `amount` and `note` on an existing transaction. For transfers, both legs are updated atomically. |

**Request body:**
```
{
  "amount": Decimal   (required, > 0),
  "note":   str | None
}
```

**Response body:**
```
{
  "transaction":             TransactionResponse,
  "old_account_amount":      Decimal,
  "peer_transaction":        TransactionResponse | None,   // transfers only
  "old_peer_account_amount": Decimal | None               // transfers only
}
```

**Endpoint behavior:**
1. Fetch row by `transaction_id` + `user_id` (from `X-User-Id` header); return `404` if not found.
2. Record `old_account_amount`.
3. Update `amount`, `account_amount` (= `amount` since `exchange_rate = 1.0` in V1), and `note` (empty string → `NULL`).
4. If `type == "transfer"`: fetch the peer row via `transfer_peer_id` and apply the same update atomically in the same DB transaction; return peer row + `old_peer_account_amount`.
5. Return updated row(s) + old amounts.

**New Pydantic schemas** in `services/transactions-service/app/schemas/transaction.py`:
- `UpdateTransactionRequest`: `amount: Decimal`, `note: str | None`
- `UpdateTransactionResponse`: wraps `transaction`, `old_account_amount`, optional `peer_transaction`, optional `old_peer_account_amount`

### BFF Changes

**`services/web-bff/app/schema.py`** — new Strawberry input type and mutation:

```
UpdateTransactionInput:  { id: ID!, amount: Float!, note: String | None }

updateTransaction(input: UpdateTransactionInput!) -> Transaction
```

**Mutation resolver logic:**
1. Call `PATCH /internal/transactions/{id}` with `{ amount, note }`.
2. Read `transaction.type` from the response.
3. Compute deltas and call `_adjust_balance` (same helper used by create/delete today):
   - `expense`: `delta = -(new_account_amount - old_account_amount)` on `transaction.account_id`
   - `income`: `delta = new_account_amount - old_account_amount` on `transaction.account_id`
   - `transfer`: two concurrent `_adjust_balance` calls — from-account `delta = -(new - old)`, to-account `delta = +(new - old)` (accounts identified by `from_account_id` vs `to_account_id`)
4. Return the updated `Transaction`.

### Frontend Changes

**New mutation** — added to `frontend/src/entities/transaction/api/transactions.mutations.ts`:
```graphql
mutation UpdateTransaction($input: UpdateTransactionInput!) {
  updateTransaction(input: $input) {
    id type amount note
    accountId fromAccountId toAccountId
  }
}
```

**New component** — `frontend/src/features/transaction/EditTransactionDialog.tsx`:
- **Props:** `transaction: Transaction`, `onClose: () => void`
- **State:** `amount: string` (pre-filled from `transaction.amount`), `note: string` (pre-filled), `amountError: string | null`, `loading: boolean`
- **Transfers:** single `amount` field (symmetric — applied to both legs server-side)
- **Validation:** amount must be a number > 0; inline error shown below field, Save button disabled
- **On Save:** calls `UPDATE_TRANSACTION_MUTATION`; Apollo cache updates automatically by `id`; calls `onClose()`
- **No `refetchQueries` needed** — the mutation response carries updated `amount` and `note` fields, and Apollo's normalized cache patches all cached list entries that share the same `id`
- **On Cancel:** calls `onClose()`, no mutation

**Per-page context menu** (inline, one per page) — changes to all three pages:

| Page | File |
|---|---|
| Account history | `frontend/src/pages/accounts/AccountDetailPage.tsx` |
| Category history | `frontend/src/pages/categories/ExpenseCategoryDetailPage.tsx` |
| Income source history | `frontend/src/pages/categories/IncomeSourceDetailPage.tsx` |

Each page gains:
- New local state: `contextMenu: { txn: Transaction, rect: DOMRect } | null`
- New local state: `editTarget: Transaction | null`
- Row `onClick` → sets `contextMenu` (replaces current `setConfirmCancel` direct call)
- Context menu UI: small absolute-positioned card with "Edit" and "Delete" buttons; `useEffect` adds a `document mousedown` listener to dismiss on outside click
- "Edit" option → sets `editTarget`, clears `contextMenu`, renders `<EditTransactionDialog>`
- "Delete" option → sets `confirmCancel` (existing flow, **unchanged**)
- `note` is already selected in all three list queries — no query changes needed

---

## 3. Impact and Risk Analysis

**System Dependencies:**
- `accounts-service` is called by the BFF for every edit via `_adjust_balance` — identical pattern to create/delete today.
- `transactions-service` gains one new PATCH endpoint. All existing endpoints are untouched.
- All three transaction-list pages require a small refactor of their row `onClick` handler and cancel-dialog rendering.

**Potential Risks & Mitigations:**

| Risk | Mitigation |
|---|---|
| Race condition: user edits a row that another tab deleted | PATCH returns `404`; BFF surfaces it as a GraphQL error; frontend shows an error state. |
| Transfer peer row missing (data inconsistency) | PATCH returns `422` if `transfer_peer_id` is null or the peer row is not found. |
| Balance drift: PATCH succeeds but `_adjust_balance` fails | Same risk as today's create/delete flow — no distributed transaction. Acceptable for V1. |
| Apollo cache staleness | Mutation response includes `id` + updated fields; Apollo's normalized cache patches all references automatically. |
| Empty note semantics | Frontend sends `note: ""` when user clears the field; endpoint maps `""` → `NULL` to match the existing "no note" representation. |

---

## 4. Testing Strategy

**Unit / integration (pytest, `transactions-service`):**
- PATCH updates `amount`, `account_amount`, and `note` correctly for expense and income.
- PATCH on a transfer updates both peer rows atomically.
- PATCH returns `404` for a non-existent or wrong-user transaction.
- Input validation rejects `amount ≤ 0`.

**BFF integration (pytest, `web-bff`):**
- `updateTransaction` mutation wires through to the PATCH endpoint and issues the correct balance delta to `accounts-service` for each type (expense, income, transfer).

**E2E (Playwright, `frontend/tests/`):**
- `edit-expense-amount.spec.ts` — Tap expense row → context menu → Edit → change amount → save; assert updated amount in list and account balance adjusted.
- `edit-note.spec.ts` — Edit only the note; assert updated note in list, balance unchanged.
- `edit-transfer.spec.ts` — Edit a transfer amount; assert both accounts' balances updated.
- `edit-validation.spec.ts` — Enter 0 / negative / non-numeric; assert error message shown, Save disabled.
- `context-menu-dismiss.spec.ts` — Tap row, click outside menu, assert no dialog opens.
- `context-menu-delete.spec.ts` — Tap row → Delete; assert existing cancellation flow proceeds unchanged.
