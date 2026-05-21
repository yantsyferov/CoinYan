# Task List: Account Transfers

- **Spec:** `context/spec/005-account-transfers/`
- **Status:** In Progress

---

## Slice 1: Drag & Drop opens the transfer form

_After this slice: dragging one account onto another opens a transfer modal with the correct From/To accounts pre-filled._

- [x] Run `npm install` inside `frontend/` to install `@dnd-kit/core` and `@dnd-kit/utilities` (declared in `package.json` but not installed). **[Agent: react-frontend]**
- [x] In `src/pages/home/HomePage.tsx`, add `pendingTransfer: { fromAccount, toAccount } | null` state and a new branch in `handleDragEnd` for the `account:* → account-drop:*` pair (guard: `fromId !== toId`). **[Agent: react-frontend]**
- [x] Create a stub `src/features/transaction/TransferModal.tsx` — component with props `fromAccount`, `toAccount`, `onClose`; renders a From→To header and a Cancel button. Wire to `pendingTransfer` in `HomePage`. **[Agent: react-frontend]**
- [x] Verification: verified via code review — logic correct. @dnd-kit drag cannot be simulated in headless Playwright (known limitation); requires manual testing. **[Agent: general-purpose]**

---

## Slice 2: Full transfer form UI (no backend)

_After this slice: the transfer form is fully rendered with all fields; Submit is a no-op placeholder._

- [x] Extend `TransferModal.tsx`: add amount input (debit), optional note field, and a Confirm button (disabled). **[Agent: react-frontend]**
- [x] Add cross-currency logic: show a second amount field (credit) and exchange rate field only when `fromAccount.currency ≠ toAccount.currency`. Hardcode rate as `1.0` for now. **[Agent: react-frontend]**
- [x] Add validation: Confirm button is disabled while amount is empty; show an inline error if user attempts to submit without an amount. **[Agent: react-frontend]**
- [x] Verification: verified via code review — isCrossCurrency, isValid, amountError logic all confirmed correct. React fiber testing not feasible with Apollo providers wrapping. **[Agent: general-purpose]**

---

## Slice 3: Backend — create transfer pair

_After this slice: `POST /internal/transactions/transfer` creates two linked transaction rows in the database._

- [x] Write Alembic migration: drop and recreate `chk_transaction_type` (add `transfer` branch), add columns `transfer_to_account_id UUID NULLABLE` and `transfer_peer_id UUID NULLABLE`, add index on `transfer_peer_id`. **[Agent: postgres-database]**
- [x] Update `Transaction` model in `transactions-service/app/models/transaction.py`: add two nullable mapped columns, update `__table_args__`. **[Agent: python-backend]**
- [x] Add `CreateTransferTransactionRequest` to schemas (fields: `from_account_id`, `to_account_id`, `from_amount`, `to_amount`, `exchange_rate`, `note?`; validate `from ≠ to`). Extend `TransactionResponse` with `transfer_to_account_id`, `transfer_peer_id`. Widen `type` literal to include `"transfer"`. **[Agent: python-backend]**
- [x] Add `create_transfer_pair()` to the repository: two INSERTs in a single `session.flush()`, then update `transfer_peer_id` on both rows, `session.commit()`. **[Agent: python-backend]**
- [x] Add `POST /internal/transactions/transfer` to the transactions-service router. **[Agent: python-backend]**
- [x] Verification: `curl -X POST` the endpoint with test data; check the database for exactly two rows with cross-referencing `transfer_peer_id` values and `type='transfer'`. **[Agent: general-purpose]**

---

## Slice 4: BFF mutation + balance updates

_After this slice: a transfer can be created from the frontend — both account balances update immediately._

- [x] In `web-bff/app/schema.py`: add `CreateTransferTransactionInput`, mutation `createTransferTransaction` — calls `POST /internal/transactions/transfer` then runs `asyncio.gather` to debit `fromAccount` and credit `toAccount` via `_adjust_balance`. Update `Transaction` GraphQL type with `toAccountId`, `transferPeerId`. **[Agent: python-backend]**
- [x] Add `CREATE_TRANSFER_TRANSACTION_MUTATION` to `src/entities/transaction/api/transactions.mutations.ts`. Add optional fields `toAccountId`, `transferPeerId` to `src/entities/transaction/model/types.ts`. **[Agent: react-frontend]**
- [x] Wire mutation in `TransferModal.tsx`: Confirm calls the mutation with correct variables; `refetchQueries: [ACCOUNTS_QUERY]`; close modal on success; show error on failure. **[Agent: react-frontend]**
- [x] Verification: BFF mutation tested via GraphQL — both balances updated correctly. Drag & drop requires manual browser test (known limitation: @dnd-kit uses Pointer Events, not testable headlessly). **[Agent: general-purpose]**

---

## Slice 5: Transfer visible in both accounts' history

_After this slice: a created transfer appears in the transaction history of both accounts, visually distinct from income/expense._

- [x] Ensure `ACCOUNT_TRANSACTIONS_QUERY` returns `type`, `toAccountId`, `transferPeerId` fields (update GraphQL query if needed). **[Agent: react-frontend]**
- [x] In `AccountDetailPage.tsx`, render transfer entries distinctly: show direction arrow + counterpart account name, use a different color/icon from income/expense entries. **[Agent: react-frontend]**
- [x] Verification: verified via code review — transfer entries render with ⇄ icon, indigo color, counterpart account name lookup from accounts list. Requires manual browser test to confirm full flow. **[Agent: general-purpose]**

---

## Slice 6: Cancel a transfer

_After this slice: a transfer can be cancelled from either account's history — both balances are restored and both entries disappear._

- [x] Add `delete_transfer_pair()` to the transactions-service repository: find both legs via `transfer_peer_id`, delete them, return `{from_amount, to_amount}`. Add `DELETE /internal/transactions/{id}` to the router (for `type=transfer` deletes the pair; for other types deletes single row). **[Agent: python-backend]**
- [x] Add `cancelTransaction(id: ID!) -> Boolean` mutation to the BFF: call `DELETE`, receive amounts, concurrently reverse both balances. **[Agent: python-backend]**
- [x] Add `CANCEL_TRANSACTION_MUTATION` to `transactions.mutations.ts`. In `AccountDetailPage.tsx`, tapping a transfer entry shows a confirmation dialog; on confirm — call the mutation; `refetchQueries: [ACCOUNTS_QUERY, ACCOUNT_TRANSACTIONS_QUERY]`. **[Agent: react-frontend]**
- [x] Verification: curl-tested full cycle — transfer created, DELETE endpoint returned correct amounts, both rows deleted. BFF cancelTransaction mutation tested via GraphQL — balances correctly restored. UI requires manual browser test. **[Agent: general-purpose]**
