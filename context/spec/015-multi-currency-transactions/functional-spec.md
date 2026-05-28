# Functional Specification: Multi-Currency Transactions

- **Roadmap Item:** Phase 5 — Multi-Currency Workspace
- **Status:** Completed
- **Author:** CoinYan Team

---

## 1. Overview and Rationale (The "Why")

Today, CoinYan users who manage money across multiple currencies — freelancers paid in USD while living in Ukraine, travelers with multi-currency wallets, or anyone with foreign savings — can record transactions but must mentally calculate exchange amounts and look up rates themselves. The relationship between the source amount, the rate, and the resulting amount is not visible or reactive.

This feature makes cross-currency transactions a first-class experience. A three-field system keeps the source amount, exchange rate, and target amount permanently in sync. The app automatically suggests the correct rate — including historically accurate rates for past-dated entries — so users get a precise financial picture without extra effort. Users retain full control to override any value at any time.

**Success looks like:** A user drags their USD cash account onto a UAH expense category, sees the current USD→UAH rate already filled in, verifies the amounts look right, and confirms — all in under ten seconds.

---

## 2. Functional Requirements (The "What")

### 2.1 The Three-Field System

Whenever a transaction involves two entities with **different currencies**, the transaction form shows three linked fields:

1. **Source Amount** — the amount in the currency of the entity money is coming from (e.g., `100 USD`)
2. **Exchange Rate** — how many units of the target currency equal one unit of the source currency (e.g., `41.50`)
3. **Target Amount** — the amount in the currency of the entity money is going to (e.g., `4,150.00 UAH`)

These three fields are always in sync according to these rules:

| What the user edits | What updates |
|---|---|
| Source Amount | Target Amount recalculates (Source × Rate = Target). Rate unchanged. |
| Exchange Rate | Target Amount recalculates (Source × Rate = Target). Source unchanged. |
| Target Amount | Exchange Rate recalculates (Target ÷ Source = Rate). Rate becomes "Custom." |

When both entities use the **same currency**, only a single amount field is shown. The Exchange Rate and Target Amount fields are completely hidden.

**Acceptance Criteria:**
- [x] Given I open a transaction form where both sides share the same currency, then I see a single amount field and no rate or target fields.
- [x] Given I open a transaction form where the two entities use different currencies, then I see three labeled fields: Source Amount, Exchange Rate, and Target Amount.
- [x] Given I change the Source Amount, then the Target Amount recalculates instantly and the Exchange Rate stays the same.
- [x] Given I change the Exchange Rate, then the Target Amount recalculates instantly and the Source Amount stays the same.
- [x] Given I change the Target Amount, then the Exchange Rate recalculates instantly and a "Custom" label appears on the rate field.

---

### 2.2 Auto-Suggested Exchange Rate

When a cross-currency transaction form opens, the Exchange Rate field is automatically pre-filled with the suggested rate for that currency pair:

- If the transaction date is **today** → the current market rate is fetched and shown.
- If the transaction date is **in the past** → the historical rate for that specific date is fetched and shown.
- If **no rate can be fetched** (no internet connection, service unavailable) → the most recently known rate for that pair is pre-filled, with a visible notice such as *"Rate may be outdated"*. If no cached rate exists at all, the field is left empty and the user must enter it manually.

A rate that was filled in automatically carries no label — it is the default baseline.

**Acceptance Criteria:**
- [x] Given the form opens for a cross-currency transaction dated today, then the Exchange Rate is pre-filled with the current rate for that pair, with no additional label.
- [x] Given the form opens for a cross-currency transaction dated in the past, then the Exchange Rate is pre-filled with the historical rate for that specific date.
- [x] Given the system cannot fetch a rate but has a previously seen rate cached, then the rate field shows the cached value along with a *"Rate may be outdated"* notice.
- [x] Given no rate has ever been fetched for this currency pair and none can be fetched now, then the rate field is left blank.

---

### 2.3 Custom Rate Indicator and Reset

When the user manually edits the Exchange Rate or the Target Amount (which recalculates the rate), the rate field shows a **"Custom"** label to make the override visible.

A **"Reset to suggested rate"** control appears alongside the rate field when the label is active. Tapping it:
- Replaces the rate with the current system-suggested rate for that pair and date.
- Recalculates the Target Amount.
- Removes the "Custom" label.

**Acceptance Criteria:**
- [x] Given I manually type a value in the Exchange Rate field, then a "Custom" label appears on that field.
- [x] Given I manually type a value in the Target Amount field, then a "Custom" label appears on the Exchange Rate field.
- [x] Given the "Custom" label is visible, then I also see a "Reset to suggested rate" control.
- [x] Given I tap "Reset to suggested rate", then the rate reverts to the system-suggested value, the Target Amount recalculates, and the "Custom" label disappears.

---

### 2.4 Rate Update Suggestion When Date Changes

