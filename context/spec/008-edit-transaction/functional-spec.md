# Functional Specification: Edit Transaction

- **Roadmap Item:** Edit Transaction — allow users to correct the amount and note on any existing transaction
- **Status:** Completed
- **Author:** yantsyferov

---

## 1. Overview and Rationale (The "Why")

When a user logs a transaction, they may accidentally enter the wrong amount or an incorrect note. Currently, their only option is to cancel the entire transaction and re-enter it from scratch — a friction-heavy process that discourages accurate record-keeping.

This feature lets users fix a mistake directly on an existing transaction without deleting and recreating it. The result is a more forgiving, confidence-inspiring experience: users feel safe logging transactions quickly, knowing they can always correct details later.

**Success looks like:** A user who notices a wrong amount taps the transaction, edits the value, saves it in under ten seconds, and sees the corrected figure everywhere it appears — including updated account balances.

---

## 2. Functional Requirements (The "What")

### 2.1 Accessing the Edit Option via Context Menu

When a user taps any transaction entry in a list, a small **context menu** appears with two actions:

- **Edit** — opens the edit dialog for that transaction.
- **Delete** — triggers the existing cancellation/deletion flow (no change to that flow).

This context menu replaces the current behavior where a tap directly opens the "Cancel transaction?" confirmation. The context menu is available on every page that displays a transaction list:

- Account transaction history
- Expense category history
- Income source history

**Acceptance Criteria:**
- [x] When I tap a transaction anywhere in the app, a context menu appears with "Edit" and "Delete" options.
- [x] Tapping "Delete" behaves exactly as the current cancellation flow does today.
- [x] Tapping outside the context menu (or pressing a "back" / dismiss action) closes the menu without any changes.

### 2.2 The Edit Dialog

Tapping "Edit" opens a dialog pre-filled with the transaction's current values.

**Fields available for editing:**

| Field | Details |
|---|---|
| **Amount** | Pre-filled with the current amount. Required. Must be greater than zero. |
| **Note** | Pre-filled with the current note (may be empty). Optional free-text field. |

No other fields (date, category, account, income source, transaction type) can be changed in this dialog.

**Acceptance Criteria:**
- [x] When I tap "Edit," a dialog opens showing the current amount and note, ready to edit.
- [x] The "Save" button is disabled if the amount field is empty or contains a value of zero or less.
- [x] If I enter an invalid amount (zero, negative, or non-numeric), an inline error message is shown beneath the amount field and the "Save" button remains disabled.
- [x] I can clear and re-type a new amount; as soon as a valid value is entered, the error clears and "Save" becomes enabled.
- [x] I can edit, clear, or leave the note field unchanged — it is always optional.

### 2.3 Saving the Edit

When the user taps **Save** with a valid amount:

- The dialog closes silently (no toast or confirmation message).
- The transaction entry in the list immediately reflects the new amount and note.
- The affected account balance recalculates to reflect the difference between the old and new amount.
- All other pages that show this transaction or the affected account balance update to the new values.

**Acceptance Criteria:**
- [x] After saving, the dialog closes and the transaction in the list shows the updated amount and note.
- [x] The account balance shown on the Accounts page updates to reflect the corrected transaction amount.
- [x] If I navigate to a different page that shows the same transaction (e.g., the category history), the updated values are shown there too.
- [x] The monthly spending total for the transaction's category updates to reflect the new amount (for expense transactions).

### 2.4 Cancelling the Edit

Tapping **Cancel** (or dismissing the dialog) closes it without saving any changes. The transaction remains exactly as it was.

**Acceptance Criteria:**
- [x] Tapping "Cancel" closes the dialog and leaves the transaction unchanged.
- [x] No balance or total figures change after a cancelled edit.

### 2.5 Editing Transfers

Transfers move money between two of the user's own accounts. When a transfer is edited:

- A **single amount field** is shown, representing the value moved from the source account to the destination account.
- Both accounts' balances update to reflect the change (source decreases, destination increases by the new amount).

**Acceptance Criteria:**
- [x] When editing a transfer, only one amount field is shown (not separate "from" and "to" fields).
- [x] After saving a corrected transfer amount, both the source and destination account balances reflect the new value.

---

## 3. Scope and Boundaries

### In-Scope

- Editing the **amount** of any transaction (expense, income, or transfer).
- Editing the **note** of any transaction.
- Context menu (Edit / Delete) on all transaction list pages.
- Balance recalculation after an amount is changed.
- Transfers: single symmetric amount edit.

### Out-of-Scope

- Changing the **transaction type** (e.g., converting an expense into an income).
- Changing the **date** of a transaction.
- Changing the **category** of an expense transaction.
- Changing the **income source** of an income transaction.
- Changing the **accounts** involved in a transfer.
- Bulk editing multiple transactions at once.
- Edit history or audit log of changes.
- Dashboard & Overview (separate roadmap item).
- Basic Reports & Charts (separate roadmap item).
