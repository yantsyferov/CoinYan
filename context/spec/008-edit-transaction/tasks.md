# Task List: Edit Transaction

- **Spec:** `context/spec/008-edit-transaction/`
- **Status:** In Progress

---

## Slice 1 — Backend: PATCH endpoint (expense & income)

- [x] Add `UpdateTransactionRequest` and `UpdateTransactionResponse` Pydantic schemas in `services/transactions-service/app/schemas/transaction.py` **[Agent: python-backend]**
- [x] Add `update_transaction` repository method in `services/transactions-service/app/repositories/transaction_repo.py` **[Agent: python-backend]**
- [x] Add `PATCH /internal/transactions/{transaction_id}` route for expense/income types — records old amount, updates `amount`, `account_amount`, `note`, returns old amount in response **[Agent: python-backend]**
- [x] Verify via curl inside Docker: update an expense amount and confirm response contains correct `old_account_amount` and new `amount` **[Agent: qa-testing]**

---

## Slice 2 — Backend: Transfer support in PATCH

- [x] Extend `PATCH /internal/transactions/{transaction_id}` to handle `transfer` type: fetch peer row via `transfer_peer_id`, update both legs atomically in the same DB transaction, return `peer_transaction` and `old_peer_account_amount` **[Agent: python-backend]**
- [x] Verify via curl: update a transfer transaction and confirm both legs are updated in the response **[Agent: qa-testing]**

---

## Slice 3 — BFF: `updateTransaction` GraphQL mutation

- [x] Add `UpdateTransactionInput` Strawberry input type and `updateTransaction` mutation resolver in `services/web-bff/app/schema.py` — calls PATCH endpoint, reads `transaction.type`, computes balance delta per type (expense/income/transfer), calls `_adjust_balance` on accounts-service **[Agent: python-backend]**
- [x] Verify via curl to BFF GraphQL endpoint: call `updateTransaction` on an expense and confirm the updated transaction is returned and the account balance is adjusted **[Agent: qa-testing]**

---

## Slice 4 — Frontend: Context menu on transaction rows

- [x] Add `contextMenu: { txn: Transaction, rect: DOMRect } | null` and `editTarget: Transaction | null` local state to `AccountDetailPage.tsx`, `ExpenseCategoryDetailPage.tsx`, and `IncomeSourceDetailPage.tsx` **[Agent: react-frontend]**
- [x] Replace `onClick → setConfirmCancel` with `onClick → setContextMenu` on each transaction row across all three pages; render context menu card with "Edit" (no-op placeholder) and "Delete" buttons; wire "Delete" to existing `confirmCancel` flow (unchanged); add `mousedown` listener to dismiss on outside click **[Agent: react-frontend]**
- [x] Verify in browser: tap a transaction → context menu appears with Edit + Delete; click outside → menu dismisses; click Delete → existing cancel dialog appears and functions as before **[Agent: qa-testing]**

---

## Slice 5 — Frontend: EditTransactionDialog + full edit flow

- [x] Add `UPDATE_TRANSACTION_MUTATION` to `frontend/src/entities/transaction/api/transactions.mutations.ts` **[Agent: react-frontend]**
- [x] Create `frontend/src/features/transaction/EditTransactionDialog.tsx` — amount + note fields pre-filled from transaction, amount validation (must be > 0), Save button disabled when invalid, calls `UPDATE_TRANSACTION_MUTATION` on save, Apollo cache updates automatically by `id`, calls `onClose()` on both save and cancel **[Agent: react-frontend]**
- [x] Wire "Edit" option in context menu on all three pages to render `<EditTransactionDialog transaction={editTarget} onClose={...} />` **[Agent: react-frontend]**
- [x] Verify in browser: edit an expense amount → list updates with new amount + account balance adjusts; edit a transfer → both account balances update; enter invalid amount (0 / negative / non-numeric) → error shown + Save disabled; cancel → no changes applied **[Agent: qa-testing]**
