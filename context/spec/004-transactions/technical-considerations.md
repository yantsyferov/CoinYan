# Technical Specification: Transactions

- **Status:** Completed

---

## 1. High-Level Technical Approach

A `transactions-service` (port **8004**) with its own PostgreSQL database (`transactions-db`, port **5435**) stores all transaction records. The BFF orchestrates two-phase writes: it posts to `transactions-service` and then calls `accounts-service PATCH /{id}/balance` with a delta in the account's own currency.

The frontend home page has three sections in this order: **Income Sources → Accounts → Expense Categories**, using drag-and-drop powered by `@dnd-kit/core`. Each section item shows a monetary subtitle (total or balance), formatted with currency symbol and two decimal places.

**Transaction types:**
- **Expense**: user drags an Account → Expense Category. Account balance decreases by `account_amount` (in account currency).
- **Income**: user drags an Income Source → Account. Account balance increases by `account_amount` (in account currency).

**Monthly budget cycle:** All transaction queries default to the **current calendar month**. Account balances carry over month-to-month (they are a running total, not reset). Income source totals and expense category totals reset at the start of each new month because they are computed by filtering transactions to the current month range.

---

## 2. Data Model

**Table: `transactions`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID NOT NULL | owner |
| `type` | VARCHAR(10) NOT NULL | `'expense'` or `'income'` |
| `amount` | NUMERIC(19,4) NOT NULL | always positive; display/category currency (USD) |
| `account_amount` | NUMERIC(19,4) NOT NULL | amount in the account's own currency |
| `account_currency` | VARCHAR(3) NOT NULL | account's ISO currency code, e.g. `'EUR'` |
| `exchange_rate` | NUMERIC(18,6) NOT NULL | `account_amount * exchange_rate ≈ amount`; `1.0` when same currency |
| `account_id` | UUID NOT NULL | account involved in both types |
| `expense_category_id` | UUID NULLABLE | set for expense, null for income |
| `income_source_id` | UUID NULLABLE | set for income, null for expense |
| `note` | TEXT NULLABLE | optional description |
| `created_at` | TIMESTAMPTZ NOT NULL | `now()` default |

**Constraint:** `CHECK ((type = 'expense' AND expense_category_id IS NOT NULL AND income_source_id IS NULL) OR (type = 'income' AND income_source_id IS NOT NULL AND expense_category_id IS NULL))`

**Indexes:** `(user_id, account_id)`, `(user_id, expense_category_id)`, `(user_id, income_source_id)`

---

## 3. API Contracts (`transactions-service`)

Prefix: `/internal/transactions`

| Method | Path | Request body / params | Response | Notes |
|---|---|---|---|---|
| `POST` | `/internal/transactions` | body below | `Transaction` 201 | validates type + nullable fields |
| `GET` | `/internal/transactions` | query params below | `[Transaction]` | |
| `GET` | `/internal/transactions/totals` | query params below | `{expense_categories: {id: amount}, income_sources: {id: amount}}` | |

**POST body:**
```json
{
  "type": "expense" | "income",
  "amount": number,
  "account_amount": number,
  "account_currency": "USD",
  "exchange_rate": 1.0,
  "account_id": "uuid",
  "expense_category_id": "uuid | null",
  "income_source_id": "uuid | null",
  "note": "string | null"
}
```

**GET /internal/transactions query params** (all optional, at least one required):
- `account_id` — filter by account
- `expense_category_id` — filter by expense category
- `income_source_id` — filter by income source
- `year` (int, optional) — default: current year
- `month` (int 1–12, optional) — default: current month

**GET /internal/transactions/totals query params:**
- `user_id` (required)
- `year` (optional) — default: current year
- `month` (optional) — default: current month

Results ordered by `created_at DESC`, limit 100.

---

## 4. BFF Schema Changes (`web-bff/app/schema.py`)

**Updated `Transaction` Strawberry type:**
```
Transaction {
  id, type, amount, accountAmount, accountCurrency, exchangeRate,
  accountId, expenseCategoryId, incomeSourceId, note, createdAt
}
```

