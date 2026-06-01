# Technical Specification: Base Currency & Unified Dashboard

- **Functional Specification:** `context/spec/016-base-currency-unified-dashboard/functional-spec.md`
- **Status:** Completed
- **Author(s):** yantsyferov

---

## 1. High-Level Technical Approach

The feature is implemented across five layers with no new services required:

1. **auth-service** — adds `base_currency` to the user record (schema, validation, CRUD)
2. **transactions-service** — adds three new columns per transaction for base-currency conversion data; extends the monthly-totals aggregation endpoint to sum in base currency
3. **rates-service** — no changes needed; the existing `GET /internal/rates/rate?from=X&to=Y&date=Z` endpoint covers every conversion needed
4. **Web BFF** — orchestrates conversion at transaction-creation time, extends the GraphQL schema, and computes base-currency account balances for the dashboard
5. **React frontend** — adds `CurrencyPicker` to sign-up and profile, updates the dashboard display, and extends the transaction edit form

The key design principle is **write-time conversion**: when a transaction is created or edited, the BFF resolves the conversion rate and stores a ready-to-sum `base_currency_amount` on the transaction record. This lets the aggregation endpoint do a plain `SUM` instead of per-row rate lookups at read time.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Data Model Changes

**auth-service — `users` table**

| New column | Type | Constraints |
|---|---|---|
| `base_currency` | `CHAR(3)` | `NOT NULL`, `DEFAULT 'USD'` |

One new Alembic migration chaining off `cd82689e256f` (the existing `create_users_table` migration). The migration includes a `UPDATE users SET base_currency = 'USD'` data migration for all existing rows.

---

**transactions-service — `transactions` table**

| New column | Type | Constraints | Purpose |
|---|---|---|---|
| `base_currency_code` | `CHAR(3)` | nullable | Which base currency the rate was computed against |
| `base_currency_rate` | `NUMERIC(18,6)` | nullable | `1 [source_currency] = X [base_currency]`; user-editable for Case B |
| `base_currency_amount` | `NUMERIC(19,4)` | nullable | `amount × base_currency_rate`; the pre-computed converted value used in aggregations |

One new Alembic migration chaining off `a0b1c2d3e4f5`. The migration also backfills existing rows: for any transaction where `account_currency = 'USD'` or `source_currency = 'USD'`, set `base_currency_code = 'USD'`, derive `base_currency_rate` from the existing `exchange_rate`, and compute `base_currency_amount = account_amount`. Rows where neither currency is USD are left as `NULL` and handled gracefully by the totals endpoint (see §2.3).

---

### 2.2 API Contracts

**auth-service**

| Endpoint | Change |
|---|---|
| `POST /internal/auth/register` | Add optional `base_currency: string` to request body; default `"USD"` if absent; validate against 3-character ISO code |
| `GET /internal/users/me` | Add `base_currency: string` to response |
| `PATCH /internal/users/me` | Add optional `base_currency: string` to request body |

---

**transactions-service**

| Endpoint | Change |
|---|---|
| `POST` creation endpoints (expense, income, transfer) | Accept `base_currency_code`, `base_currency_rate`, `base_currency_amount` in the request body |
| `PUT /internal/transactions/{id}` | Accept `base_currency_rate` as an editable field; on receipt, recompute `base_currency_amount = amount × base_currency_rate` server-side |
| `GET /internal/transactions/totals` | Add optional `base_currency: string` query param. When supplied: `SUM(base_currency_amount)` for rows where `base_currency_code = :base_currency`; fall back to `SUM(amount)` for rows where `base_currency_amount IS NULL` (legacy data with no conversion stored) |
| `GET /internal/transactions/{id}` | Include `base_currency_code`, `base_currency_rate`, `base_currency_amount` in response |
| `GET /internal/transactions/latest-rate?account_id=X&base_currency_code=Y` | Return the most recent `account_currency → base_currency` rate derived from transactions on this account (see §2.3 for SQL). Used by BFF to convert account balances without calling rates-service. Returns `{"rate": null}` when no qualifying transaction exists. |

---

**rates-service — no changes.** The `GET /internal/rates/rate?from=X&to=Y&date=Z` endpoint already covers all needed lookups.

---

**BFF — GraphQL schema additions**

```
# Modified types
type User             { ...existing... baseCurrency: String! }
type DashboardSummary { ...existing... baseCurrency: String! }
type Account          { ...existing... balanceInBaseCurrency: Float  baseCurrency: String }
type Transaction      { ...existing... baseCurrencyCode: String  baseCurrencyRate: Float  baseCurrencyAmount: Float }

# Modified input types
input SignUpInput        { ...existing... baseCurrency: String }  # optional, default "USD"
input UpdateProfileInput { ...existing... baseCurrency: String }  # optional
```

