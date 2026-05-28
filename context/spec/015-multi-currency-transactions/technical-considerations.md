<!--
This document describes HOW to build the feature at an architectural level.
It is NOT a copy-paste implementation guide.
-->

# Technical Specification: Multi-Currency Transactions

- **Functional Specification:** `context/spec/015-multi-currency-transactions/functional-spec.md`
- **Status:** Completed
- **Author(s):** CoinYan Team

---

## 1. High-Level Technical Approach

This feature introduces four categories of change across the full stack:

1. **New `rates-service`** — a dedicated microservice that fetches fiat exchange rates from Open Exchange Rates (current rates) and Frankfurter API (historical rates), caches results in its own Redis instance, and exposes a simple REST endpoint to the BFF.
2. **`transactions-service` data model extension** — add explicit `source_currency`, `target_currency`, and `rate_is_custom` columns; fix the edit endpoint to allow rate and amount updates.
3. **`categories-service` data model extension** — add `currency` field to expense categories and income sources; add a per-currency totals endpoint.
4. **BFF + Frontend** — new `exchangeRate` GraphQL query wired to the rates-service; TransactionModal redesigned into a reactive three-field form; currency picker added to category/income source creation.

All services affected require Alembic migrations. No existing service contracts are broken — only additive changes to existing schemas.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 New `rates-service` Microservice

**Purpose:** Single source of truth for all exchange rate lookups. Decouples rate-fetching logic from the BFF.

**Technology:** Python + FastAPI, same stack as other services. Uses its own Redis instance for caching.

**External APIs (hybrid strategy):**
- **Open Exchange Rates API** — current rates (`/latest.json?app_id=...`). Used for today's rate. Free tier covers current rates. Set as `OPEN_EXCHANGE_RATES_APP_ID` env var.
- **Frankfurter API** (`api.frankfurter.app`) — historical rates by date. Free, no key required. Used for all requests where `date` is in the past. Covers 170+ currencies back to 1999 (including UAH from ~2004).

**Redis caching strategy:**
- Cache key pattern: `rate:{from_currency}:{to_currency}:{date}` (date in `YYYY-MM-DD` format; use `today` as the key for current-date requests)
- TTL for today's rate: 1 hour (OXR updates once daily; short TTL ensures freshness)
- TTL for past-date rates: 30 days (historical rates are immutable — long TTL minimizes external API calls)
- On cache miss + API failure: return the most recent cached entry for that currency pair with a `stale: true` flag in the response

**REST endpoint exposed to BFF:**

| Method | Path | Query Params | Response |
|---|---|---|---|
| GET | `/rate` | `from` (currency code), `to` (currency code), `date` (optional ISO date) | `{ from, to, date, rate, stale }` |

When `from == to`, return `rate: 1.0` immediately without any external call.

**New files/paths:**
- `services/rates-service/` — new directory, same FastAPI project structure as other services
- `services/rates-service/app/routers/rates.py` — the `/rate` endpoint
- `services/rates-service/app/services/rate_fetcher.py` — OXR + Frankfurter fetch logic with date-routing
- `services/rates-service/app/services/rate_cache.py` — Redis cache read/write helpers
- `services/rates-service/app/config.py` — `OPEN_EXCHANGE_RATES_APP_ID`, `REDIS_URL`

**Infrastructure:** Add `rates-service` container and `rates-redis` Redis instance to `docker-compose.yml`. Add `RATES_SERVICE_URL` env var to the BFF container.

---

### 2.2 `transactions-service` — Data Model Changes

**New columns on the `transactions` table:**

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `source_currency` | `VARCHAR(3)` | No | `'USD'` | Currency of the entity money comes from |
| `target_currency` | `VARCHAR(3)` | No | `'USD'` | Currency of the entity money goes to |
| `rate_is_custom` | `BOOLEAN` | No | `false` | True when user manually overrode the suggested rate |

Existing columns are **semantically re-anchored** (no rename in this release):
- `amount` → treated as **source amount** (debited from source entity, in `source_currency`)
- `account_amount` → treated as **target amount** (credited to target entity, in `target_currency`)
- `account_currency` remains for backward compatibility but is superseded by `source_currency` for new records

**Alembic migration** in `transactions-service`:
- Add the three new columns
- Backfill `source_currency = account_currency` for all existing rows
- Backfill `target_currency = 'USD'` for existing expense rows; `target_currency = account_currency` for existing income rows
- Set `rate_is_custom = false` for all existing rows

**Updated Pydantic schemas:**

`CreateTransactionRequest` — add `source_currency` (String, default `'USD'`), `target_currency` (String, default `'USD'`), `rate_is_custom` (bool, default `false`).

