# Functional Specification: Accounts & Wallets

- **Roadmap Item:** Phase 1 — Accounts & Wallets (Create & Manage Accounts, Real-Time Balance Tracking)
- **Status:** Completed
- **Author:** CoinYan Team

---

## 1. Overview and Rationale (The "Why")

CoinYan is built around the concept of financial accounts — the places where a person's money lives. Before a user can log any income, spending, or transfers, they need to define where their money is. Without accounts, there is nothing to track against.

A user may carry cash, hold money in a bank card, maintain a savings account, or use any combination of these. Not every user has a bank account (a child or a cash-only person may have only physical money), so the product does not assume any particular account type. CoinYan gives every user a simple way to represent all of their money in one place, each account with a clear name, a recognizable icon, and its own currency. Balances stay accurate automatically as transactions are added.

**Success looks like:** A new user opens CoinYan, sees their default Cash account already waiting for them, and within a minute has added their other financial accounts — all clearly named and recognizable. From that point on, their account balances are always up to date without any manual calculation.

---

## 2. Functional Requirements (The "What")

### 2.1 Accounts List

The accounts screen displays the user's accounts as a row of circles. Each circle contains the account's icon, and the account's name and current balance appear beneath it.

- Every new user automatically has a **Cash** account created for them with a starting balance of 0.
- The list is dynamic — the user can add as many accounts as they need.
- Balances shown are always up to date.

**Acceptance Criteria:**
- [x] Given I open the app for the first time, then I see a "Cash" account already in my list with a balance of 0.

---

### 2.2 Creating an Account

A user can add a new account at any time from **both the home page and the accounts screen**. Tapping the "+" button in the Accounts section opens a modal dialog inline — no page navigation required.

To create an account, the user provides:
- **Name** (required) — a free-text label, e.g. "Main Card", "Savings", "Travel Wallet"
- **Icon** (required) — chosen from a predefined library of icons
- **Currency** (required) — selected from a searchable list of standard world currencies (e.g. USD, EUR, GBP)
- **Starting balance** (optional) — the amount already in the account before the user begins logging transactions in CoinYan; defaults to 0 if left blank

The currency of an account **cannot be changed after the account is created**.

**Acceptance Criteria:**
- [x] Given I tap "+" in the Accounts section on the home page, then I see a modal form with fields for name, icon, currency, and starting balance.
- [x] Given I fill in all required fields and tap Save, then the new account appears in my accounts list immediately without page navigation.
- [x] Given I leave the starting balance empty and save, then the account is created with a balance of 0.
- [x] Given I enter a starting balance of 500, then the account shows 500 as its current balance immediately after creation.
- [x] Given I try to save without entering a name, then I see an error and the account is not created.

---

### 2.3 Account Balance

Each account shows its current balance — the starting balance plus all income logged to it, minus all expenses logged from it, adjusted for any transfers in or out.

- The balance updates automatically whenever a transaction is added, edited, or deleted.
- The balance is always shown in the account's own currency.

**Acceptance Criteria:**
- [x] Given an account has a starting balance of 100, when I log an expense of 30 against it, then the balance updates to 70.
- [x] Given I add income of 50 to an account, then its balance increases by 50.
- [x] Given I delete a transaction, then the account balance adjusts immediately.

---

### 2.4 Editing an Account

A user can change an account's name and icon at any time. The currency is fixed at creation and cannot be modified.

**Acceptance Criteria:**
- [x] Given I open an account and tap "Edit", then I can change its name and icon.
- [x] Given I save the changes, then the updated name and icon appear in the list immediately.
- [x] Given I am in the edit screen, then the currency is visible but cannot be changed.

---

### 2.5 Deleting an Account

When a user chooses to delete an account, they are presented with three options before anything happens:

1. **Archive** — The account is hidden from the active list but all its data is preserved. It can be restored at any time.
2. **Delete, keep transaction history** — The account is removed, but transactions linked to it remain visible in the history of other areas of the app (e.g. expense categories) and continue to count towards their totals.
3. **Delete everything** — The account and every transaction linked to it are permanently removed from all parts of the app. All affected totals are recalculated. This option is shown last, highlighted in red, and requires a second confirmation: *"Are you sure? All linked transactions will be permanently removed. This cannot be undone after 30 days."*

**In all three cases**, the user has **30 days** to change their mind and fully restore the account and all its data.

**Acceptance Criteria:**
- [x] Given I choose to delete an account, then I am shown three options: Archive, Delete (keep history), and Delete everything.
- [x] Given I choose Archive, then the account disappears from my active list but is accessible in a separate archived section.
- [x] Given I choose "Delete, keep history", then the account is removed but its past transactions still appear in the history of other areas of the app.
- [x] Given I choose "Delete everything", then I see a red warning and must confirm a second time before anything is deleted.
- [x] Given I confirm "Delete everything", then the account and all its linked transactions are removed and affected totals update.
- [x] Given I deleted or archived an account within the last 30 days, then I can find and restore it with all its data.
- [x] Given 30 days have passed since deletion, then the data is permanently gone and cannot be recovered.

---

## 3. Scope and Boundaries

### In-Scope
- Default "Cash" account created automatically for every new user
- Creating accounts with name, icon, currency, and optional starting balance
- Currency locked after creation; only name and icon are editable
- Deleting accounts with three options (archive, delete with history, delete everything) and a 30-day recovery window
- Real-time balance calculation based on logged transactions

### Out-of-Scope

The following are separate roadmap items addressed in their own specifications:
- **Income Sources** — logging and managing income entries
- **Custom Expense Categories** — creating and categorizing expenses
- **Expense Logging** — recording individual transactions
- **Account Transfers** — moving money between a user's own accounts
- **Budget Controls** — per-category spending limits
- **Dashboard & Overview** — financial summary screen
- **Reports & Charts** — spending charts and trend analysis
- **Multi-Currency Workspace, Crypto Integrations, Mobile Apps** — Phase 5 features
