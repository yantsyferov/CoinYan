# Functional Specification: Initial Account Balance Recorded as a Transaction

- **Roadmap Item:** Accounts & Wallets — Create & Manage Accounts
- **Status:** Completed
- **Author:** yantsyferov

---

## 1. Overview and Rationale (The "Why")

When a user creates a new financial account in the app, they can optionally enter a starting balance — the amount already on that account before they started tracking finances (e.g. $500 already sitting in a savings account). Currently, this amount is saved directly onto the account record and never appears in the transaction history. As a result, the dashboard's Account Balance figure — which adds up all income and subtracts all expenses from recorded transactions — doesn't know about it. The user sees a balance on their account card that doesn't match what the dashboard reports.

The fix is straightforward: when a user enters a starting balance, the app automatically records it as a regular income entry in that account's history. From that point on, the amount is part of the transaction record and flows through all existing calculations correctly — the dashboard, account history, and any future reports all see it.

**Success looks like:** a user who creates a "Savings" account with $1,000 starting balance opens the dashboard and sees that $1,000 reflected in their Account Balance.

---

## 2. Functional Requirements (The "What")

### Requirement 1: Starting balance becomes an income entry automatically

When a user creates a new account and enters a starting balance greater than zero, the app immediately records an income transaction for that amount against the new account. The transaction is dated on the day the account is created, and its note is pre-filled with "Initial balance."

- **Acceptance Criteria:**
  - [x] Given a user creates an account named "Savings" with a starting balance of $1,000, the account's transaction history shows one income entry for $1,000.
  - [x] The date on that entry is the date the account was created.
  - [x] The note on that entry reads "Initial balance."
  - [x] The dashboard's Account Balance for the month the account was created includes the $1,000.

### Requirement 2: No transaction is created when the starting balance is zero or empty

If the user leaves the starting balance blank or explicitly enters zero, no transaction is recorded. The account starts with an empty history.

- **Acceptance Criteria:**
  - [x] Given a user creates an account with no starting balance (blank or $0), the account's transaction history is empty immediately after creation.

### Requirement 3: The auto-created transaction behaves like any other income entry

The transaction created from the starting balance is not special or locked. The user can edit its amount or note, and can cancel it entirely — the same way they would any income transaction.

- **Acceptance Criteria:**
  - [x] The "Initial balance" entry appears in the account history list alongside other transactions.
  - [x] The user can edit the amount of the entry; the account balance and the dashboard Account Balance update to reflect the change.
  - [x] The user can cancel the entry; the account balance drops to $0 and the dashboard no longer counts it.
  - [x] The user can edit the note on the entry to anything they like.

---

## 3. Scope and Boundaries

### In-Scope

- Automatically creating an income transaction when a new account is created with a non-zero starting balance.
- That transaction being visible in the account history and editable/cancellable like any other entry.
- The transaction being included in the dashboard's Account Balance calculation.

### Out-of-Scope

- **Existing accounts with a direct starting balance** — accounts already created before this fix are not affected by this spec. Handling their existing data is a separate technical concern.
- **Editing the starting balance field after account creation** — if the user later changes the initial amount via account settings, that interaction is a separate feature.
- **Multi-currency initial balances** — Phase 5 roadmap item.
- **Basic Reports & Charts, Crypto & Broker Integrations, Mobile Apps** — all separate roadmap items.
