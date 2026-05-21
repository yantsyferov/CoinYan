# Tasks: Cancel Any Transaction — Automated E2E Tests

**Spec:** `context/spec/006-cancel-transaction/`
**Agent:** `qa-testing`
**Test location:** `frontend/tests/`
**Stack:** Playwright + running dev stack (localhost:5173)

---

## Slice 1: Setup + cancel expense from AccountDetailPage

- [x] Initialize Playwright project in `frontend/` — install `@playwright/test`, create `playwright.config.ts` targeting `http://localhost:5173`, add `tests/` directory, add a shared `auth.setup.ts` helper that logs in and saves auth state **[Agent: qa-testing]**
- [x] Write test `cancel-expense-from-account.spec.ts`:
  - Log in
  - Create an expense transaction (e.g. $50 from Spending Wallet → Supermarket)
  - Navigate to Spending Wallet account detail page
  - Tap the expense row → assert confirmation dialog appears with "Cancel transaction?" and shows "Expense · $50.00"
  - Click "Cancel transaction" → assert the row is gone, account balance has increased by $50 **[Agent: qa-testing]**
- [x] Run the test (`npx playwright test cancel-expense-from-account`) and assert it passes **[Agent: qa-testing]**

---

## Slice 2: Cancel expense from ExpenseCategoryDetailPage

- [x] Write test `cancel-expense-from-category.spec.ts`:
  - Log in
  - Create an expense ($30 → Supermarket)
  - Navigate to Supermarket category detail page
  - Tap the expense row → assert dialog appears with amount
  - Confirm → assert the entry disappears, category total decreased by $30 **[Agent: qa-testing]**
- [x] Run the test and assert it passes **[Agent: qa-testing]**

---

## Slice 3: Cancel income from AccountDetailPage and IncomeSourceDetailPage

- [x] Write test `cancel-income-from-account.spec.ts`:
  - Log in
  - Create an income transaction ($100 from Salary → Test Card)
  - Navigate to Test Card account detail page
  - Tap the income row → dialog shows "Income · $100.00"
  - Confirm → account balance decreased by $100 **[Agent: qa-testing]**
- [x] Write test `cancel-income-from-source.spec.ts`:
  - Log in
  - Create an income transaction ($80 from Salary → Test Card)
  - Navigate to Salary income source detail page
  - Tap the income row → confirm → entry disappears, Salary total decreased by $80 **[Agent: qa-testing]**
- [x] Run both tests and assert they pass **[Agent: qa-testing]**

---

## Slice 4: Cache consistency — home page totals update without page reload

- [x] Write test `cancel-cache-consistency.spec.ts`:
  - Log in
  - Create an income transaction ($60 from Salary → Test Card)
  - Navigate to Test Card → cancel the transaction
  - Navigate back to home page via ← Back (no reload)
  - Assert Salary total returned to the original value **[Agent: qa-testing]**
- [x] Run the test and assert it passes **[Agent: qa-testing]**

---

## Slice 5: Cancel transfer from AccountDetailPage

- [x] Write test `cancel-transfer-from-account.spec.ts`:
  - Log in
  - Create a transfer ($200 from Account A → Account B)
  - Navigate to Account A detail page
  - Tap the transfer row → assert dialog shows "Cancel transaction?" with the amount
  - Confirm → fromAccount balance is restored, transfer row is gone from Account A
  - Navigate to Account B → assert transfer row is gone there too **[Agent: qa-testing]**
- [x] Run the test and assert it passes **[Agent: qa-testing]**

---

## Slice 6: Dialog — "Keep" and click-outside dismiss without changes

- [x] Write test `cancel-dialog-dismiss.spec.ts`:
  - Log in
  - Create an expense ($25)
  - Navigate to account detail page → tap the row → dialog appears
  - Click "Keep" → assert dialog closed, row still present, balance unchanged
  - Tap the row again → click outside the dialog → assert dialog closed, row still present **[Agent: qa-testing]**
- [x] Run the test and assert it passes **[Agent: qa-testing]**
