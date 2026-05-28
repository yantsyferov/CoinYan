# Technical Specification: Account Balance by Period on Dashboard

- **Functional Specification:** `context/spec/010-account-balance-by-period/functional-spec.md`
- **Status:** Completed
- **Author(s):** yantsyferov

---

## 1. High-Level Technical Approach

Three layers are affected; no database schema changes are required.

1. **`transactions-service`** — extend the existing `/totals` endpoint with an optional `after_date` parameter so the BFF can retrieve aggregate income/expenses for all transactions after a given point in time.
2. **Web BFF** — update the `dashboard` resolver to compute a period-aware account balance. For past months the BFF makes one additional call to the extended `/totals` endpoint and applies the historical-balance formula. For the current month it continues using the real-time balance unchanged.
3. **React Frontend** — two small UI constraints: disable the `›` (next month) button when already on the current month, and cap the month picker's selectable range at the current month.

The `totalAccountBalance` field in the GraphQL schema stays as `Float` — only its server-side computation changes.

---

## 2. Proposed Solution & Implementation Plan

### 2.1. `transactions-service` — extend `/totals` endpoint

**File:** `services/transactions-service/app/repositories/transaction_repo.py`

Add an optional `after_date: Optional[datetime]` parameter to the `get_totals` repository method. When this parameter is provided, the query filters for all transactions where `created_at >= after_date` (open-ended, no upper bound), aggregating income and expense totals across all months. When absent, behaviour is unchanged (existing `year`/`month` window filter applies).

**File:** `services/transactions-service/app/routers/transactions.py`

Add `after_date: Optional[datetime] = Query(None)` to the `GET /internal/transactions/totals` route handler and thread it through to the repo call. The response shape remains the same `dict` with `expense_categories` and `income_sources` keys.

No Pydantic schema changes; no Alembic migration.

### 2.2. BFF — period-aware `total_account_balance`

**File:** `services/web-bff/app/schema.py`

In the `dashboard(year, month)` resolver, after the existing `asyncio.gather` for accounts and monthly totals:

1. Compute `end_of_period = datetime(year, month+1, 1, tzinfo=utc)` — the first instant of the month following the requested period. Handle December: if `month == 12`, use `datetime(year + 1, 1, 1, ...)`.
2. Compare `end_of_period` to `datetime.now(utc)`:
   - **Current or future month** (`end_of_period > now`): keep `total_account_balance` as the live sum of active account balances — no extra call.
   - **Past month** (`end_of_period <= now`): make one additional call to `GET /internal/transactions/totals?after_date=<end_of_period>`. With the result, apply:

     ```
     historical_total = current_total_balance
                       − sum(income_after)
                       + sum(expenses_after)
     ```

     Transfers are excluded from this calculation because their net effect on the total across all accounts is zero.

This additional call is made only for past months and is resilient: if the endpoint fails, fall back to `current_total_balance` so the dashboard degrades gracefully rather than erroring.

### 2.3. Frontend — navigation constraints

**File:** `frontend/src/pages/dashboard/DashboardPage.tsx`

- **`›` button (line ~188):** Add `disabled={isCurrentMonth}`. Spread a style override (`opacity: 0.3`, `cursor: 'not-allowed'`) when `isCurrentMonth` is true. The base `navButtonStyle` object is unchanged.
- **Month picker (line ~162):** Add a `max` attribute set to the current month in `YYYY-MM` format, derived from the existing `now` constant. This prevents the native picker from offering future months for selection.

`isCurrentMonth` is already computed and in scope for both elements; no new state is needed.

---

## 3. Impact and Risk Analysis

**Dependencies:**
- BFF depends on the extended `/totals` endpoint in transactions-service. The endpoint must be deployed before the BFF change goes live, or deployed together.

**Risks & Mitigations:**

| Risk | Mitigation |
|---|---|
| Timezone edge case: a transaction created at `23:59:59 UTC` on the last day of the month is attributed to the next month's "after" window | All timestamps are stored and compared in UTC throughout the system — already enforced by `timezone.utc` in the repo. No edge case. |
| BFF extra call fails for the `after_date` aggregate (network error, service down) | Wrap in `try/except`; fall back to `total_account_balance = current_total_balance` so the dashboard degrades gracefully. |
| December edge case: `month + 1` overflows to 13 | Handle explicitly: if `month == 12`, use `datetime(year + 1, 1, 1, tzinfo=utc)`. |

---

## 4. Testing Strategy

**E2E tests (Playwright) — update `frontend/tests/dashboard.spec.ts`:**
- Assert the `›` button is disabled when viewing the current month.
- Assert the month picker's `max` attribute equals the current month in `YYYY-MM` format.
- Assert that switching to a past month with known transaction data produces an Account Balance value different from the current real-time balance.

**Integration / manual verification:**
- Call `GET /internal/transactions/totals?after_date=<ISO-datetime>` directly and confirm the response correctly sums all income/expenses after the given date.
- Load the dashboard for a past month; verify Account Balance equals `current_total − post_month_income + post_month_expenses` by cross-checking with transaction records.
