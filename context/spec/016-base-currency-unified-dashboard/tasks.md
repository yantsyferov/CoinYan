# Tasks: Base Currency & Unified Dashboard

> Spec: `context/spec/016-base-currency-unified-dashboard/`
> Each slice leaves the application in a fully runnable state.

---

## Slice 1 — `base_currency` stored on the user; selectable at sign-up and in profile

**Goal:** A user can pick their base currency at sign-up; existing users default to USD silently; the setting is visible and changeable in the profile. No dashboard changes yet.

- [x] Add `base_currency` column (`CHAR(3)`, `NOT NULL`, `DEFAULT 'USD'`) to the auth-service `users` table via a new Alembic migration; include a data migration that sets `'USD'` for all existing rows. **[Agent: postgres-database]**
- [x] Update auth-service `RegisterRequest` to include optional `base_currency` (default `'USD'`, 3-char validation). Return `base_currency` from `GET /internal/users/me`. Accept `base_currency` in `PATCH /internal/users/me`. **[Agent: python-backend]**
- [x] Update BFF: add optional `baseCurrency` to `SignUpInput` (forward to auth-service). Add `baseCurrency: String!` to the `User` Strawberry type and `me` query. Add `baseCurrency` to `UpdateProfileInput` and forward to auth-service on profile update. **[Agent: python-backend]**
- [x] Frontend — sign-up: add existing `CurrencyPicker` component (default `'USD'`) to `SignUpPage.tsx`; add `baseCurrency` to `sign-up.mutation.ts` variables. **[Agent: react-frontend]**
- [x] Frontend — profile: add a "Base Currency" section to `ProfilePage.tsx` using `CurrencyPicker`; add `baseCurrency` to `ME_QUERY`, `UPDATE_PROFILE_MUTATION`, and the `User` type. **[Agent: react-frontend]**
- [x] **Verify Slice 1:** Start services (`docker-compose up -d`, `npm run dev`). Using Playwright: sign up with EUR → navigate to profile → confirm "EUR" is shown. Change to GBP and save → confirm "GBP". Sign in as an existing (pre-migration) user → confirm "USD" appears in profile. **[Agent: qa-testing]**

---

## Slice 2 — Dashboard income, expenses, and net balance shown in base currency (Case A)

**Goal:** The four summary tiles on the dashboard (Total Income, Total Expenses, Net Balance) display figures in the user's base currency. This slice covers the common case where at least one currency in the transaction is the base currency.

- [x] Add `base_currency_code` (`CHAR(3)`, nullable), `base_currency_rate` (`NUMERIC(18,6)`, nullable), and `base_currency_amount` (`NUMERIC(19,4)`, nullable) columns to the transactions-service `transactions` table via a new Alembic migration. Backfill: for existing rows where `account_currency = 'USD'` or `source_currency = 'USD'`, set `base_currency_code = 'USD'`, derive `base_currency_rate` from the existing `exchange_rate`, and set `base_currency_amount = account_amount`. **[Agent: postgres-database]**
- [x] Update transactions-service creation endpoints (expense, income, transfer) to accept and persist `base_currency_code`, `base_currency_rate`, `base_currency_amount`. Include these fields in the `GET /internal/transactions/{id}` response. **[Agent: python-backend]**
- [x] Update `GET /internal/transactions/totals`: add optional `base_currency` query param. When present, `SUM(base_currency_amount)` per group for rows where `base_currency_code = :base_currency`; fall back to `SUM(amount)` for rows where `base_currency_amount IS NULL`. **[Agent: python-backend]**
- [x] Update BFF transaction-creation logic: fetch user's `base_currency` from auth-service (cache by `user_id` in Redis, short TTL). Implement Case A detection — when `source_currency` or `account_currency` equals `base_currency`, derive `base_currency_rate` and compute `base_currency_amount`; pass all three fields to transactions-service. **[Agent: python-backend]**
- [x] Update BFF `dashboard` resolver: pass `base_currency` as a query param to the transactions-totals request. Add `baseCurrency: String!` to the `DashboardSummary` Strawberry type and return it. **[Agent: python-backend]**
- [x] Frontend: add `baseCurrency` to `DASHBOARD_QUERY` and `DashboardSummary` type. Update `DashboardPage.tsx` to pass `baseCurrency` to `formatCurrency()` on all summary tiles so the correct symbol/code is shown. **[Agent: react-frontend]**
- [x] **Verify Slice 2:** Using Playwright: as a USD-base user, create a USD income entry and a USD expense entry → confirm the dashboard shows the correct amounts with `$` / `USD` labels. Switch to an EUR-base user → confirm the same tiles show `€`. **[Agent: qa-testing]**

