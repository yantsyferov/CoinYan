# Technical Specification: Account Balance — Historical Cumulative Balance by Month

- **Functional Specification:** `context/spec/011-account-balance-historical-cumulative/functional-spec.md`
- **Status:** Completed
- **Author(s):** yantsyferov

---

## 1. High-Level Technical Approach

Three layers are touched; no new services, no database migrations, no schema migrations.

1. **`transactions-service`** gains a new internal REST endpoint that computes the cumulative balance (all income minus all expenses) for a user up to a given timestamp. A single SQL aggregate query replaces the current fragile backwards-projection.
2. **`web-bff`** updates the `dashboard` GraphQL resolver to call this new endpoint, computing the correct cutoff timestamp based on whether the requested month is past or current. The existing backwards-projection logic is removed. The `totalAccountBalance` GraphQL field becomes nullable.
3. **Frontend** updates the "Account Balance" card to render a no-data indicator when the field is `null`, and the formatted currency amount when it is a number.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 `transactions-service` — New `/balance` Endpoint

**New repository method** in `services/transactions-service/app/repositories/transaction_repo.py`:

| Method | `get_cumulative_balance(user_id, date_to)` |
|---|---|
| Input | `user_id: UUID`, `date_to: datetime` |
| Output | `Decimal \| None` — `None` if no income or expense rows exist before `date_to` |
| Query logic | `SUM(account_amount) WHERE type='income'` minus `SUM(account_amount) WHERE type='expense'`, filtered to `created_at <= date_to`. Transfers (`type='transfer'`) are excluded. Returns `None` (not `0`) when the qualifying row count is zero. |

**New Pydantic response schema** in `services/transactions-service/app/schemas/transaction.py`:

| Schema | `CumulativeBalanceResponse` |
|---|---|
| Fields | `cumulative_balance: float \| None` |

**New route** in `services/transactions-service/app/routers/transactions.py`:

| Method | `GET /internal/transactions/balance` |
|---|---|
| Auth | Internal JWT (same pattern as all other `/internal/` routes) |
| Query param | `date_to: datetime` (required) |
| Response | `CumulativeBalanceResponse` |
| Errors | `422` if `date_to` is missing or malformed |

---

### 2.2 `web-bff` — Updated `dashboard` Resolver

**File:** `services/web-bff/app/schema.py`

**`DashboardSummary` type change:**

| Field | Before | After |
|---|---|---|
| `total_account_balance` | `float` | `Optional[float]` |

**Resolver logic for `total_account_balance`** — replacing the current backwards-projection:

1. Determine the `cutoff` timestamp:
   - If the requested `(year, month)` is the **current month**: `cutoff = now()` (current UTC datetime)
   - If the requested `(year, month)` is a **past month**: `cutoff = first moment of the following month` (exclusive upper bound on the last day of the selected month)
2. Call `GET /internal/transactions/balance?date_to=<cutoff>` on the transactions-service.
3. Map the response:
   - If `cumulative_balance` is `null` → set `total_account_balance = None`
   - If `cumulative_balance` is a number → set `total_account_balance = cumulative_balance`
4. The call to accounts-service `current_balance` is no longer needed for this field and is removed from this code path.

---

### 2.3 Frontend — Null State for "Account Balance" Card

**File:** `frontend/src/pages/dashboard/DashboardPage.tsx`  
**File:** `frontend/src/entities/dashboard/api/dashboard.query.ts`

**GraphQL query:** no structural change — `totalAccountBalance` is already selected. Update its TypeScript type from `number` to `number | null`.

**`SummaryCard` for Account Balance:** change the rendered value logic:

| `totalAccountBalance` value | Rendered output |
|---|---|
| `null` | Em dash `—` or "No data" label (no currency formatting) |
| `number` (including `0`) | `formatCurrency(totalAccountBalance)` as today |

No changes to month navigation, Apollo query variables, or routing.

---

### 2.4 No Database or Migration Changes

The `transactions` table already has `created_at` (timezone-aware), `type`, `account_amount`, and `user_id`. No columns are added. No Alembic migration is needed.

A composite index on `(user_id, type, created_at)` in the transactions table would benefit this query at scale, but is not required for correctness in V1 and is explicitly deferred.

---

## 3. Impact and Risk Analysis

**System dependencies:**
- The BFF `dashboard` resolver currently depends on **both** `accounts-service` (for `current_balance`) and `transactions-service` (for the `after_date` totals). After this change, `total_account_balance` depends only on `transactions-service`. This reduces coupling and eliminates a failure mode where accounts-service drift silently corrupted historical balance values.
- All other `DashboardSummary` fields (`total_income`, `total_expenses`, `total_spending_by_category`) are unaffected.

**Potential risks and mitigations:**

| Risk | Mitigation |
|---|---|
| `totalAccountBalance: null` breaks frontend code that assumes it is always a number | Update TypeScript type to `number \| null` and guard the render path before merging |
| The GraphQL schema change (non-nullable → nullable) is a breaking change for any other consumer of the `dashboard` query | Audit: the only consumer is `DashboardPage`. No mobile client exists yet. Low risk. |
| `date_to` precision edge case — a transaction created at exactly midnight on month boundary is included/excluded differently by `<` vs `<=` | Use `<=` with the last microsecond of the month, or use `<` with the first moment of the next month. Document the chosen boundary clearly in the repository method. |
| Removing the backwards-projection logic may expose a pre-existing discrepancy between `accounts-service` balances and `transactions-service` totals | The new direct query is more reliable. Any discrepancy reveals a pre-existing bug that should be surfaced, not hidden. |

---

## 4. Testing Strategy

**`transactions-service` — unit/integration tests** for `get_cumulative_balance`:
- Income-only transactions up to cutoff → returns correct positive sum
- Expense-only transactions up to cutoff → returns correct negative sum
- Mixed income and expenses → returns net
- Transfer transactions only → returns `None` (transfers excluded)
- No transactions at all → returns `None`
- Transactions exist, but all after `date_to` → returns `None`
- `date_to` falls on a month boundary → correct boundary inclusion

**`web-bff` — integration tests** for the `dashboard` GraphQL query:
- Past month with data → `totalAccountBalance` equals cumulative sum at end of that month
- Current month → `totalAccountBalance` equals cumulative sum up to today
- Month before first transaction → `totalAccountBalance` is `null`

**Frontend — Playwright E2E tests:**
- Navigate to a past month with known transactions → "Account Balance" card shows the correct historical figure
- Navigate to a month before the first recorded transaction → "Account Balance" card shows the no-data indicator (not a currency value)
- Navigate back to current month → "Account Balance" card shows the live cumulative total
