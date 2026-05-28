# Functional Specification: Full Transaction History Grouped by Month

- **Roadmap Item:** Full Transaction History — Users can view the complete history of an account, expense category, or income source, organized by month, with older periods loading automatically as they scroll.
- **Status:** Completed
- **Author:** yantsyferov

---

## 1. Overview and Rationale (The "Why")

Today, the transaction history for any account, expense category, or income source shows only the transactions from the current month. A user who wants to review what happened last month, last quarter, or a year ago has no way to do so — the data simply isn't visible.

This is a significant gap for anyone using CoinYan as a reliable personal financial ledger. Users regularly need to look back: to verify a payment, understand a spending trend, or audit where their money went in a past period. Without historical visibility, CoinYan functions only as a "this month" tool rather than a complete financial record.

This feature gives every user a full, unbroken view of their financial history for any account, expense category, or income source — organized by month and loading seamlessly as they scroll back in time.

---

## 2. Functional Requirements (The "What")

### 2.1 Viewing the Complete History

- **As a** user viewing an account, expense category, or income source, **I want to** see all my past transactions — not just this month's — organized clearly by the month they occurred in, **so that** I can review, understand, and audit my complete financial history at any time.
  - **Acceptance Criteria:**
    - [x] When a user opens the detail view of any account, expense category, or income source, the transaction list includes transactions from all available months, not only the current month.
    - [x] Transactions are grouped under clearly labeled month headings (for example, "May 2026", "April 2026", "March 2026").
    - [x] Month groups are arranged in reverse chronological order — the most recent month appears at the top of the list.
    - [x] Within each month, individual transactions are ordered by date, with the most recent date appearing first.
    - [x] Months in which no transactions occurred are not shown — the list skips from one active month to the next.
    - [x] A month heading contains only the month name and year (for example, "May 2026") — no totals or counts.

### 2.2 Loading Older History Automatically

- **As a** user scrolling through my transaction history, **I want** older months to appear automatically as I reach the bottom of the list, **so that** I can keep scrolling back in time without pressing any button.
  - **Acceptance Criteria:**
    - [x] The history list uses infinite scroll: when the user scrolls to or near the bottom of the currently visible content, the next batch of older transactions loads and is appended below.
    - [x] While older data is loading, a visual loading indicator (such as a spinner) appears at the bottom of the list.
    - [x] When there are no more transactions to load (the user has reached the beginning of their complete history), the loading indicator disappears and no further loads occur.
    - [x] The user does not need to press a button or take any action to load older data — scrolling is sufficient.

---

## 3. Scope and Boundaries

### In-Scope

- Full transaction history in the account detail view.
- Full transaction history in the expense category detail view.
- Full transaction history in the income source detail view.
- Month-based section headers (name + year only) grouping transactions.
- Infinite scroll loading of older months.
- Skipping months with no transactions.

### Out-of-Scope

- **Date range filtering or search** — browsing by a custom date range is a separate future capability.
- **Monthly & Weekly Spending Charts** — visual reports and charts are a separate roadmap item (Phase 4).
- **Category Breakdown Reports** — separate Phase 4 item.
- **Per-month totals in the month header** — headers show name and year only; no income/expense totals or transaction counts.
- **"Jump to month" navigation** — directly jumping to a specific past month via a calendar or month selector is out of scope.
- **Dashboard home screen** — not affected by this change.