When the user changes the transaction date in the form, the app checks whether a different rate is available for the new date. If one is found, it shows a **suggestion banner** rather than silently overwriting the rate:

> *"Historical rate for [date]: [X.XX]. Apply it?"*

The user can:
- **Apply** — the Exchange Rate updates to the suggested historical value, the Target Amount recalculates, and any existing "Custom" label is cleared.
- **Dismiss** — the Exchange Rate and Target Amount remain exactly as they were.

This prompt appears regardless of whether the current rate is auto-suggested or custom.

**Acceptance Criteria:**
- [x] Given I change the transaction date and a historical rate is available for that date, then a suggestion banner appears showing the rate and offering to apply it.
- [x] Given I tap "Apply" on the banner, then the Exchange Rate updates, the Target Amount recalculates, and any "Custom" label clears.
- [x] Given I dismiss the banner, then the rate and target amount remain unchanged.
- [x] Given I change the date to today, then the banner offers the current rate for today.

---

### 2.5 Validation — All Three Fields Required

For cross-currency transactions, all three fields must be filled with valid values greater than zero before the transaction can be confirmed.

**Acceptance Criteria:**
- [x] Given any of the three fields is empty or zero when I tap Confirm, then the Confirm button is disabled and the empty field shows an inline error.
- [x] Given all three fields contain valid non-zero values, then the Confirm button is active.

---

### 2.6 Income Sources Now Have a Currency

Each income source is denominated in a specific currency, chosen when the source is created.

- When creating a new income source, the user selects its currency from the same currency picker used for accounts.
- The currency is displayed on the income source's circle on the home page.
- The currency can be changed later from the income source's settings.
- When logging income, the Source Amount is in the income source's currency.
- If the income source currency matches the destination account's currency → single amount field only.
- If they differ → the three-field system appears.

Existing income sources that currently have no explicit currency are assigned a default of USD.

**Acceptance Criteria:**
- [x] Given I create a new income source, then I can pick its currency before saving.
- [x] Given I drag an income source onto an account with the same currency, then I see a single amount field.
- [x] Given I drag an income source onto an account with a different currency, then I see the three-field system, with the Source Amount labeled in the income source's currency and the Target Amount labeled in the account's currency.
- [x] Given an income source was created before this feature, then it behaves as if its currency is USD.

---

### 2.7 Expense Categories — Multi-Currency Totals

Each expense category has a **base currency**, selected when the category is created (and editable later in category settings). All amounts logged to that category are stored in their original currency and also converted to the base currency using the rate recorded on the transaction.

**On the home page:** the category circle shows the monthly total in the category's **base currency**.

**On the category detail page:** the monthly total headline is in the base currency. Below it, a per-currency breakdown lists the total for each currency that was used that month (e.g., `$200.00 USD · ₴4,150.00 UAH · €85.00 EUR`).

**Acceptance Criteria:**
- [x] Given an expense category has transactions in multiple currencies this month, then the category detail page shows the total in the base currency and a list of totals per currency.
- [x] Given the home page category circle, then it always shows the total in the category's base currency.
- [x] Given I create a new expense category, then I can select its base currency.

---

### 2.8 Editing Existing Cross-Currency Transactions

When editing a cross-currency transaction, the same three-field system is shown. The stored Source Amount, Exchange Rate, and Target Amount are pre-filled. If the original transaction used a custom rate, the "Custom" label is shown. All three fields remain editable and continue to follow the reactive rules above.

**Acceptance Criteria:**
- [x] Given I open an existing cross-currency transaction for editing, then I see all three fields pre-filled with the stored values.
- [x] Given the original transaction had a custom rate, then the "Custom" label is shown when I open the edit form.
- [x] Given I edit any of the three fields, then the reactive update rules apply as in a new transaction.

---

## 3. Scope and Boundaries

### In-Scope

- Three-field reactive system (Source Amount, Exchange Rate, Target Amount) for all cross-currency transactions
- Single amount field for same-currency transactions (rate and target fields hidden)
- Auto-suggested exchange rates: current for today, historical for past dates
- "Custom" rate label and "Reset to suggested rate" control
- Suggestion banner when the transaction date is changed
- Last-known-rate fallback when a fresh rate cannot be fetched
- Income sources gaining a designated currency with a currency picker
- Expense category base currency selection, with multi-currency totals on the category detail page
- Three-field system applies at all creation points: home page drag-and-drop, and the edit transaction form
- All three fields are editable after a transaction is saved

### Out-of-Scope

- **Base Value Anchor** — choosing an app-wide currency to restate all balances and budgets (a separate Phase 5 feature)
- **Home page dashboard totals in a unified currency** — income, expense, and balance summaries on the home page remain in their native currencies for now; cross-currency aggregation is a future feature
- **Crypto or broker integrations** — Phase 5 feature
- **Automatic bank imports** — Phase 5 feature
- **Basic Reports & Charts** — Phase 4 feature (next roadmap item)
- **Mobile apps** — planned post-web-launch