---

## Slice 3 — Case B: cross-currency transactions with auto-filled, user-editable base-currency rate

**Goal:** When a transaction involves two currencies neither of which is the base currency (e.g., UAH↔RUB for a USD user), the BFF auto-fills `base_currency_rate` from rates-service. The user can see and override this rate in the transaction edit screen.

- [x] Update BFF transaction-creation logic: implement Case B — when neither `source_currency` nor `account_currency` equals `base_currency`, call `GET /internal/rates/rate?from=source_currency&to=base_currency&date=transaction_date` on rates-service; store the returned rate as `base_currency_rate` and compute `base_currency_amount`. **[Agent: python-backend]**
- [x] Update transactions-service `PUT /internal/transactions/{id}` edit endpoint: accept `base_currency_rate` as an editable field; recompute `base_currency_amount = amount × base_currency_rate` server-side on receipt. **[Agent: python-backend]**
- [x] Update BFF transaction-edit mutation: forward `baseCurrencyRate` to the transactions-service edit endpoint. Add `baseCurrencyCode`, `baseCurrencyRate`, `baseCurrencyAmount` to the `Transaction` GraphQL type and relevant query/mutation responses. **[Agent: python-backend]**
- [x] Frontend — `EditTransactionDialog.tsx`: detect Case B (`sourceCurrency ≠ baseCurrency && accountCurrency ≠ baseCurrency`). When true, display an editable "Conversion rate to [baseCurrency]" field pre-filled from `transaction.baseCurrencyRate` in `1 [sourceCurrency] = X [baseCurrency]` format. On save, submit the updated `baseCurrencyRate`. **[Agent: react-frontend]**
- [x] **Verify Slice 3:** Using Playwright: as a USD-base user with UAH and RUB accounts, create a UAH→RUB transfer → open the edit dialog → confirm the "Conversion rate to USD" field is visible and pre-filled → change the rate → save → confirm the dashboard total updates accordingly. **[Agent: qa-testing]**

---

## Slice 4 — Dashboard total account balance & per-account base-currency equivalent

**Goal:** The dashboard shows a single Total Balance tile (all accounts summed in base currency using today's live rate). Each account circle on the home screen shows a secondary "≈ X [base currency]" label.

- [x] Update BFF `accounts` resolver: after fetching accounts from accounts-service, for each account where `currency ≠ base_currency`, call rates-service with today's date for a live rate and compute `balanceInBaseCurrency = currentBalance × rate`. If any call returns `stale: true`, set a `ratesStale` flag. Add `balanceInBaseCurrency: Float` and `baseCurrency: String` to the `Account` Strawberry type. **[Agent: python-backend]**
- [x] Update BFF `dashboard` resolver: compute `totalAccountBalance = Σ balanceInBaseCurrency` across all accounts (replacing the current transactions-balance endpoint call). Expose `ratesStale: Boolean` on `DashboardSummary`. **[Agent: python-backend]**
- [x] Frontend — `ACCOUNTS_QUERY` and `Account` type: add `balanceInBaseCurrency` and `baseCurrency` fields. Update `HomePage.tsx` account circle rendering to show a secondary "≈ X [baseCurrency]" label using `balanceInBaseCurrency`; omit the label when `currency === baseCurrency`. **[Agent: react-frontend]**
- [x] Frontend — `DashboardPage.tsx`: render the `totalAccountBalance` tile with the base currency symbol/code. Show a subtle "rates may be approximate" note when `ratesStale` is `true`. **[Agent: react-frontend]**
- [x] **Verify Slice 4:** Using Playwright: as a USD-base user with a UAH account and a USD account, confirm each account circle on the home page shows an "≈ $X USD" secondary label; confirm the dashboard "Total Balance" tile shows the combined value in USD. Navigate to profile, change base currency to EUR, return to the dashboard → confirm all labels update to EUR. **[Agent: qa-testing]**
