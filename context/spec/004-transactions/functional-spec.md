# Functional Specification: Transactions

- **Roadmap Items:** Phase 2 — Expense Logging; Phase 2 — Income Logging
- **Status:** Completed

---

## 1. Overview and Rationale (The "Why")

Accounts and categories are just labels until a user records what actually happened with their money. Transactions are the core activity of CoinYan — every time money flows in or out, the user records it here.

CoinYan makes transaction entry as fast as possible through drag-and-drop: drag an account circle onto an expense category to log a spend, or drag an income source onto an account to log a receipt. No menus, no navigation — just a gesture and a number.

Totals and balances update instantly. The user always knows where they stand.

---

## 2. Monthly Budget Cycle

CoinYan operates on a **calendar-month cycle**.

- **Account balances carry over.** A balance of $500 on January 31 becomes the starting point for February. Balances accumulate over the lifetime of the account.
- **Category and income source totals reset each month.** At the start of each new month, all expense categories show $0.00 and all income sources show $0.00. The user starts fresh.
- **Detail views show the current month only.** Tapping any category or income source shows only this month's transactions and this month's total.
- **No manual reset is required.** The system computes totals by filtering to the current month automatically.

---

## 3. Functional Requirements

### 3.1 Home Page Layout

The home page shows three sections in this order:

1. **Income Sources** — where money comes from (multi-row, wraps)
2. **Accounts** — where money lives (horizontal scroll)
3. **Expense Categories** — where money goes (multi-row, wraps)

Each item is displayed as a circle with an icon, a name below it, and a monetary subtitle:
- Accounts show their current balance in their own currency (e.g. `€1,200.00`)
- Income sources and expense categories show their **current month's total** (e.g. `$0.00` if nothing was logged yet)

Amounts are always formatted with the currency symbol and two decimal places: `$50.00`, `€1,500.00`.

**Acceptance Criteria:**
- [x] Given I open the home page, then I see Income Sources first, Accounts second, Expense Categories third.
- [x] Given an expense category has no transactions this month, then it shows `$0.00` as its subtitle.
- [x] Given I logged $50 of groceries this month, then the Groceries category shows `$50.00`.
- [x] Given my EUR account has a balance of 1200, then it shows `€1,200.00`.
- [x] Given it is the first day of a new month, then all expense and income totals show `$0.00`.

---

### 3.2 Logging an Expense (Account → Category)

To record a spend, the user drags an account circle onto an expense category circle. A transaction modal opens.

**Transaction modal fields:**
- **Amount** (required, > 0) — labeled with the account's currency if it differs from USD
- **Exchange rate** (shown only when account is not USD) — auto-populated from a live rate; the user can override it for precision
- **Note** (optional)
- **Summary line** — shows "Account → Category" (e.g. "Cash → Groceries")

On confirm:
- The account's balance decreases by the entered amount (in the account's own currency)
- The expense category's monthly total increases by the USD-equivalent amount
- Both the home page totals and the account balance update immediately

**Acceptance Criteria:**
- [x] Given I drag a USD account onto an expense category and enter 30, then the account balance decreases by $30 and the category total increases by $30.
- [x] Given I drag a EUR account onto an expense category, then I see an exchange rate field pre-filled with the current EUR→USD rate.
- [x] Given I enter 100 EUR with a rate of 1.09, then the account loses €100 and the category gains $109.00.
- [x] Given I leave the amount blank and tap Confirm, then I see a validation error and nothing is created.
- [x] Given I tap Cancel, then no transaction is created and nothing changes.

---

### 3.3 Logging Income (Income Source → Account)

To record incoming money, the user drags an income source circle onto an account circle. A transaction modal opens.

**Transaction modal fields:**
- **Amount** (required, > 0) — entered in USD (the income source's base currency)
- **Exchange rate** (shown only when account is not USD) — auto-populated; editable
- **Note** (optional)
- **Summary line** — shows "Income Source → Account" (e.g. "Salary → Card")

On confirm:
- The account's balance increases by the USD amount (or converted amount if non-USD account)
- The income source's monthly total increases by the USD amount
- Both update immediately on screen

**Acceptance Criteria:**
- [x] Given I drag an income source onto a USD account and enter 3000, then the account balance increases by $3,000 and the income source total shows $3,000.
- [x] Given I drag an income source onto a EUR account, then I see an exchange rate field pre-filled with the current USD→EUR rate.
- [x] Given I enter $3,000 income with a rate of 0.92, then the income source total shows $3,000.00 and the EUR account gains €2,760.00.

---

### 3.4 Creating Items from the Home Page

The user does not need to navigate away from the home page to add a new account, income source, or expense category. Each section has a **"+" button** that opens a modal dialog inline.

- Tapping **+** in Income Sources opens a "New Income Source" form
- Tapping **+** in Accounts opens a "New Account" form
- Tapping **+** in Expense Categories opens a "New Expense Category" form

After the form is submitted and saved, the new item appears in the relevant section immediately.

**Acceptance Criteria:**
- [x] Given I tap "+" in Income Sources, then a modal opens with name and icon fields.
- [x] Given I tap "+" in Accounts, then a modal opens with name, icon, currency, and starting balance fields.
- [x] Given I tap "+" in Expense Categories, then a modal opens with name and icon fields.
- [x] Given I save a new item, then it appears in the correct section on the home page immediately without any page refresh or navigation.
- [x] Given I tap the modal's Cancel or background, then no item is created.

---

### 3.5 Viewing Transaction History

Tapping (not dragging) any circle on the home page opens a detail view for that item, showing:
- The item's icon, name, and current total/balance
- A list of all transactions for the **current month**, newest first
- Each transaction row: date, amount, counterpart name, note (if any)

**Acceptance Criteria:**
- [x] Given I tap an expense category, then I see only transactions from the current month.
- [x] Given I tap an account, then I see only this month's transactions for that account.
- [x] Given I tap an income source, then I see only this month's transactions for that income source.
- [x] Given a tap follows a drag gesture, then the detail view does not open (tap is suppressed after a drag).

---

## 4. Scope and Boundaries

### In-Scope
- Expense transactions: account → expense category via drag-and-drop
- Income transactions: income source → account via drag-and-drop
- Multi-currency transactions with live exchange rate lookup and user override
- Monthly totals for categories and income sources
- Account balances that carry over across months
- Creating accounts, income sources, and expense categories from the home page modal
- Transaction detail history per account, category, and income source (current month)

### Out-of-Scope
- Editing or deleting existing transactions — addressed in a later spec
- Account-to-account transfers — addressed in a later spec
- Budget limits per category — covered in a later spec
- Reports and charts — covered in a later spec
- Historical month browsing — current month only for now
