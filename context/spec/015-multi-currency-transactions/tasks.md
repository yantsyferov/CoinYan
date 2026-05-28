# Tasks: Multi-Currency Transactions

- **Spec Directory:** `context/spec/015-multi-currency-transactions/`
- **Functional Spec:** `functional-spec.md`
- **Technical Spec:** `technical-considerations.md`

---

## Slice 1: Exchange rate query available in the app

The foundation everything else builds on. After this slice, any part of the app can ask for a live exchange rate between two currencies.

- [x] Scaffold the `rates-service` directory with a FastAPI project structure, `Dockerfile`, and `requirements.txt` matching the pattern of existing services. **[Agent: devops-infra]**
- [x] Add `rates-service` and `rates-redis` containers to `docker-compose.yml`; add `RATES_SERVICE_URL` env var to the BFF container. **[Agent: devops-infra]**
- [x] Implement the `GET /rate?from=X&to=Y` endpoint in `rates-service` (no Redis yet): route today's date to Open Exchange Rates API (`OPEN_EXCHANGE_RATES_APP_ID` env var); use Frankfurter as the fallback. When `from == to`, return `rate: 1.0` immediately. **[Agent: python-backend]**
- [x] In the BFF: add `RATES_SERVICE_URL` to `config.py`; add the `ExchangeRateResult` Strawberry type (`from`, `to`, `date`, `rate`, `stale`) and the `exchangeRate(from, to, date)` GraphQL query that proxies to the rates-service. **[Agent: python-backend]**
- [x] Verify: `docker-compose up -d` starts all services without errors. `curl "http://localhost:8006/rate?from=USD&to=UAH"` returns `{ "rate": <number> }`. Query `{ exchangeRate(from: "USD", to: "UAH") { rate stale } }` via the BFF GraphQL endpoint returns a valid rate. **[Agent: qa-testing]**

---

## Slice 2: Currency picker on category and income source creation

Users can now choose a currency when creating an expense category or income source. Existing records default to USD.

- [x] Write and run Alembic migration in `categories-service`: add `currency VARCHAR(3) NOT NULL DEFAULT 'USD'` to both `expense_categories` and `income_sources` tables. **[Agent: postgres-database]**
- [x] Update `categories-service` Pydantic schemas: add optional `currency` (default `'USD'`) to `CreateCategoryRequest` and `UpdateCategoryRequest`; add `currency` to `CategoryResponse` and `IncomeSourceResponse`. **[Agent: python-backend]**
- [x] Update BFF: add `currency: str` to `Category` and `IncomeSource` Strawberry types; add optional `currency: str` to `CreateCategoryInput`, `UpdateCategoryInput`, `CreateIncomeSourceInput`. **[Agent: python-backend]**
- [x] Build the `CurrencyPicker` component in `frontend/src/shared/ui/CurrencyPicker.tsx` with a `SUPPORTED_CURRENCIES` constant in `frontend/src/shared/lib/currencies.ts`. **[Agent: react-frontend]**
- [x] Wire `CurrencyPicker` into the expense category creation modal and the income source creation modal; update the corresponding GraphQL mutations to pass the selected `currency`. Update the `Category` TypeScript type to include `currency: string`. **[Agent: react-frontend]**
- [x] Verify: Create a new expense category with UAH — it appears in the categories list and reflects UAH currency. Create a new income source with EUR — same. Pre-existing categories remain functional with their default USD currency. **[Agent: qa-testing]**

---

## Slice 3: Reactive three-field form for cross-currency expenses

The core of the feature. A user dragging a USD account onto a UAH category sees source amount, exchange rate, and target amount — all reactive and pre-filled.

