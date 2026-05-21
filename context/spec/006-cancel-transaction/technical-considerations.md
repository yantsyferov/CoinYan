# Technical Specification: Cancel Any Transaction

- **Functional Specification:** `context/spec/006-cancel-transaction/functional-spec.md`
- **Status:** Completed

---

## 1. High-Level Technical Approach

No backend changes are required. The `CANCEL_TRANSACTION_MUTATION` and its resolver already handle all three transaction types (`expense`, `income`, `transfer`). The backend already restores all affected balances and returns the correct result regardless of type.

All work is **frontend-only**: three React pages need to be extended to make expense and income rows cancellable in the same way transfers already are.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 `AccountDetailPage.tsx`

**Gap:** expense and income transaction rows are rendered as plain `<div>` elements with no click handler; only transfer rows are tappable.

**Changes:**
- Add `onClick={() => setConfirmCancelId(txn.id)}`, `role="button"`, `tabIndex={0}`, and `onKeyDown` (Enter/Space) to the non-transfer row `<div>` — mirroring what the transfer row already does.
- Add `cursor: 'pointer'` to the non-transfer row inline style.
- Update the confirmation dialog copy:
  - Title: **"Cancel transaction?"** (was "Cancel transfer?")
  - Body: **"This will permanently remove the entry and restore the affected balance."** (was transfer-specific text)
  - Confirm button label: **"Cancel transaction"** (was "Cancel Transfer")
- No changes to `useMutation` setup — it already uses `CANCEL_TRANSACTION_MUTATION` and the correct `refetchQueries`.

---

### 2.2 `ExpenseCategoryDetailPage.tsx`

**Gap:** the page shows transaction history but has no cancellation support at all.

**Changes:**

**State:**
```ts
const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
```

**Mutation** (add alongside existing queries):
```ts
const [cancelTransaction, { loading: cancelling }] = useMutation(
  CANCEL_TRANSACTION_MUTATION,
  {
    refetchQueries: [
      { query: EXPENSE_CATEGORY_TRANSACTIONS_QUERY, variables: { categoryId: id } },
    ],
  },
);
```

**Handler:**
```ts
const handleConfirmCancel = async () => {
  if (!confirmCancelId) return;
  await cancelTransaction({ variables: { id: confirmCancelId } });
  setConfirmCancelId(null);
};
```

**Transaction rows** — wrap each row `<div>` with:
```ts
onClick={() => setConfirmCancelId(txn.id)}
role="button"
tabIndex={0}
onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setConfirmCancelId(txn.id); }}
style={{ ..., cursor: 'pointer' }}
```

**Confirmation dialog** — add after the transactions list (same markup as `AccountDetailPage`):
- Title: "Cancel transaction?"
- Body: "This will permanently remove the entry and restore the category total."
- Buttons: "Keep" / "Cancel transaction"

**Import** — add `CANCEL_TRANSACTION_MUTATION` to the import from `../../entities/transaction`.

---

### 2.3 `IncomeSourceDetailPage.tsx`

**Gap:** identical to `ExpenseCategoryDetailPage` — transaction history shown, no cancellation.

**Changes:** identical pattern, with one difference in `refetchQueries`:
```ts
refetchQueries: [
  { query: INCOME_SOURCE_TRANSACTIONS_QUERY, variables: { sourceId: id } },
],
```

Dialog body copy: "This will permanently remove the entry and restore the income source total."

**Import** — add `CANCEL_TRANSACTION_MUTATION` and `INCOME_SOURCE_TRANSACTIONS_QUERY` to the import from `../../entities/transaction`.

---

## 3. Impact and Risk Analysis

| Area | Impact |
|---|---|
| Backend | None — no changes |
| `AccountDetailPage` | Low risk — mutation and refetch already wired; only row interactivity and dialog copy change |
| `ExpenseCategoryDetailPage` | Low risk — additive only; existing query and display logic untouched |
| `IncomeSourceDetailPage` | Low risk — same as above |
| Balance consistency | Guaranteed by existing backend logic: the resolver calls the correct reversal path for each transaction type |

**Cancellation of income/expense from the account history** also removes the entry from the corresponding category/income source history automatically (same DB row), so no additional refetch is needed on `AccountDetailPage` for those lists.

---

## 4. Testing Strategy

- **AccountDetailPage** — tap an expense entry → dialog appears with "Cancel transaction?" copy → confirm → row disappears, balance updates.
- **AccountDetailPage** — tap an income entry → same flow → balance decreases.
- **AccountDetailPage** — tap "Keep" → no changes.
- **ExpenseCategoryDetailPage** — tap a transaction → dialog appears → confirm → entry disappears, category monthly total updates.
- **IncomeSourceDetailPage** — tap a transaction → dialog appears → confirm → entry disappears, income source monthly total updates.
- **Regression** — existing transfer cancellation from `AccountDetailPage` continues to work correctly.
