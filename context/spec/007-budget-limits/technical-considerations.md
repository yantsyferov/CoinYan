# Technical Specification: Per-Category Budget Limits

- **Functional Specification:** `context/spec/007-budget-limits/functional-spec.md`
- **Status:** Completed
- **Author(s):** yantsyferov

---

## 1. High-Level Technical Approach

Introduce a new `budgets-service` microservice that stores per-user, per-category monthly spending ceilings. The BFF fan-outs a third concurrent REST call to this service when resolving the `ExpenseCategory` GraphQL type, merging `budget_limit` and the already-available `total` (current-month spend) into computed `monthlyLimit` and `monthlySpent` fields. The frontend renders a circular SVG progress ring on category icons and adds a two-step confirmation gate inside `TransactionModal`.

Systems affected: new `budgets-service`; web-bff; frontend `ExpenseCategoryDetailPage`, `HomePage`, `CircleItem`, `TransactionModal`.

---

## 2. Proposed Solution & Implementation Plan

### Architecture Changes

A new `budgets-service` is added to the microservices stack. It is internal-only (no public-facing routes) and communicates with the BFF over the internal Docker network, following the same pattern as the existing `categories-service`, `transactions-service`, and `accounts-service`.

The BFF already performs two concurrent REST calls per `ExpenseCategory` resolution (categories-service for metadata, transactions-service for the monthly total). It gains a third call to `budgets-service` to retrieve the stored limit.

### Data Model

`budgets-service` owns a single table:

**`budget_limit`**
| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK, default `gen_random_uuid()` |
| `user_id` | `UUID` | NOT NULL |
| `expense_category_id` | `UUID` | NOT NULL |
| `amount` | `NUMERIC(19,4)` | NOT NULL, CHECK > 0 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `now()` |

Unique constraint: `(user_id, expense_category_id)`.

No foreign keys to other services — referential integrity is enforced at the application layer (the BFF ensures the category exists before writing a limit).

### API Contracts

