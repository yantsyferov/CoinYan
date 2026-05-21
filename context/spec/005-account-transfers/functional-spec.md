# Functional Specification: Account Transfers

- **Roadmap Item:** Phase 2 — Account Transfers (Transfers Between Own Accounts)
- **Status:** Completed
- **Author:** CoinYan Team

---

## 1. Overview and Rationale (The "Why")

Sometimes a user needs to move money between their own accounts — for example, taking cash from savings and putting it onto a bank card, or exchanging currency from one wallet to another. This is not income or an expense — it is a simple redistribution of money the user already has. Without a dedicated transfer feature, users would have to log a fake expense on one account and a fake income on another, which would distort their financial totals and make reports inaccurate. Transfers let users keep their accounts in sync without affecting their income or expense summaries.

**Success looks like:** A user moves money from their savings account to their card in seconds by dragging one account onto the other, enters an amount — and both balances update immediately, with no impact on income or expense totals.

---

## 2. Functional Requirements (The "What")

### 2.1 Starting a Transfer (Drag & Drop)

On the home page, the user initiates a transfer by dragging one account's circle onto another account's circle. When dropped, a transfer form opens automatically with the source and destination accounts pre-filled.

**Acceptance Criteria:**
- [x] Given I am on the home page, when I drag one account circle and drop it onto another account circle, then a transfer form opens.
- [x] The form shows the source account and destination account, already selected and read-only.
- [x] Dragging an account onto itself does nothing — no form opens.

---

### 2.2 Transfer Form

The form contains:
- **Source account** (pre-filled, read-only) — the account money is taken from
- **Destination account** (pre-filled, read-only) — the account money goes to
- **Amount debited** — how much is taken from the source account, in the source account's currency
- **Amount credited** — visible only when the two accounts use different currencies; how much is added to the destination account, in the destination account's currency. When currencies match, this field is hidden and the same amount is used for both sides
- **Date** — automatically set to today's date
- **Note** (optional) — a free-text description

**Acceptance Criteria:**
- [x] Given both accounts use the same currency, then I see one amount field.
- [x] Given the accounts use different currencies, then I see two amount fields: amount debited (source currency) and amount credited (destination currency).
- [x] Given I do not enter a note, the transfer can still be saved.
- [x] Given I leave the amount empty and tap Confirm, then I see an error and the transfer is not created.
- [x] Given I fill in all required fields and tap Confirm, then the form closes and both account balances update immediately.

---

### 2.3 Effect on Balances

- The source account's balance decreases by the debited amount.
- The destination account's balance increases by the credited amount.
- The transfer does not count as income or expense anywhere in the app.

**Acceptance Criteria:**
- [x] Given I transfer 100 from Account A to Account B (same currency), then Account A balance decreases by 100 and Account B balance increases by 100.
- [x] Given I transfer 100 USD from Account A to Account B (EUR account) and enter 92 EUR as the credited amount, then Account A decreases by 100 USD and Account B increases by 92 EUR.
- [x] The total income and total expense figures are not affected by any transfer.

---

### 2.4 Transfer in Transaction History

After a transfer is created, it appears in the transaction history of both the source account and the destination account. It is visually distinct from regular income and expense entries. The sign of the amount reflects the direction of money relative to the account being viewed: outgoing shows as negative (red, −), incoming shows as positive (green, +).

**Acceptance Criteria:**
- [x] Given I open the source account, then the transfer appears in its history showing the destination account name and the debited amount with a minus sign (−) in red.
- [x] Given I open the destination account, then the transfer appears in its history showing the source account name and the credited amount with a plus sign (+) in green.
- [x] Transfer entries are visually distinct from income and expense entries.

---

### 2.5 Cancelling a Transfer

A user can cancel (delete) a transfer from the transaction history of either account. When cancelled, both account balances are restored to what they were before the transfer, and the entry disappears from both accounts' histories.

**Acceptance Criteria:**
- [x] Given I tap a transfer entry in either account's history, then I see a "Cancel transfer" option.
- [x] Given I confirm the cancellation from the source account's history, then the transfer disappears from both accounts' histories and both balances are restored to their pre-transfer values.
- [x] Given I confirm the cancellation from the destination account's history, then the transfer disappears from both accounts' histories and both balances are restored to their pre-transfer values.
- [x] The user must confirm before the cancellation takes effect.

---

## 3. Scope and Boundaries

### In-Scope
- Initiating a transfer via drag & drop on the home page
- Transfer form with source account, destination account, debit amount, optional credit amount (cross-currency), date, and optional note
- Cross-currency transfers with separate debit and credit amounts
- Transfer visible in the history of both accounts
- Cancelling a transfer with full balance restoration

### Out-of-Scope
- **Editing a transfer** — transfers cannot be edited after creation, only cancelled
- **Budget Controls** — per-category spending limits (separate roadmap item)
- **Dashboard & Overview** — financial summary screen (separate roadmap item)
- **Basic Reports & Charts** — spending charts and trend analysis (separate roadmap item)
- **Multi-Currency Workspace, Crypto Integrations, Mobile Apps** — Phase 5 features