`UpdateTransactionRequest` — currently only accepts `amount`, `note`, `transaction_date`. Extend to also accept `exchange_rate` (optional Decimal), `account_amount` (optional Decimal), `rate_is_custom` (optional bool).

`TransactionResponse` — add `source_currency`, `target_currency`, `rate_is_custom`.

**Critical fix in `transaction_repo.py`:** Remove the hardcoded `account_amount = amount` line in `update_transaction` (a V1 comment in the codebase explicitly marks this as a known limitation). The update logic must respect the incoming `account_amount` and `exchange_rate` values when provided.

---

### 2.3 `categories-service` — Data Model Changes

**New column on `expense_categories` table:**

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `currency` | `VARCHAR(3)` | No | `'USD'` | Base currency for this category's totals |

**New column on `income_sources` table:**

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `currency` | `VARCHAR(3)` | No | `'USD'` | Currency this income source is denominated in |

**Alembic migration** in `categories-service`: add both columns with `'USD'` as default for all existing rows.

**Updated Pydantic schemas** in `categories-service`:
- `CreateCategoryRequest` — add optional `currency` (default `'USD'`)
- `UpdateCategoryRequest` — add optional `currency`
- `CategoryResponse` / `IncomeSourceResponse` — add `currency` to response shape

**New endpoint in `transactions-service`** for per-currency aggregation:

| Method | Path | Query Params | Response |
|---|---|---|---|
| GET | `/transactions/totals-by-currency` | `entity_type` (`category` / `income_source`), `entity_id`, `month` (YYYY-MM) | `{ totals: [{ currency: str, amount: Decimal }] }` |

Groups transactions by `source_currency`, summing `amount` (source amount) per currency for the given entity and month period.

---

### 2.4 `web-bff` — Schema and Configuration Changes

**New env var:** `RATES_SERVICE_URL` — base URL for the rates-service.

**New GraphQL query:**

```
exchangeRate(from: String!, to: String!, date: String): ExchangeRateResult
```

`ExchangeRateResult` type fields: `from: String!`, `to: String!`, `date: String!`, `rate: Float!`, `stale: Boolean!`

BFF resolves this by calling `GET {RATES_SERVICE_URL}/rate?from=...&to=...&date=...`.

**Updated `Transaction` Strawberry type** — add fields: `sourceAmount: Float`, `sourceCurrency: String`, `targetAmount: Float`, `targetCurrency: String`, `rateIsCustom: Boolean`.

**Updated `CreateExpenseTransactionInput` and `CreateIncomeTransactionInput`** — add: `sourceCurrency: str`, `targetCurrency: str`, `rateIsCustom: bool` (default `false`).

**Updated `UpdateTransactionInput`** — add: `exchangeRate: Optional[float]`, `targetAmount: Optional[float]`, `rateIsCustom: Optional[bool]`.

**Updated `Category` and `IncomeSource` Strawberry types** — add `currency: str` field.

**Updated `CreateCategoryInput` / `UpdateCategoryInput`** — add optional `currency: str` field.

**New GraphQL queries for per-currency totals:**

```
categoryTotalsByCurrency(categoryId: ID!, month: String!): [CurrencyTotal!]!
incomeTotalsByCurrency(incomeSourceId: ID!, month: String!): [CurrencyTotal!]!
```

`CurrencyTotal` type: `{ currency: String!, amount: Float! }`.
BFF resolves these by calling the new `transactions-service` totals endpoint.

---

### 2.5 Frontend — Component and Logic Changes

**New `CurrencyPicker` component** — `frontend/src/shared/ui/CurrencyPicker.tsx`
- Searchable dropdown listing ISO 4217 currency codes with symbols
- Initial supported set defined in a `SUPPORTED_CURRENCIES` constant in `shared/lib/currencies.ts` (e.g. USD, EUR, GBP, UAH, CHF, JPY, PLN, CZK — expandable list)
- Props: `value: string`, `onChange: (code: string) => void`, `disabled?: boolean`

**New `useExchangeRate` hook** — `frontend/src/entities/rate/api/useExchangeRate.ts`
- Wraps the new `EXCHANGE_RATE_QUERY` Apollo query
- Params: `from: string`, `to: string`, `date: string` (ISO)
- Returns: `{ rate: number | null, stale: boolean, loading: boolean }`
- Skips the Apollo query entirely when `from === to`

**Redesign `TransactionModal`** — `frontend/src/features/transaction/TransactionModal.tsx`
- New props: `fromCurrency: string`, `toCurrency: string` (actual currencies of the two entities — passed from the home page drag context)
- Remove hardcoded `BASE_CURRENCY = 'USD'` logic
- Render three-field layout when `fromCurrency !== toCurrency`; single-field layout when they match
- Local state for the three fields and a `lastEdited: 'source' | 'rate' | 'target'` flag to drive recalculation direction (prevents circular update loops):
  - `lastEdited = 'source'` → recalculate `targetAmount = sourceAmount × exchangeRate`
  - `lastEdited = 'rate'` → recalculate `targetAmount = sourceAmount × exchangeRate`
  - `lastEdited = 'target'` → recalculate `exchangeRate = targetAmount ÷ sourceAmount`, set `rateIsCustom = true`
