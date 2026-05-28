# Task List: Account Balance — Historical Cumulative Balance by Month

- **Spec:** `context/spec/011-account-balance-historical-cumulative/`
- **Status:** Ready

---

## Slice 1 — New `/balance` endpoint on `transactions-service`

After this slice: the new endpoint exists and returns the correct cumulative sum. The rest of the app is untouched and continues to work as before.

- [x] Add `get_cumulative_balance(user_id, date_to)` static method to `TransactionRepository` in `services/transactions-service/app/repositories/transaction_repo.py`. The method runs a single SQL aggregate: `SUM(account_amount) WHERE type='income'` minus `SUM(account_amount) WHERE type='expense'` filtered to `created_at <= date_to`. Returns `None` (not `0`) when no qualifying rows exist. **[Agent: python-backend]**
- [x] Add `CumulativeBalanceResponse` Pydantic schema to `services/transactions-service/app/schemas/transaction.py` with one field: `cumulative_balance: float | None`. **[Agent: python-backend]**
- [x] Add `GET /internal/transactions/balance` route to `services/transactions-service/app/routers/transactions.py`. Required query param: `date_to: datetime`. Auth: internal JWT (same pattern as existing routes). Response: `CumulativeBalanceResponse`. **[Agent: python-backend]**
- [x] Verify: start services with `docker-compose up -d`, obtain a valid internal JWT, call the endpoint with `curl` for three cases — (a) a `date_to` after existing transactions → non-null balance returned; (b) a `date_to` before any transactions → `null` returned; (c) only transfer transactions in scope → `null` returned. **[Agent: qa-testing]**

---

## Slice 2 — BFF `dashboard` resolver uses the new endpoint

After this slice: navigating months on the dashboard returns historically accurate balances from the BFF. The frontend still falls back to `$0.00` if the value is null (acceptable interim state).

- [x] Make `total_account_balance` nullable in the `DashboardSummary` Strawberry type in `services/web-bff/app/schema.py`: change `float` → `Optional[float]`. **[Agent: python-backend]**
- [x] In the `dashboard` resolver in `services/web-bff/app/schema.py`, compute the `cutoff` timestamp: for the current month use `datetime.now(UTC)`; for a past month use the first moment of the following month (exclusive upper bound). Remove the existing backwards-projection formula. Call `GET /internal/transactions/balance?date_to=<cutoff>` and map the result to `total_account_balance`. **[Agent: python-backend]**
- [x] Verify: using the GraphQL Playground (or `curl`) against the BFF, run the `dashboard` query for (a) the current month → returns a float; (b) a past month with known transactions → returns the correct historical sum; (c) a month before the first transaction → returns `null`. **[Agent: qa-testing]**

---

## Slice 3 — Frontend renders null as a no-data indicator

After this slice: the feature is fully complete. A user navigating to a month before any transactions sees `—` instead of `$0.00`.

- [x] In `frontend/src/entities/dashboard/api/dashboard.query.ts`, update the TypeScript type for `totalAccountBalance` from `number` to `number | null`. **[Agent: react-frontend]**
- [x] In `frontend/src/pages/dashboard/DashboardPage.tsx`, update the "Account Balance" `SummaryCard` render logic: if `totalAccountBalance === null`, display `—` (em dash); if it is a number (including `0`), display `formatCurrency(totalAccountBalance)` as before. **[Agent: react-frontend]**
- [x] Write a Playwright E2E test covering three scenarios: (a) navigate to a past month with recorded transactions → "Account Balance" card shows the correct historical figure; (b) navigate to a month before the first transaction → card shows `—`; (c) return to the current month → card shows the live cumulative total. **[Agent: qa-testing]**
- [x] Run the Playwright test suite to confirm all three scenarios pass and no regressions appear in existing dashboard tests. **[Agent: qa-testing]**
