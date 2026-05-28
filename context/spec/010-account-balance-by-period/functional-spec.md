# Functional Specification: Account Balance by Period on Dashboard

- **Roadmap Item:** Dashboard & Overview — At-a-Glance Financial Summary (refinement)
- **Status:** Completed
- **Author:** yantsyferov

---

## 1. Overview and Rationale (The "Why")

The Dashboard currently shows "Account Balance" as the real-time sum of all accounts, regardless of which month the user is viewing. This means that when a user browses a past month — for example, to understand their financial situation in January — the balance figure shown is today's balance, not January's. This creates a misleading picture: the income, expenses, and net balance all belong to January, but the account balance belongs to the present.

**Goal:** Make "Account Balance" consistent with the selected period. When viewing a past month, the user should see what their total account balance looked like at the close of that month — the same way a bank statement works.

**Additionally:** Since showing a balance for a month that hasn't happened yet has no meaning, users will not be able to navigate to future months at all.

**Success:** A user reviewing October 2025 sees income, expenses, net balance, and account balance all belonging to that same period. The numbers tell a coherent story about that month.

---

## 2. Functional Requirements (The "What")

### 2.1. Account Balance reflects the selected period

- When viewing a **past month**, "Account Balance" shows the total balance across all accounts as it stood at the **last day of that month**.
- When viewing the **current month** (in progress), "Account Balance" shows the **real-time balance** as of today — since the month is not yet over, today's figure is the most accurate available.
- The card label remains **"Account Balance"** in both cases.

**Acceptance Criteria:**
- [x] When the user selects a past month (e.g. January 2026), the Account Balance card shows the balance that existed at the end of January 2026, not today's balance.
- [x] When the user is on the current month, the Account Balance card shows today's real-time total balance.
- [x] Navigating between different past months updates the Account Balance figure accordingly each time.

### 2.2. Navigation is limited to present and past months

- The **forward arrow (›)** is disabled or hidden when the user is already viewing the current month — it is not possible to advance beyond it.
- The **month picker** (opened by clicking the month/year label) does not allow selecting any future month. Months after the current one are visually unavailable.

**Acceptance Criteria:**
- [x] When the user is on the current month, the › button is not clickable (disabled or hidden).
- [x] Opening the month picker while on the current month does not offer any selectable future month.
- [x] The user can still freely navigate backwards through past months using either the ‹ button or the picker.

---

## 3. Scope and Boundaries

### In-Scope

- Account Balance card on the Dashboard showing the end-of-month balance for past months
- Account Balance card showing today's real-time balance for the current month
- Blocking forward navigation past the current month (› button and month picker)

### Out-of-Scope

- Changing the card label from "Account Balance"
- Per-account historical balance breakdown (only the combined total is shown)
- Historical balance on any page other than the Dashboard
- Charts or graphs of how balance changed over time (Phase 4)
