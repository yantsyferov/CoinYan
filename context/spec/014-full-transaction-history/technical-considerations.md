# Technical Specification: Full Transaction History Grouped by Month

- **Functional Specification:** `context/spec/014-full-transaction-history/functional-spec.md`
- **Status:** Completed
- **Author(s):** yantsyferov

---

## 1. High-Level Technical Approach

Three layers require changes in sequence: the **transactions-service** (make the month filter optional, add offset-based pagination params), the **web-bff** (thread `limit`/`offset` args through the three GraphQL query resolvers), and the **React frontend** (infinite scroll, transactions accumulated in component state, month-grouped rendering).

No database migrations, no new services, and no new libraries are required. Month grouping is computed on the client from the already-present `transactionDate` field on each transaction.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Backend — transactions-service

**File:** `services/transactions-service/app/repositories/transaction_repo.py`

`list_by_filter()` changes:
- The month range filter becomes truly optional. It is applied **only** when both `year` and `month` are explicitly provided. When neither is provided, no date range filter is applied — all transactions for the entity are returned.
- Add two new parameters: `limit: int = 50` and `offset: int = 0`.
- Replace the hardcoded `.limit(100)` with `.limit(limit).offset(offset)`.

**File:** `services/transactions-service/app/routers/transactions.py`

`GET /internal/transactions` changes:
- Add two new query params: `limit: int = Query(50, ge=1, le=200)` and `offset: int = Query(0, ge=0)`.
- Forward both to `list_by_filter()`.

No changes to `/totals`, `/balance`, or any write endpoints.

### 2.2 BFF — web-bff GraphQL Schema

**File:** `services/web-bff/app/schema.py`

The three query resolvers (`account_transactions`, `expense_category_transactions`, `income_source_transactions`) each gain two new optional arguments: `limit: int = 50` and `offset: int = 0`. Each resolver passes them as HTTP query params to the transactions-service `GET /internal/transactions` call.

No changes to the `Transaction` type or any mutation resolvers.

### 2.3 Frontend — GraphQL Queries

**File:** `frontend/src/entities/transaction/api/transactions.queries.ts`

All three query documents gain two new optional variables — `$limit: Int = 50` and `$offset: Int = 0` — which are forwarded as arguments to the corresponding query field.

### 2.4 Frontend — Month Grouping Utility

**File:** `frontend/src/shared/lib/group-by-month.ts` (new file)

Exports a single pure function: `groupByMonth(transactions: Transaction[]): MonthGroup[]`

Where `MonthGroup` is `{ label: string; transactions: Transaction[] }`. Groups are already in descending order because the backend sorts by `transaction_date DESC, created_at DESC`. The `label` is computed the same way as `formatDate` — using `new Date(year, month - 1, 1).toLocaleDateString(...)` applied to the first day of each month to avoid UTC offset issues.

### 2.5 Frontend — All Three Detail Pages

**Files:** `AccountDetailPage.tsx`, `ExpenseCategoryDetailPage.tsx`, `IncomeSourceDetailPage.tsx`

**New state per page:**
- `allTransactions: Transaction[]` — accumulated list across all loaded pages.
- `hasMore: boolean` — set to `false` once a response returns fewer than `limit` items.
- `isFetchingMore: boolean` — controls the spinner visibility.

**Initial load:** `useQuery` with `{ limit: 50, offset: 0 }`, `fetchPolicy: 'cache-and-network'`. On completion, initialize `allTransactions` and set `hasMore = (result.length >= 50)`.

**Infinite scroll:** A sentinel `<div>` is rendered below the last transaction row. An `IntersectionObserver` watches it — when it becomes visible and `hasMore` is true and not already fetching, call `fetchMore({ variables: { offset: allTransactions.length } })`. On result, append to `allTransactions` and update `hasMore`.

**After a cancel or edit mutation:** The existing `refetchQueries` re-runs the initial query. A `useEffect` watching the initial query's `data` resets `allTransactions` to the fresh first page, clearing any accumulated pages.

**Rendering:** Pass `allTransactions` through `groupByMonth()` inside a `useMemo`. Render each group as a month-name heading followed by its transaction rows. Show a spinner at the bottom while `isFetchingMore` is true. Show nothing extra when `hasMore` is false.

---

## 3. Impact and Risk Analysis

**System Dependencies:**
- `GET /internal/transactions` is called by the BFF only. Adding `limit`/`offset` with safe defaults is fully backward-compatible.
- Making the month filter optional does not affect `/totals` or `/balance` — those endpoints are unchanged.
- The dashboard resolver does not call the three history query resolvers — no impact there.

**Potential Risks & Mitigations:**

| Risk | Mitigation |
|---|---|
| `OFFSET` performance degrades at very large row counts | For a personal finance app, typical users have hundreds of transactions per account, not millions. PostgreSQL `OFFSET` on the indexed `(transaction_date DESC, created_at DESC)` ordering is fast enough for V1. |
| After a cancel/edit, the user loses their scroll position (list resets to page 1) | Acceptable for V1. The mutation is a deliberate user action; returning to the top of the fresh list is expected behavior. |
| `IntersectionObserver` not available in very old browsers | >96% global browser support. No fallback needed for V1. |

---

## 4. Testing Strategy

**Backend (curl / manual):**
- `GET /internal/transactions?account_id=X` without year/month → all months returned, not just current.
- `limit=2&offset=0` then `limit=2&offset=2` → non-overlapping, sequential pages.
- `limit=2&offset=0&year=2026&month=5` → month filter still works when explicitly provided.

**Frontend (Playwright E2E):**
- Account with transactions in two different months → both month headers appear in the list.
- Account with >50 transactions → spinner appears; scrolling to bottom loads more transactions.
- Cancel a transaction → list resets to page 1; month headers still display correctly.
- Month with no transactions → no empty header for that month.
