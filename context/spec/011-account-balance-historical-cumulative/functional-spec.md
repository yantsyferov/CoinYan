# Functional Specification: Account Balance — Historical Cumulative Balance by Month

- **Roadmap Item:** Dashboard & Overview — At-a-Glance Financial Summary
- **Status:** Completed
- **Author:** yantsyferov

---

## 1. Overview and Rationale (The "Why")

The main dashboard provides a financial summary for the period the user is currently viewing. As users navigate between months, they expect the numbers they see to reflect reality for that specific period — not today's reality.

Currently, the **Account Balance** figure always shows the user's live, present-day total regardless of which month is selected. This means a user who browses back to April or March sees the same balance as they do today. This is misleading and undermines trust in the dashboard as a financial record: if the numbers don't match what the user remembers experiencing at that time, the product feels broken.

The goal is to make **Account Balance** historically accurate. When a user views any month in the past, they should see the cumulative financial position they held at the close of that month — not the one they hold today.

**Success looks like:** a user who navigated to April and sees $1,000 says "yes, that's exactly what I had at the end of April."

---

## 2. Functional Requirements (The "What")

### Requirement 1: Past months show end-of-month balance

When a user navigates to any **completed past month**, the Account Balance figure shows the cumulative total of all transactions recorded across all accounts — from the earliest transaction ever recorded up to and including the **last day of that month**.

- **Acceptance Criteria:**
  - [x] Given the user has an income of $1,000 recorded in April and a further $1,000 recorded in May, when they navigate to **April**, Account Balance shows **$1,000**.
  - [x] When the same user navigates to **May**, Account Balance shows **$2,000**.
  - [x] When the same user navigates to **June** (no new transactions in June), Account Balance shows **$2,000** — the cumulative total carries forward.

### Requirement 2: The current month shows a balance up to today

When a user views the **current, ongoing month**, Account Balance shows the cumulative total up to **today's date** — not the last day of the month.

- **Acceptance Criteria:**
  - [x] Given today is 15 May and the user views May, Account Balance reflects all transactions from the very beginning through 15 May — not through 31 May.

### Requirement 3: Months with no history show an empty state

When a user navigates to a month where **no transactions exist anywhere** — neither in that month nor in any earlier month — the Account Balance field does not show a monetary value. Instead, it shows a visual indicator that no financial data has been recorded yet (e.g. a dash, a placeholder, or a "No data" label).

- **Acceptance Criteria:**
  - [x] Given the user's earliest transaction is in April, when they navigate to **March**, Account Balance shows an empty/no-data indicator — not $0 and not a number.
  - [x] Given the same user navigates to **April**, Account Balance shows $1,000 (not an empty state), because transaction history now exists.

### Requirement 4: Transfers between the user's own accounts do not change the total balance

When a user moves money between two of their own accounts (e.g. from Cash to Bank Card), the Account Balance total for that month is **not affected**. Moving money between one's own accounts does not create or destroy wealth — the total remains the same.

- **Acceptance Criteria:**
  - [x] Given the user transfers $500 from Cash to Card in April (and has no other transactions), Account Balance for April is **not** increased or decreased as a result of that transfer.

---

## 3. Scope and Boundaries

### In-Scope

- The **Account Balance** summary figure on the main dashboard.
- Correct calculation when navigating to past months (end-of-month cutoff).
- Correct calculation when viewing the current month (today as cutoff).
- Empty/no-data display state for months with no prior transaction history.

### Out-of-Scope

- **Individual account card balances** — the balance shown per account (e.g. "Main Card: $450") is a separate feature and is not changed by this specification.
- **Income, Expenses, and Category Breakdown figures** — the other summary numbers on the dashboard follow their own period logic and are not covered here.
- **Basic Reports & Charts** — monthly/weekly spending charts and category breakdown reports are a separate roadmap item (Phase 4).
- **Multi-Currency Workspace** — handling of multiple currencies in the balance calculation is a future Phase 5 feature.
- **Automatic Bank Imports, Mobile Apps, Shared Accounts** — all future roadmap items, out of scope.
