# Functional Specification: Base Currency & Unified Dashboard

- **Roadmap Item:** Base Value Anchor (Phase 5, first iteration) — users set a personal base currency; all dashboard figures unify to it
- **Status:** Completed
- **Author:** yantsyferov

---

## 1. Overview and Rationale (The "Why")

CoinYan users can now hold accounts in multiple currencies — Ukrainian hryvnias, US dollars, Russian rubles, and more. This is powerful, but it creates a practical problem: when a user opens their dashboard, they see a collection of balances and statistics in different currencies with no single number that answers "how much do I have in total?" or "how much did I spend this month overall?"

The goal of this feature is to give every user a **Base Currency** — one currency through which they view their complete financial picture. Once set, the dashboard automatically converts all account balances, income, and expenses into this currency, making the summary meaningful regardless of how many currencies the user operates in.

**User pain point:** A user with a UAH savings account, a USD card, and EUR cash cannot see a unified total balance on the dashboard today. They also cannot meaningfully compare monthly income and expenses across currencies because there is no common unit.

**Desired outcome:** After this change, every financial summary on the dashboard — total balance, total income, total expenses, net balance — reflects all accounts and transactions unified into the user's chosen base currency. A user can glance at the dashboard and instantly understand their overall financial position.

**Success measure:** Users with accounts in multiple currencies can read a single, meaningful total balance and monthly summary from the dashboard without mentally combining numbers from different currencies.

---

## 2. Functional Requirements (The "What")

### 2.1 — Choosing a Base Currency at Sign-Up

During registration, the user is asked to choose their **Base Currency** — the currency through which all financial summaries will be displayed across the app.

- A clearly labeled "Base Currency" field is added to the sign-up form.
- The field is a searchable dropdown showing approximately 15 popular currencies: USD, EUR, GBP, UAH, RUB, JPY, CNY, CHF, CAD, AUD, PLN, CZK, HUF, SEK, NOK. [NEEDS CLARIFICATION: confirm the final exact list of 15 currencies.]
- **USD is pre-selected by default.**
- The user may change the selection before submitting the form.
- The field is optional — if the user does not interact with it, USD is saved.

**Acceptance Criteria:**
- [x] When the user opens the sign-up form, a "Base Currency" field is visible and shows "USD" as the default selection.
- [x] Tapping or clicking the field opens a list of ~15 currencies. The user can scroll or type to search by currency name or code.
- [x] After selecting a currency and completing sign-up, the dashboard displays all totals and summaries in the selected currency.
- [x] If the user does not change the default and completes sign-up, their base currency is saved as USD.

---

### 2.2 — Existing Users Default to USD

All users who registered before this feature is released automatically have **USD** set as their base currency. No action is required from them, and no migration screen or notification is shown.

**Acceptance Criteria:**
- [x] An existing user who had no base currency set can log in and immediately see the dashboard figures in USD.
- [x] No prompt, forced setup screen, or banner is shown to existing users asking them to configure a base currency.

---

### 2.3 — Changing the Base Currency from Profile Settings

The user can change their base currency at any time from their profile or settings page.

- A "Base Currency" row is visible on the profile/settings page, showing the currently selected currency.
- Tapping or clicking it opens the same ~15-currency selector used during registration.
- After saving, all dashboard figures immediately recalculate and display in the new currency.

**Acceptance Criteria:**
- [x] On the profile/settings page, a "Base Currency" row shows the user's current base currency.
- [x] Clicking the row opens the currency selector.
- [x] After selecting a new currency and saving, the profile page reflects the new value.
- [x] Navigating to the dashboard shows all income, expense, balance, and total figures in the newly selected currency.

---

### 2.4 — Dashboard: Unified Total Balance

The top of the dashboard shows a single **Total Balance** — the sum of all account balances converted into the user's base currency.

- The label clearly shows the base currency code or symbol (e.g., "Total Balance: $1,240.50 USD").
- Each account contributes its balance to the total, converted at the historical rate applicable to its transactions (see Section 2.7 for the conversion rules).