- [x] Write and run Alembic migration in `transactions-service`: add `source_currency VARCHAR(3) NOT NULL DEFAULT 'USD'`, `target_currency VARCHAR(3) NOT NULL DEFAULT 'USD'`, `rate_is_custom BOOLEAN NOT NULL DEFAULT FALSE` to the `transactions` table. Backfill: `source_currency = account_currency` for all rows; `target_currency = 'USD'` for expense rows; `target_currency = account_currency` for income rows. **[Agent: postgres-database]**
- [x] Update `transactions-service`: add the three new fields to the SQLAlchemy model, `CreateTransactionRequest`, and `TransactionResponse` Pydantic schemas. **[Agent: python-backend]**
- [x] Update BFF: add `sourceAmount`, `sourceCurrency`, `targetAmount`, `targetCurrency`, `rateIsCustom` to the `Transaction` Strawberry type; add `sourceCurrency`, `targetCurrency`, `rateIsCustom` to `CreateExpenseTransactionInput`. **[Agent: python-backend]**
- [x] Create the `useExchangeRate(from, to, date)` Apollo hook in `frontend/src/entities/rate/api/useExchangeRate.ts` wrapping the `EXCHANGE_RATE_QUERY`; skips the query when `from === to`. **[Agent: react-frontend]**
- [x] Redesign `TransactionModal` for expense type: add `fromCurrency` and `toCurrency` props; remove the hardcoded `BASE_CURRENCY = 'USD'` logic; show three-field layout when currencies differ (single-field when they match); implement the `lastEdited` reactive state machine (`source` → recalculate target; `rate` → recalculate target; `target` → recalculate rate, set `rateIsCustom = true`); pre-fill rate via `useExchangeRate`. **[Agent: react-frontend]**
- [x] Update the home page drag handler to resolve and pass `fromCurrency` (account's currency) and `toCurrency` (category's base currency) into `TransactionModal`. Update the expense mutation payload to include `sourceCurrency`, `targetCurrency`, `exchangeRate`, `accountAmount` (= target amount), `rateIsCustom`. **[Agent: react-frontend]**
- [x] Verify: Drag a USD account onto a UAH expense category → three-field form appears with rate pre-filled → enter source amount → target auto-calculates → confirm → expense is created → account balance decreases in USD, category total increases in UAH. Drag a USD account onto a USD category → single amount field only. **[Agent: qa-testing]**

---

## Slice 4: Reactive three-field form for cross-currency income

Income from a EUR income source landing in a USD account now shows the same reactive three-field form.

- [x] Update BFF `CreateIncomeTransactionInput`: add `sourceCurrency`, `targetCurrency`, `rateIsCustom` fields. **[Agent: python-backend]**
- [x] Update `TransactionModal` for income type: pass the income source's `currency` as `fromCurrency` and the account's `currency` as `toCurrency`. Update home page drag handler to pass income source currency. Update income mutation payload with the new fields. **[Agent: react-frontend]**
- [x] Update `INCOME_SOURCES_QUERY` and the `IncomeSource` TypeScript type to include `currency`. **[Agent: react-frontend]**
- [x] Verify: Drag a EUR income source onto a USD account → three-field form appears → rate pre-filled (EUR→USD) → enter amount → confirm → income source total increases in EUR, account balance increases in USD equivalent. Drag a USD income source onto a USD account → single field only. **[Agent: qa-testing]**

---

## Slice 5: Reactive three-field form for cross-currency transfers

Account-to-account transfers with different currencies now use the same auto-filled three-field experience, replacing the old hardcoded rate default.

- [x] Update `TransferModal`: apply `useExchangeRate` to pre-fill the exchange rate when the two accounts have different currencies; remove the hardcoded default rate of `'1'`; render the three-field reactive layout using the same `lastEdited` state machine pattern. **[Agent: react-frontend]**
- [x] Verify: Drag a USD account onto a UAH account → three-field transfer form appears with rate pre-filled → confirm → USD account decreases by source amount, UAH account increases by target amount. Drag a USD account onto another USD account → single amount field only. **[Agent: qa-testing]**

---

## Slice 6: Custom rate label and reset button

Users who override the suggested rate see a clear "Custom" label and can revert to the suggested rate in one tap.

- [x] In `TransactionModal` and `TransferModal`: render a "Custom" label on the Exchange Rate field when `rateIsCustom` is true; render a "Reset to suggested rate" control below the field when the label is active; wire the reset action to re-invoke `useExchangeRate` and set `rateIsCustom = false`. **[Agent: react-frontend]**
- [x] Verify: In a cross-currency expense form, manually edit the Exchange Rate → "Custom" label and reset control appear. Manually edit the Target Amount → same. Click "Reset to suggested rate" → rate reverts to the auto-suggested value, Target Amount recalculates, and the "Custom" label disappears. **[Agent: qa-testing]**

---

## Slice 7: Historical rate suggestion banner on date change

When the user changes the transaction date, the app offers the correct historical rate for that date without silently overwriting their current value.

