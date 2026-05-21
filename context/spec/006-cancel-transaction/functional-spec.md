# Functional Specification: Cancel Any Transaction

- **Roadmap Item:** Phase 2 — Expense Management (extends transaction lifecycle)
- **Status:** Completed
- **Author:** CoinYan Team

---

## 1. Overview and Rationale (The "Why")

Today, CoinYan allows users to cancel only account-to-account transfers. If a user logs an expense or records income by mistake — wrong amount, wrong category, wrong account — there is no way to undo it. The entry stays forever, distorting their balances and monthly totals.

This creates an inconsistent and frustrating experience: one type of entry can be undone, but the most common ones cannot.

This feature makes cancellation universal. Any transaction in the app — whether it recorded a purchase, a salary received, or a money transfer — can be cancelled from within the history where it appears. Cancelling a transaction completely removes it and restores all affected balances and totals to what they were before.

**Success looks like:** A user who logged the wrong expense amount can fix it in two taps — find it in the history, cancel it, and re-log it correctly — without any lasting side effects.

---

## 2. Functional Requirements (The "What")

### 2.1 Cancelling an Expense

A user can cancel any expense entry from two places: the history of the account the money was taken from, or the history of the expense category it was assigned to.

Tapping the expense entry opens a confirmation dialog. If the user confirms, the entry disappears and the affected account balance and the category's monthly total are both restored to their pre-transaction values.

**Acceptance Criteria:**
- [x] Given I open an account's history, when I tap an expense entry, then a confirmation dialog appears asking me to confirm the cancellation.
- [x] Given I open an expense category's history, when I tap an expense entry, then the same confirmation dialog appears.
- [x] Given I confirm the cancellation, then the expense entry disappears from both the account history and the category history.
- [x] Given I confirm the cancellation, then the account balance increases by the cancelled amount (money is returned).
- [x] Given I confirm the cancellation, then the category's monthly total decreases by the cancelled amount.
- [x] Given I tap "Keep" or close the dialog without confirming, then nothing changes.

---

### 2.2 Cancelling an Income Entry

A user can cancel any income entry from two places: the history of the account the money was received into, or the history of the income source it was logged under.

Tapping the income entry opens a confirmation dialog. If the user confirms, the entry disappears and both the account balance and the income source's monthly total are restored.

**Acceptance Criteria:**
- [x] Given I open an account's history, when I tap an income entry, then a confirmation dialog appears.
- [x] Given I open an income source's history, when I tap an income entry, then the same confirmation dialog appears.
- [x] Given I confirm the cancellation, then the income entry disappears from both the account history and the income source history.
- [x] Given I confirm the cancellation, then the account balance decreases by the cancelled amount (money is removed).
- [x] Given I confirm the cancellation, then the income source's monthly total decreases by the cancelled amount.
- [x] Given I tap "Keep" or close the dialog, then nothing changes.

---

### 2.3 Cancelling a Transfer

Cancelling transfers already works from the account history. This feature extends consistent behaviour — no changes to the transfer cancellation logic itself, but the experience is now unified with expense and income cancellation.

**Acceptance Criteria:**
- [x] Given I open an account's history, when I tap a transfer entry, then a confirmation dialog appears.
- [x] Given I confirm, then both accounts involved in the transfer have their balances restored.
- [x] Given I confirm, then the transfer entry disappears from both accounts' histories.

---

### 2.4 Confirmation Dialog

Every cancellation — regardless of transaction type — requires explicit confirmation. The dialog shows what will be cancelled and offers two options: confirm or go back.

**Acceptance Criteria:**
- [x] The dialog clearly identifies what the user is about to cancel (e.g. type and amount).
- [x] The dialog has a "Cancel transaction" button to confirm and a "Keep" button to dismiss without action.
- [x] The dialog can be dismissed by tapping outside it or pressing "Keep", with no changes made.

---

## 3. Scope and Boundaries

### In-Scope
- Cancelling expense transactions from the account history or the expense category history
- Cancelling income transactions from the account history or the income source history
- Cancelling transfer transactions from either account's history (existing behaviour, unified experience)
- Confirmation dialog for all transaction types before any cancellation takes effect
- Full restoration of all affected balances and monthly totals upon cancellation

### Out-of-Scope
- **Editing a transaction** — users cannot change the amount, category, or note of an existing entry; they must cancel and re-log
- **Per-Category Budget Limits** — separate roadmap item
- **Dashboard & Overview** — separate roadmap item
- **Reports & Charts** — separate roadmap item
- **Bulk cancellation** — cancelling multiple entries at once is not part of this feature