[NEEDS CLARIFICATION: Should the "Total Balance" use the sum-of-historical-cost method (each transaction converted at the rate when it happened, summed over all time), or should it use today's live market rate applied to the current account balance? The historical method is more consistent with how income/expense stats work; the live-rate method shows "current market worth." Both are valid; the product decision determines which one users find more intuitive here.]

**Acceptance Criteria:**
- [x] The dashboard header/top area shows a "Total Balance" figure.
- [x] The figure is expressed in the user's base currency with the currency symbol or code visible.
- [x] The figure equals the combined value of all accounts after currency conversion.
- [x] If all accounts are in the same currency as the base currency, the total equals the simple arithmetic sum of those balances.

---

### 2.5 — Dashboard: Account Cards Show Both Native and Equivalent Amounts

Each account card continues to show its balance in its own native currency. A secondary, smaller label shows the approximate equivalent in the base currency.

**Example:** A UAH savings account displays "₴ 50,000" as the primary figure, and "≈ $1,240 USD" as a secondary label.

**Acceptance Criteria:**
- [x] Each account card shows its native currency balance as the primary, prominently displayed value.
- [x] Beneath or beside it, a secondary label shows the approximate base-currency equivalent, prefixed with "≈" to indicate an approximation.
- [x] The base currency code or symbol is included in the secondary label.
- [x] If the account's native currency already matches the user's base currency, no secondary label is displayed (it would be redundant).

---

### 2.6 — Dashboard: Income, Expenses, and Net Balance in Base Currency

The monthly income total, total expenses, and net balance figures on the dashboard are all displayed in the user's base currency. The existing period filter behavior (current month) is unchanged — only the currency of the figures changes.

- Every income and expense transaction from the current period is converted to the base currency before being summed.
- The conversion uses the exchange rate that was in effect on the day each transaction was made (historical rate).

**Acceptance Criteria:**
- [x] The "Total Income" figure on the dashboard shows the sum of all income entries for the current period, with each entry converted to the base currency at the rate applicable on its transaction date.
- [x] The "Total Expenses" figure shows the sum of all expense entries for the current period, converted the same way.
- [x] The "Net Balance" (income minus expenses for the period) is expressed in the base currency.
- [x] All three figures display the base currency symbol or code alongside the number.
- [x] The period selection behavior (current month) is not changed by this feature.

---

### 2.7 — Conversion Rate Logic

How a transaction's amount is converted to the base currency depends on which currencies are involved in that transaction.

**Case A — The transaction directly involves the base currency**
(e.g., transferring from a USD account when USD is the base currency, or recording USD income for a USD-base user)

The rate stored on the transaction at the time it was created is used. No additional lookup or calculation is needed.

**Acceptance Criteria:**
- [x] For a transaction where at least one of the currencies is the user's base currency, the dashboard uses the rate that was recorded on the transaction when it was first entered.
- [x] This rate is visible in the transaction details.

---

**Case B — The transaction does NOT involve the base currency**
(e.g., a transfer from a UAH account to a RUB account, for a user whose base currency is USD)

The app automatically derives an appropriate rate from the base currency to cover the transaction date. This rate is pre-filled on the transaction record. The user can review and override it at any time through the transaction edit screen.

**Acceptance Criteria:**
- [x] For a transaction where neither currency involved is the user's base currency, the app automatically pre-fills a conversion rate relative to the base currency, based on the transaction date.
- [x] This auto-filled rate is used in all dashboard calculations until the user changes it.
- [x] The user can open the transaction edit screen, see the pre-filled rate, change it, and save.
- [x] After the user saves a custom rate, all dashboard totals that include this transaction recalculate using the updated rate.

---

### 2.8 — Transaction Edit Screen: Conversion Rate Field

For Case B transactions (see 2.7 above), a **"Conversion rate to [Base Currency]"** field is shown in the transaction edit screen. This field is not shown for Case A transactions.

- The label adapts to the user's base currency (e.g., "Conversion rate to USD", "Conversion rate to EUR").
- The field is pre-filled with the system-derived rate for the transaction date (e.g., "1 UAH = 0.0248 USD").
- The user can clear the value and enter a custom rate.
- Saving the updated rate immediately affects all dashboard figures that include this transaction.

**Acceptance Criteria:**
- [x] When the user opens the edit screen for a transaction where neither currency is their base currency, a "Conversion rate to [Base Currency]" field is visible and pre-filled.
- [x] The format clearly shows "1 [transaction currency] = X [base currency]".
- [x] The user can edit the value and tap/click Save.
- [x] After saving, the dashboard income, expense, and total balance figures reflect the new rate.
- [x] When the user opens the edit screen for a transaction where at least one currency matches their base currency, the "Conversion rate to [Base Currency]" field is not displayed.

---

## 3. Scope and Boundaries

### In-Scope

- Base currency selection field on the sign-up / registration screen (default USD).
- Automatic assignment of USD as base currency for all existing users with none set.
- "Base Currency" setting on the user profile / settings page, changeable at any time.
- Dashboard "Total Balance" header showing all accounts unified in the base currency.
- Account cards displaying native balance plus an approximate base-currency equivalent.
- Dashboard income, expenses, and net balance shown in base currency using historical transaction rates; period filter behavior unchanged.
- "Conversion rate to [Base Currency]" editable field on the transaction edit screen for cross-currency transactions (Case B).
- Infrastructure that accommodates all ~170 ISO currencies for future expansion, even though the user-facing selector shows ~15.

### Out-of-Scope

- **Daily automatic market-rate recalculation** — balances do not fluctuate day-to-day as exchange rates move in the market. *(This is the full Base Value Anchor feature, planned as a separate, later iteration.)*
- **Basic Reports & Charts** — visual spending timelines and category breakdowns. *(Phase 4 roadmap item.)*
- **Crypto & Broker Integrations.** *(Future feature.)*
- **Automatic Bank Imports.** *(Future feature.)*
- **Mobile Apps.** *(Future feature.)*
- **Shared / Family Accounts.** *(Future feature.)*
