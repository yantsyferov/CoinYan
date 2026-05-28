# Functional Specification: Custom Transaction Date

- **Roadmap Item:** Custom Transaction Date — Users can set the date of a transaction when creating or editing it; future dates are not permitted.
- **Status:** Completed
- **Author:** yantsyferov

---

## 1. Overview and Rationale (The "Why")

Today, every transaction in CoinYan is automatically timestamped with the moment the user logs it. This is a significant limitation: users often log transactions after the fact — at the end of the day, after a weekend, or even weeks later. Without the ability to specify when a transaction actually happened, the history becomes inaccurate and unreliable as a record of real financial activity.

This feature gives users control over the date of any transaction — both when creating a new one and when correcting an existing one. It transforms CoinYan from a "log it now" tool into a trustworthy personal financial ledger that reflects reality, not just the moment of data entry.

---

## 2. Functional Requirements (The "What")

### 2.1 Setting a Date When Creating a Transaction

- **As a** user creating an expense, income, or transfer, **I want to** specify the date on which the transaction actually occurred, **so that** my financial history accurately reflects when money moved, not when I logged it.
  - **Acceptance Criteria:**
    - [x] The transaction creation form includes a date field.
    - [x] The date field is pre-filled with today's date when the form is opened.
    - [x] The user can open a date picker by tapping/clicking the date field.
    - [x] The date picker displays a calendar view.
    - [x] All future dates (tomorrow and beyond) are visually grayed out and cannot be selected.
    - [x] Today's date is the latest selectable date.
    - [x] The user can navigate to any past month and year without restriction — there is no earliest selectable date.
    - [x] After selecting a date, the chosen date is shown in the date field.
    - [x] If the user clears the date field, the form can still be submitted (the field is not required).
    - [x] The form can be submitted with the pre-filled today's date without any user interaction on the date field.

### 2.2 Changing the Date of an Existing Transaction

- **As a** user reviewing my transaction history, **I want to** correct the date of an existing transaction, **so that** I can fix entries I logged on the wrong day.
  - **Acceptance Criteria:**
    - [x] When the user opens the edit form for any transaction (expense, income, or transfer), a date field is shown alongside the amount and note fields.
    - [x] The date field displays the transaction's currently saved date.
    - [x] The user can change the date using the same date picker described in section 2.1.
    - [x] Future dates remain grayed out and unselectable.
    - [x] After saving, the transaction reflects the newly selected date.
    - [x] After saving, the transaction appears in the correct chronological position in the history list (sorted by date, newest first).

### 2.3 Transaction History Ordering

- The transaction history in both account views and category/income source views is ordered by transaction date, with the most recent date at the top.
  - **Acceptance Criteria:**
    - [x] If a user logs a transaction dated three days ago, it appears below transactions dated today and yesterday in the history list.
    - [x] If a user edits a transaction and changes its date to a week ago, it moves to the appropriate position in the list after saving.
    - [x] Transactions with the same date maintain a consistent order (e.g., by time of entry).

---

## 3. Scope and Boundaries

### In-Scope

- A date picker field in the transaction creation form for all transaction types (expense, income, transfer).
- A date field in the transaction editing form for all transaction types.
- Pre-filling the date field with today's date as a default.
- Disabling future dates in the date picker (grayed out, unselectable).
- Unlimited lookback — users can select any past date with no earliest boundary.
- Chronological ordering of transaction history lists by transaction date.

### Out-of-Scope

- **Time selection** — users set the calendar date only; hours and minutes are not configurable in this feature.
- **Date-based filtering or search** — browsing transactions by a date range is a separate future capability.
- **Monthly & Weekly Spending Charts** — date-range report views are a separate roadmap item (Phase 4).
- **Category Breakdown Reports** — separate Phase 4 item.
- **Multi-Currency & Base Value Anchor** — future Phase 5 features.
- **Automatic Bank Imports** — future Phase 5 feature.