---

### 2.3 BFF Logic

**Transaction creation (expense / income / transfer)**

1. Fetch `base_currency` from `GET /internal/users/me` (result cached in Redis by `user_id`, 5-minute TTL).
2. Determine the conversion case:
   - **Case A, source = base** — `source_currency == base_currency`: `base_currency_rate = 1.0`, `base_currency_amount = amount` (source amount is already in base currency).
   - **Case A, account = base** — `account_currency == base_currency`: `base_currency_rate = exchange_rate` (meaning `1 source = exchange_rate base`), `base_currency_amount = account_amount`.
   - **Case B** — neither currency equals `base_currency`: call rates-service `GET /internal/rates/rate?from=source_currency&to=base_currency&date=transaction_date`, store the returned `rate` as `base_currency_rate` (`1 source = rate base`), compute `base_currency_amount = amount × rate`. If rates-service is unreachable, all three fields are left `NULL` — the transaction still saves.
3. Pass all three new fields to the transactions-service creation endpoint.

> **Important: `base_currency_rate` direction convention** — always `1 source_currency = X base_currency`. This is NOT always `1 account_currency = X base_currency`. When deriving the account balance equivalent, consumers must check which side was the base.

**Profile update**

When `base_currency` changes via `updateProfile`, the BFF **invalidates** the Redis cache key `user_base_currency:<user_id>` so the new currency takes effect on the next dashboard or accounts request (no stale data window).

**Dashboard query (`dashboard(year, month)`)**

1. Fetch `base_currency` from auth-service (Redis-cached).
2. In parallel:
   - `GET /internal/transactions/totals?year=&month=&base_currency=` → already-converted income/expense totals.
   - `GET /internal/accounts` → list of `{ id, currency, currentBalance }`.
3. For each account where `currency ≠ base_currency`, derive `balanceInBaseCurrency` using a **two-step rate resolution** (see below).
4. `totalAccountBalance = Σ balanceInBaseCurrency`. Accounts for which no rate could be determined are **excluded** from the sum (not substituted with their raw balance) and `ratesStale = true` is set.
5. Return `baseCurrency` and `ratesStale` on `DashboardSummary`.

**Accounts query**

Same two-step rate resolution as the dashboard. Each `Account` gains `balanceInBaseCurrency` and `baseCurrency`.

**Two-step rate resolution for account balance conversion**

To convert `account.currentBalance` (in `account.currency`) to base currency:

1. **Primary — transaction-stored rate:** call `GET /internal/transactions/latest-rate?account_id=X&base_currency_code=Y` on transactions-service. This endpoint runs the following SQL:
   ```sql
   SELECT
     CASE
       WHEN source_currency = :base AND exchange_rate > 0
           THEN 1.0 / exchange_rate          -- source was base; invert to get account→base rate
       ELSE base_currency_rate               -- Case B or account-is-base; rate already in account→base direction
     END
   FROM transactions
   WHERE account_id = :account_id
     AND (
         (source_currency = :base AND exchange_rate > 0)
         OR (base_currency_code = :base AND base_currency_rate IS NOT NULL AND source_currency != :base)
     )
   ORDER BY created_at DESC LIMIT 1
   ```
   This correctly handles the `base_currency_rate` direction inversion for Case A (source=base) transactions. It also handles backfill data which incorrectly stored `exchange_rate` as `base_currency_rate` for those rows.

2. **Fallback — rates-service:** if step 1 returns `null` (no transactions yet on the account, or no matching rows), call `GET /internal/rates/rate?from=account_currency&to=base_currency&date=today`. Note: rates-service uses Frankfurter (ECB) as primary source, which does **not** cover UAH, RUB, and other non-ECB currencies. Configure `OPEN_EXCHANGE_RATES_APP_ID` in `.env` to cover those currencies.

3. **If both fail:** `balanceInBaseCurrency = null`; account excluded from `totalAccountBalance`; `ratesStale = true`.

> **Why transaction-stored rate is preferred over rates-service:** it reflects the exchange rate the user actually used, avoids external API calls for currencies not covered by free providers (UAH, RUB, etc.), and is always available as long as the account has at least one transaction.

---

### 2.4 Frontend Changes

**Files and responsibilities**