**Updated `Category` type:**
```
Category { id, name, icon, createdAt, total: float | None }
```
`total` is computed from the monthly totals endpoint and merged into each category/income source.

**Updated input types:**
```
CreateExpenseTransactionInput {
  accountId, expenseCategoryId, amount, accountAmount, accountCurrency, exchangeRate: float = 1.0, note?
}
CreateIncomeTransactionInput {
  incomeSourceId, accountId, amount, accountAmount, accountCurrency, exchangeRate: float = 1.0, note?
}
```

**Queries (unchanged names, updated implementation):**
```
accountTransactions(accountId: ID!): [Transaction!]!
expenseCategoryTransactions(categoryId: ID!): [Transaction!]!
incomeSourceTransactions(sourceId: ID!): [Transaction!]!
expenseCategories: [Category!]!   ← now merges monthly totals
incomeSources: [Category!]!       ← now merges monthly totals
```

**Mutations orchestration:**

`createExpenseTransaction`:
1. POST to `transactions-service /internal/transactions` with `type=expense`
2. PATCH to `accounts-service /internal/accounts/{accountId}/balance` with `{"delta": -account_amount}` (in account's currency)

`createIncomeTransaction`:
1. POST to `transactions-service /internal/transactions` with `type=income`
2. PATCH to `accounts-service /internal/accounts/{accountId}/balance` with `{"delta": +account_amount}` (in account's currency)

**Parallel totals fetch:**
Both `expense_categories` and `income_sources` resolvers use `asyncio.gather()` to fetch the category list and monthly totals simultaneously, then merge `total` into each item.

---

## 5. Exchange Rate BFF Proxy

**Endpoint:** `GET /exchange-rate?from={currency}&to={currency}`

The BFF proxies to the Frankfurter public API (`https://api.frankfurter.app/latest`), which requires:
- A `User-Agent` header (absent → 403)
- `follow_redirects=True` in httpx (absent → 301 not followed)

**Response:** `{ "from": "EUR", "to": "USD", "rate": 1.085234 }`

**Vite proxy rule:** `/bff/*` → `http://web-bff:8001` (strips `/bff` prefix), allowing the frontend to call `/bff/exchange-rate?from=EUR&to=USD` in development.

---

## 6. Frontend Architecture

### 6.1 Home Page Layout

Three sections in this order:

```
┌─────────────────────────────────────┐
│  💹 Income Sources   (wrap, multi-row)│
│  [💼 Salary $3k]  [💹 Freelance $0] [+] │
│  💰 Accounts      (horizontal scroll) │
│  [💵 Cash $500]  [💳 Card €1,200] [+]│
│  🧾 Expense Categories (wrap, multi-row) │
│  [🛒 Grocery $0]  [🏠 Rent $0]  [+] │
└─────────────────────────────────────┘
```

- **Income Sources** and **Expense Categories** sections: `flexWrap: 'wrap'` (multi-row)
- **Accounts** section: horizontal scroll, no wrap
- Every item shows monetary subtitle: `$0.00` for empty categories, currency-prefixed balance for accounts, and monthly total for income/expense items
- Currency formatted as symbol + amount with 2 decimal places: `$50.00`, `€1,500.00`

### 6.2 Item Creation (Modal)

Clicking `+` in any section opens an inline modal dialog — no page navigation:
- **Accounts `+`** → `CreateAccountModal`
- **Income Sources `+`** → `CreateCategoryModal` (title: "New Income Source", mutation: `createIncomeSource`)
- **Expense Categories `+`** → `CreateCategoryModal` (title: "New Expense Category", mutation: `createExpenseCategory`)

After successful creation, the relevant Apollo query is refetched automatically via `refetchQueries`.

### 6.3 Drag-and-Drop

Library: `@dnd-kit/core` with `PointerSensor` (activation distance: 8px).

**Drag sources (Draggable):**
- Account items — id prefix `account:{id}`, droppable id prefix `account-drop:{id}`
- Income Source items — id prefix `income:{id}`

**Drop targets (Droppable):**
- Expense Category items — id `category:{id}`, accept `account:*` drags
- Account items — id `account-drop:{id}`, accept `income:*` drags (accounts are both draggable AND droppable via merged callback refs)

**Visual feedback:**
- While dragging an account: expense category circles highlight
- While dragging an income source: account circles highlight
- A **DragOverlay** renders a floating clone of the dragged circle following the cursor during the entire drag operation

**Tap vs. drag disambiguation:**
- `PointerSensor` with `activationConstraint: { distance: 8 }` prevents accidental drags on taps
- A `wasDraggingRef` ref is set to `true` on `dragStart` and reset after 100ms on `dragEnd`, suppressing the subsequent click event

**On drop:** open `TransactionModal` with pre-filled source, target, and account currency.

### 6.4 TransactionModal (Multi-Currency)

The modal detects whether the account's currency differs from the base currency (USD).

**Same currency (USD account):**
- Shows a single amount input
- On confirm: `amount = accountAmount = parsedAmount`, `exchangeRate = 1.0`

**Different currency (e.g. EUR account):**
- Shows amount input labeled with account currency
- Shows exchange rate input (auto-fetched from `/bff/exchange-rate`, user can override)
- Shows live conversion preview: `≈ $XX.XX`
- For **expense**: user enters EUR amount → `accountAmount = parsedAmount` (EUR leaves account), `amount = parsedAmount * rate` (USD for category total)
- For **income**: user enters USD amount → `amount = parsedAmount` (USD for income source total), `accountAmount = parsedAmount * rate` (EUR goes into account)

Fields:
- Amount (number input, required, > 0)
- Exchange rate (shown only when `needsConversion`, auto-populated, editable)
- Note (text input, optional)
- Summary line: e.g. "Cash → Groceries" or "Salary → Card"

### 6.5 Details Views

Tap (no-drag click) on any item opens a full-page detail route. All transaction lists show the **current month** only (controlled by BFF passing current year/month to `transactions-service`).

Routes:
- `/accounts/:id` — account name/icon/balance + monthly transaction list
- `/categories/expense/:id` — category name/icon/monthly total + monthly transaction list
- `/categories/income/:id` — income source name/icon/monthly total + monthly transaction list

### 6.6 Currency Formatting Utility

`frontend/src/shared/lib/format-currency.ts`:
```typescript
formatCurrency(amount: number, currency?: string): string
```
Returns `$50.00`, `€1,500.00`, etc. Symbol map covers USD, EUR, GBP, JPY, CHF, RUB, UAH; falls back to `{CODE} ` prefix for unknown currencies.

---

## 7. Frontend Entity: `transactions`

Files under `frontend/src/entities/transaction/`:
- `model/types.ts` — `Transaction` interface with `accountAmount`, `accountCurrency`, `exchangeRate`
- `api/transactions.queries.ts` — `ACCOUNT_TRANSACTIONS_QUERY`, `EXPENSE_CATEGORY_TRANSACTIONS_QUERY`, `INCOME_SOURCE_TRANSACTIONS_QUERY`
- `api/transactions.mutations.ts` — `CREATE_EXPENSE_TRANSACTION_MUTATION`, `CREATE_INCOME_TRANSACTION_MUTATION` (both request new currency fields)
- `index.ts` — barrel exports

---

## 8. Impact and Risk

- **Balance correctness with multi-currency:** BFF uses `account_amount` (not `amount`) for the balance delta, ensuring EUR accounts lose/gain the correct EUR amount.
- **Balance consistency:** BFF two-phase write (transaction + balance update) has a small window where one succeeds and the other fails. Acceptable for dev; add idempotency keys later.
- **Monthly totals:** No cron jobs required. Totals reset naturally because they are computed by filtering to the current month's date range at query time. Account balances are unaffected by the monthly filter.
- **Accounts as both draggable and droppable:** handled by merging `useDraggable` and `useDroppable` refs on the same element using a callback ref.
