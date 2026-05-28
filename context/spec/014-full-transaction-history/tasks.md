# Task List: Full Transaction History Grouped by Month

- **Spec:** `context/spec/014-full-transaction-history/`
- **Status:** In Progress

---

## Slice 1 — Backend: Optional month filter + offset pagination

- [x] Update `list_by_filter()` in `transaction_repo.py`: make month/year filter optional (apply only when both explicitly provided), replace hardcoded `.limit(100)` with `.limit(limit).offset(offset)`, add `limit: int = 50` and `offset: int = 0` params **[Agent: python-backend]**
- [x] Update `GET /internal/transactions` router: add `limit: int = Query(50, ge=1, le=200)` and `offset: int = Query(0, ge=0)` params, forward to `list_by_filter()` **[Agent: python-backend]**
- [x] Verify via curl inside Docker: (a) call without year/month → transactions from all months returned; (b) call with `limit=2&offset=0` then `limit=2&offset=2` → non-overlapping pages; (c) call with `year=X&month=Y` → month filter still works **[Agent: qa-testing]**

---

## Slice 2 — BFF: Thread limit/offset through GraphQL queries

- [x] Update `account_transactions`, `expense_category_transactions`, and `income_source_transactions` resolvers in `schema.py`: add `limit: int = 50` and `offset: int = 0` arguments to each, pass them as HTTP query params to the transactions-service **[Agent: python-backend]**
- [x] Verify via curl to the BFF GraphQL endpoint: query `accountTransactions(accountId: "...", limit: 2, offset: 0)` → 2 transactions returned; repeat with `offset: 2` → next 2 transactions **[Agent: qa-testing]**

---

## Slice 3 — Frontend: Month grouping utility + grouped display (first page)

- [x] Update all three GraphQL query documents in `transactions.queries.ts`: add `$limit: Int = 50` and `$offset: Int = 0` variables, forward them as query arguments **[Agent: react-frontend]**
- [x] Create `frontend/src/shared/lib/group-by-month.ts`: export `groupByMonth(transactions: Transaction[]): MonthGroup[]` where `MonthGroup = { label: string; transactions: Transaction[] }`. Label uses `new Date(year, month - 1, 1).toLocaleDateString(...)` to avoid UTC offset issues. **[Agent: react-frontend]**
- [x] Update `AccountDetailPage.tsx`, `ExpenseCategoryDetailPage.tsx`, and `IncomeSourceDetailPage.tsx`: fetch with `{ limit: 50, offset: 0 }`, pass result through `groupByMonth()` inside `useMemo`, render a month-name heading before each group's transaction rows (replace the current flat list) **[Agent: react-frontend]**
- [x] Verify in browser: open an account (or category/income source) with transactions spanning at least two months → month headings appear above each group; transactions within each group are in date-descending order; months with no transactions are skipped **[Agent: qa-testing]**

---

## Slice 4 — Frontend: Infinite scroll

- [x] Update all three detail pages: add `allTransactions: Transaction[]`, `hasMore: boolean`, and `isFetchingMore: boolean` state; initialize `allTransactions` from the initial query result and set `hasMore = (result.length >= 50)`; reset `allTransactions` to first page via `useEffect` when the initial query's `data` changes (covers post-cancel/edit refetch) **[Agent: react-frontend]**
- [x] Add an `IntersectionObserver` sentinel `<div>` at the bottom of the transaction list on all three pages; when the sentinel becomes visible, `hasMore` is true, and not already fetching, call `fetchMore({ variables: { offset: allTransactions.length } })` and append the result to `allTransactions`; show a spinner at the bottom while `isFetchingMore` is true **[Agent: react-frontend]**
- [x] Verify in browser: on an account with >50 transactions, scroll to the bottom → spinner appears, next batch loads and is appended with correct month headers; on an account with ≤50 transactions, no spinner after initial load; after cancelling a transaction, the list resets to page 1 and month headers are still correct **[Agent: qa-testing]**

---

## Slice 5 — E2E Playwright Tests

- [x] Write a Playwright test: create transactions in two different months via API for a fresh isolated account, navigate to that account's detail page → verify both month headers are visible and each header's group contains the correct transactions **[Agent: qa-testing]**
- [x] Write a Playwright test: navigate to an account with ≤50 transactions → verify no infinite-scroll spinner appears after load; navigate to an account with >50 transactions → scroll to the bottom and verify more transactions load **[Agent: qa-testing]**
- [x] Write a Playwright test: cancel a transaction on an account with multi-month history → verify the list resets correctly, month headers are still shown, and the cancelled transaction is no longer present **[Agent: qa-testing]**