- Rate is pre-filled via `useExchangeRate(fromCurrency, toCurrency, selectedDate)`
- When `date` field changes: re-invoke `useExchangeRate` for the new date and display an inline suggestion banner if the new rate differs from the current rate field value. User must explicitly accept or dismiss — no auto-apply.
- Mutation payload includes: `sourceCurrency`, `targetCurrency`, `exchangeRate`, `accountAmount` (= targetAmount), `rateIsCustom`

**Update `TransferModal`** — apply the same `useExchangeRate` hook and suggestion banner to the existing cross-currency transfer form. Remove the hardcoded default rate of `'1'`.

**Update `CreateCategoryModal`** — add `CurrencyPicker` for base currency selection. Wire to `CREATE_EXPENSE_CATEGORY` and `CREATE_INCOME_SOURCE` mutations which now accept `currency`.

**Update TypeScript types:**
- `Transaction` in `frontend/src/entities/transaction/model/types.ts`: add `sourceAmount?: number`, `sourceCurrency?: string`, `targetAmount?: number`, `targetCurrency?: string`, `rateIsCustom?: boolean`
- `Category` in `frontend/src/entities/category/model/types.ts`: add `currency: string`

**Update `ExpenseCategoryDetailPage` and `IncomeSourceDetailPage`** — fetch `categoryTotalsByCurrency` / `incomeTotalsByCurrency` and render the per-currency breakdown below the headline monthly total.

---

## 3. Impact and Risk Analysis

**System Dependencies:**
- All three transaction types (expense, income, transfer) are affected — both TransactionModal and TransferModal need updating.
- The `categories-service` migration (adding `currency`) must complete before the BFF can serve updated `Category` types used by the currency picker pre-fill.
- The `rates-service` must be running and reachable before the frontend can pre-fill exchange rates. On failure, the field falls back to empty and the user enters manually.

**Potential Risks & Mitigations:**

| Risk | Mitigation |
|---|---|
| Alembic migration on `transactions` table breaks existing queries | Add columns with safe defaults (`'USD'`, `false`). Backfill is non-destructive. All existing query paths continue working. |
| Open Exchange Rates free tier has no historical endpoint | Route all requests where `date ≠ today` to Frankfurter (free, no key). OXR used only for today's rate on free tier. Upgrade to OXR Bootstrap plan when historical accuracy beyond Frankfurter's coverage is needed. |
| `update_transaction` hardcodes `account_amount = amount` | This must be fixed as part of this spec. No migration needed — code-only fix in `transaction_repo.py`. |
| Frontend re-render loops from reactive three-field state | `lastEdited` flag ensures only one direction of update fires per user input event. Target-field changes never trigger a second source-side recalculation. |
| Rate unavailability on form open | `useExchangeRate` returns `{ rate: null }` on full failure. The rate field is left empty. The Confirm button stays disabled until the user fills it manually. |
| Historical UAH rates before ~2004 | ECB/Frankfurter only has UAH data from ~2004. For older dates, the field will be left empty (no data available). This is acceptable — very few users will enter transactions dated pre-2004. |

---

## 4. Testing Strategy

**Backend (pytest + httpx):**
- `rates-service`: unit tests for cache hit/miss logic; integration tests for the `/rate` endpoint covering: same-currency pair returns `1.0`, today's rate fetched from OXR mock, historical date routed to Frankfurter mock, stale fallback served when both APIs fail.
- `transactions-service`: integration test for `UpdateTransaction` with rate/amount fields now respected — regression guard against the old hardcoded `account_amount = amount` behavior.
- `categories-service`: migration test confirming `currency` defaults to `'USD'` for all pre-existing records.

**Frontend (Playwright E2E):**
- Cross-currency expense: drag a USD account onto a UAH category → three-field form appears with pre-filled rate → edit Target Amount → "Custom" label appears on rate → "Reset to suggested rate" restores the original rate.
- Same-currency expense: drag USD account onto USD category → single amount field only, no rate or target fields visible.
- Date change banner: change date on an open cross-currency form → banner appears with historical rate → accept → rate and target update; dismiss → no change.
- Category creation with currency: create a new category with UAH currency → home page circle shows UAH total → detail page shows per-currency breakdown after logging transactions in multiple currencies.
- Rate unavailable fallback: mock the `exchangeRate` GraphQL query to return null → rate field is empty → Confirm button disabled until rate is entered manually.