- [x] Extend `rates-service`: when the `date` query parameter is present and is not today, route the request to the Frankfurter API (`https://api.frankfurter.app/{date}?from=X&to=Y`) instead of OXR. **[Agent: python-backend]**
- [x] Verify that the BFF `exchangeRate` query correctly passes the `date` param through to the rates-service `/rate` endpoint. **[Agent: python-backend]**
- [x] In `TransactionModal` and `TransferModal`: watch the `date` field for changes; when it changes and currencies differ, fetch the rate for the new date via `useExchangeRate`; if the returned rate differs from the current rate value, display an inline dismissable suggestion banner ("Historical rate for [date]: [X.XX]. Apply it?"); implement Accept (update rate field, clear Custom label) and Dismiss (no change) actions. **[Agent: react-frontend]**
- [x] Verify: Open a cross-currency expense form → change date to 2023-01-01 → suggestion banner appears with the historical rate → accept → Exchange Rate and Target Amount update. Change date again → new banner appears → dismiss → rate unchanged. **[Agent: qa-testing]**

---

## Slice 8: Edit existing cross-currency transaction

All three fields — source amount, rate, and target — can now be corrected after a transaction is saved. The critical V1 hardcoded bug is fixed.

- [x] Fix `update_transaction` in `services/transactions-service/app/repositories/transaction_repo.py`: remove the hardcoded `account_amount = amount` line; respect incoming `exchange_rate`, `account_amount`, and `rate_is_custom` values when provided. **[Agent: python-backend]**
- [x] Extend `UpdateTransactionRequest` (transactions-service) to accept optional `exchange_rate`, `account_amount`, `rate_is_custom`. Update the router to pass these through to the repository. **[Agent: python-backend]**
- [x] Update BFF `UpdateTransactionInput`: add optional `exchangeRate`, `targetAmount`, `rateIsCustom`. **[Agent: python-backend]**
- [x] Update the edit transaction form/modal in the frontend: pre-fill all three fields from the stored transaction (`amount` → source, `accountAmount` → target, `exchangeRate`); show "Custom" label if `rateIsCustom` is true; apply the same reactive rules; include the new fields in the update mutation payload. **[Agent: react-frontend]**
- [x] Verify: Open the edit form on a cross-currency expense → all three fields are pre-filled correctly → change the Exchange Rate → Target Amount recalculates → save → transaction updated with the new rate and target amount → account balance reflects the change. **[Agent: qa-testing]**

---

## Slice 9: Category and income source per-currency totals

Category detail pages show the monthly total in the category's base currency plus a breakdown by each currency used.

- [x] Add `GET /transactions/totals-by-currency` endpoint to `transactions-service`: accepts `entity_type` (`category` / `income_source`), `entity_id`, `month` (YYYY-MM); returns `{ totals: [{ currency, amount }] }` by grouping on `source_currency` and summing `amount`. **[Agent: python-backend]**
- [x] Add `categoryTotalsByCurrency(categoryId, month)` and `incomeTotalsByCurrency(incomeSourceId, month)` GraphQL queries to the BFF; add the `CurrencyTotal` Strawberry type (`currency: str`, `amount: float`). **[Agent: python-backend]**
- [x] Update `ExpenseCategoryDetailPage`: fetch `categoryTotalsByCurrency` and render the per-currency breakdown below the headline monthly total. Update `IncomeSourceDetailPage` the same way using `incomeTotalsByCurrency`. **[Agent: react-frontend]**
- [x] Update `EXPENSE_CATEGORIES_QUERY` and `INCOME_SOURCES_QUERY` on the frontend to include the `currency` field. **[Agent: react-frontend]**
- [x] Verify: Log one expense from a USD account and one from a UAH account against the same UAH-denominated category → the category detail page shows the headline total in UAH and a per-currency breakdown listing both the USD total and the UAH total separately. **[Agent: qa-testing]**

---

## Slice 10: Redis caching and stale rate fallback

Rates are cached to minimise external API calls; when the API is unreachable the form shows a stale rate with a clear notice.

- [x] Update `docker-compose.yml`: ensure the `rates-redis` Redis service is fully configured; set `REDIS_URL` env var on the `rates-service` container. **[Agent: devops-infra]**
- [x] Implement Redis caching in `rates-service` (`rate_cache.py`): cache key `rate:{from}:{to}:{date}`, TTL 1 hour for today's rate, 30 days for historical rates. On cache hit → return cached value. On cache miss + external API failure → return the most recently stored entry for that pair with `stale: true`; if no cached entry exists, return `null` rate. **[Agent: python-backend]**
- [x] In `useExchangeRate` hook and the `TransactionModal`/`TransferModal`: when the query response has `stale: true`, display a "Rate may be outdated" notice on the Exchange Rate field. **[Agent: react-frontend]**
- [x] Verify: Call `GET /rate?from=USD&to=UAH` twice — the second response is faster (cache hit, visible in service logs). Temporarily disable the OXR and Frankfurter endpoints → the form pre-fills with the last cached rate and shows a "Rate may be outdated" notice. **[Agent: qa-testing]**