| File | Change |
|---|---|
| `features/auth/sign-up/api/sign-up.mutation.ts` | Add `baseCurrency` to `SignUpInput` and to the mutation variables |
| `pages/sign-up/SignUpPage.tsx` | Add `CurrencyPicker` (existing component, already has the 15-currency list) with default `"USD"` |
| `entities/user/api/me.query.ts` (`ME_QUERY`) | Add `baseCurrency` to selected fields |
| `entities/user/model/types.ts` | Add `baseCurrency: string` to `User` type |
| `pages/profile/ProfilePage.tsx` | Add "Base Currency" section; reuse `CurrencyPicker`; wire to `UPDATE_PROFILE_MUTATION` |
| `pages/profile` (mutation) | Add `baseCurrency` to `UpdateProfileInput` and returned `User` fields |
| `entities/dashboard/api/dashboard.query.ts` | Add `baseCurrency` to `DashboardSummary` fragment |
| `pages/dashboard/DashboardPage.tsx` | Pass `baseCurrency` from query result to `formatCurrency()`; show currency label on all four summary tiles |
| `entities/account/api/accounts.query.ts` | Add `balanceInBaseCurrency`, `baseCurrency` to `Account` fragment |
| `entities/account/model/types.ts` | Add `balanceInBaseCurrency?: number`, `baseCurrency?: string` to `Account` type |
| `pages/home/HomePage.tsx` | Render secondary "≈ X [baseCurrency]" label on each account circle using `balanceInBaseCurrency` |
| `features/transaction/EditTransactionDialog.tsx` | Detect Case B (`sourceCurrency ≠ baseCurrency && accountCurrency ≠ baseCurrency`); if Case B: show editable "Conversion rate to [baseCurrency]" field pre-filled from `transaction.baseCurrencyRate`; on save, submit updated rate |

---

## 3. Impact and Risk Analysis

**System dependencies**
- Dashboard and accounts queries now call `GET /internal/transactions/latest-rate` per foreign-currency account (concurrent via `asyncio.gather`). These are cheap indexed DB reads — no external API calls in the common case.
- rates-service is now a **secondary fallback** for account balance conversion (e.g., a brand-new account with no transactions). It is still the primary source for Case B transaction creation.
- auth-service is a dependency for the BFF's transaction-creation and dashboard paths (to retrieve `base_currency`). Cached in Redis with 5-minute TTL.

**Potential risks and mitigations**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Old transactions without `base_currency_amount` produce slightly off dashboard totals | Medium | Backfill migration covers the common USD case; the totals endpoint falls back to `SUM(amount)` for unmigrated rows, which will be correct for USD-base users |
| Backfill migration stored `base_currency_rate = exchange_rate` (wrong direction) for `source_currency = 'USD'` rows | Already handled | The `latest-rate` SQL uses `1 / exchange_rate` for `source_currency = base_currency` rows, correcting the direction at read time |
| Brand-new account (zero transactions) with a currency not covered by Frankfurter (e.g. UAH, RUB) has no rate source | Low | Account is excluded from `totalAccountBalance` until the user creates at least one transaction; `ratesStale = true` signals this on the dashboard. Configure `OPEN_EXCHANGE_RATES_APP_ID` to cover non-ECB currencies via rates-service fallback |
| User changes base currency — historical `base_currency_amount` values are now in the old currency | By design (accepted) | No mitigation needed for V1; the full Base Value Anchor feature will address recalculation |
| rates-service returns `stale: true` (APIs unreachable) | Low | BFF surfaces a subtle "rates may be approximate" note on the dashboard; page is never blocked |
| `isCaseB` in `EditTransactionDialog` excludes transfers — cross-currency transfers do not show the conversion rate field | By design (current V1 scope) | Transfers are excluded because the two-account structure makes the rate field placement ambiguous; revisit if product requires it |

---

## 4. Testing Strategy

**Backend (pytest + integration)**
- auth-service: register with `base_currency = "EUR"` → assert stored value; register without it → assert default `"USD"`.
- transactions-service: create expense with Case B currencies, assert `base_currency_amount` stored correctly; update `base_currency_rate` via edit → assert `base_currency_amount` recomputed.
- BFF dashboard resolver: mock accounts in UAH and USD for a USD-base user → assert `totalAccountBalance` equals UAH balance × rate + USD balance.
- BFF transaction creation: Case A and Case B rate resolution logic (unit-testable in isolation with mocked rates-service).

**E2E (Playwright)**
- Sign up selecting EUR as base currency → dashboard shows "€" labels on all summary tiles.
- Change base currency in profile to GBP → navigate to dashboard → confirm "£" labels.
- Create a UAH expense for a USD-base user → confirm dashboard "Total Expenses" increases in USD.
- Edit a UAH↔RUB transfer for a USD-base user → confirm "Conversion rate to USD" field is visible and pre-filled; edit it → confirm dashboard total changes.