All routes are internal (authenticated via the same JWT forwarded from the BFF, scoped to the calling user's `user_id`).

| Method | Path | Description |
|---|---|---|
| `PUT` | `/internal/budget-limits/{category_id}` | Upsert a limit (`{"amount": float}`). |
| `DELETE` | `/internal/budget-limits/{category_id}` | Remove a limit for the category. |
| `GET` | `/internal/budget-limits` | Return all limits for the user (list of `{expense_category_id, amount}`). |
| `GET` | `/health` | Standard health check. |

The `PUT` endpoint uses `INSERT ... ON CONFLICT (user_id, expense_category_id) DO UPDATE SET amount = excluded.amount, updated_at = now()`.

### BFF Changes

**GraphQL schema additions** (Strawberry, `web-bff/app/schema/`):

- `ExpenseCategory` type gains two optional fields:
  - `monthly_limit: float | None` — stored ceiling from budgets-service, `null` if unset.
  - `budget_percent: float | None` — computed as `total / monthly_limit * 100`, `null` if no limit; capped display-side (not capped here).

- New mutation: `setExpenseCategoryLimit(id: ID!, monthlyLimit: Float): ExpenseCategory`
  - `monthlyLimit = null` → calls `DELETE /internal/budget-limits/{id}`.
  - `monthlyLimit > 0` → calls `PUT /internal/budget-limits/{id}`.
  - Returns the updated `ExpenseCategory` (triggers Apollo cache update).

**Resolver fan-out** — `ExpenseCategoryResolver` makes three concurrent `asyncio.gather` calls:
1. categories-service → category metadata
2. transactions-service → monthly `total`
3. budgets-service → `amount` for this category

If budgets-service is unreachable, `monthly_limit` degrades gracefully to `null` (no ring shown).

### Frontend Changes

**`src/entities/category/model/types.ts`** — `ExpenseCategory` type gains:
```
monthlyLimit?: number | null
monthlySpent?: number
```

**`EXPENSE_CATEGORIES_QUERY`** — selection set adds `monthlyLimit`, `monthlySpent`.

**New mutation file** — `src/entities/category/api/expense-category-limit.mutation.ts`:
```
mutation SetExpenseCategoryLimit($id: ID!, $monthlyLimit: Float) {
  setExpenseCategoryLimit(id: $id, monthlyLimit: $monthlyLimit) {
    id
    monthlyLimit
    monthlySpent
  }
}
```

**`src/shared/ui/CircleItem.tsx`** — New optional props:
- `budgetRatio?: number` — `monthlySpent / monthlyLimit`, `undefined` = no ring.
- SVG ring: 80×80 viewBox, `<circle r="34" cx="40" cy="40">`, `strokeDasharray="213.63"`, `strokeDashoffset = 213.63 × (1 - clamp(budgetRatio, 0, 1))`.
- Color logic: `budgetRatio < 0.6` → green (`#22c55e`), `< 0.85` → orange (`#f97316`), `≥ 0.85` → red (`#ef4444`). Full overflow keeps red at `strokeDashoffset = 0`.

**`src/pages/categories/ExpenseCategoryDetailPage.tsx`** — Monthly limit input field in the category header card:
- Controlled `<input type="number" min="0">`.
- `onBlur`: if value > 0 → call `setExpenseCategoryLimit(id, value)`; if empty → call `setExpenseCategoryLimit(id, null)`.
- Inline validation: shows error if value ≤ 0 or non-numeric; does not save.

**`src/features/transaction/TransactionModal.tsx`** — Budget gate for expense transactions:
- Before calling the `CreateExpenseTransaction` mutation, check: `category.monthlySpent + amount > category.monthlyLimit` (when limit is set).
- If true, set local `budgetWarning: true` state, render a warning banner with "Confirm anyway" / "Cancel" actions.
- "Confirm anyway" proceeds with the mutation; "Cancel" returns to the form.
- Income and transfer transactions are not affected.

### Monthly Reset

No scheduled job needed. The `transactions-service` `get_totals` endpoint already filters by the current calendar month when no `year`/`month` parameters are supplied. As the BFF always calls it without those parameters, `monthlySpent` naturally resets to `0` on the 1st of each month. Stored limits remain untouched.

---

## 3. Impact and Risk Analysis

**System Dependencies**
- `budgets-service` is a new process; Docker Compose and any deployment manifests must be updated.
- BFF gains a third network dependency per `ExpenseCategory` query. A slow or down budgets-service could increase p99 latency for category resolution.
- `TransactionModal` already fetches category data for the expense form; it now relies on `monthlyLimit`/`monthlySpent` being present in the Apollo cache.

**Potential Risks & Mitigations**
| Risk | Mitigation |
|---|---|
| budgets-service unavailable at query time | BFF catches exception, returns `monthly_limit: null`; frontend hides ring silently. |
| Race condition: two tabs both near the limit | Limit is soft — the warning fires client-side before submit. Server does not enforce a hard ceiling; over-limit transactions are allowed by design (spec §2.3). |
| Apollo cache stale after limit mutation | `setExpenseCategoryLimit` mutation returns the full updated `ExpenseCategory` fragment; Apollo updates cache automatically. |
| `monthlySpent` computed from two separate service calls | BFF reads `total` from transactions-service and `amount` from budgets-service in the same resolver; they are fetched concurrently and are always consistent for the same request. |

---

## 4. Testing Strategy

**Unit / integration (pytest, `budgets-service`):**
- PUT upserts correctly; second PUT on same category updates the amount.
- DELETE removes the row; subsequent GET returns empty.
- Input validation rejects `amount ≤ 0`.

**BFF integration (pytest, `web-bff`):**
- `setExpenseCategoryLimit` mutation wires through to budgets-service.
- `ExpenseCategory` resolver returns `monthly_limit` and `budget_percent` when a limit exists; returns `null` fields when no limit is set.
- BFF degrades gracefully (returns `null` fields) if budgets-service times out.

**E2E (Playwright, `frontend/tests/`):**
- `budget-limit-set-and-ring.spec.ts` — Navigate to a category detail page, enter a limit, blur field, assert ring appears on the home page icon with the correct color for the current spend percentage.
- `budget-limit-warning.spec.ts` — Set limit below current spend threshold, add an expense that would exceed it, assert warning appears, confirm anyway, assert ring is red.
- `budget-limit-clear.spec.ts` — Clear the limit field, blur, assert ring disappears.
- `budget-limit-validation.spec.ts` — Enter 0 / negative / text; assert error message shown and limit not saved.
