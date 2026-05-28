import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  getAuthToken,
  ensureActiveAccounts,
  ensureExpenseCategory,
  gql,
  performDrag,
  getCircleByName,
} from './helpers';

// Helpers for date formatting that matches the app's formatDate output
function appFormatDate(isoDate: string): string {
  // Mirrors frontend/src/shared/lib/format-date.ts behaviour
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Creates an expense transaction via GraphQL BFF, passing transactionDate explicitly to avoid the null 422 bug. */
async function createExpenseWithDate(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  accountId: string,
  categoryId: string,
  amount: number,
  note: string,
  transactionDate: string,
): Promise<string> {
  const data = await gql<{ createExpenseTransaction: { id: string } }>(
    request,
    `mutation CreateExpenseTransaction($input: CreateExpenseTransactionInput!) {
       createExpenseTransaction(input: $input) { id }
     }`,
    {
      input: {
        accountId,
        expenseCategoryId: categoryId,
        amount,
        accountAmount: amount,
        accountCurrency: 'USD',
        exchangeRate: 1.0,
        note,
        transactionDate,
      },
    },
    token,
  );
  return data.createExpenseTransaction.id;
}

test.describe('Custom Transaction Date', () => {
  // ------------------------------------------------------------------
  // Test 1: Create expense with a past date — correct date shown in history
  // ------------------------------------------------------------------
  test('expense created with a past date shows that date in account transaction history', async ({ page, request }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);
    // Use a fresh isolated account so accumulated test data never exceeds the 100-row list limit
    const freshAccount = await gql<{ createAccount: { id: string; name: string } }>(
      request,
      `mutation CreateAccount($input: CreateAccountInput!) {
         createAccount(input: $input) { id name }
       }`,
      { input: { name: `PW-date-past-${Date.now()}`, icon: 'cash', currency: 'USD', startingBalance: 100 } },
      token,
    );
    const account = freshAccount.createAccount;
    const category = await ensureExpenseCategory(request, token);

    const pastDate = daysAgoIso(7);
    const uniqueNote = `pw-date-past-${Date.now()}`;

    // Create the transaction with a past date via API
    await createExpenseWithDate(request, token, account.id, category.id, 15, uniqueNote, pastDate);

    // Navigate to the account detail page (fresh account — only 1 transaction)
    await page.goto(`/accounts/${account.id}`);
    await page.waitForLoadState('networkidle');

    // Compute expected date string IN the browser to match its locale exactly
    const expectedDateText = await page.evaluate((isoDate: string) => {
      const [year, month, day] = isoDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }, pastDate);
    const todayFormatted = await page.evaluate((isoDate: string) => {
      const [year, month, day] = isoDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }, todayIso());

    // Find the transaction row by its unique note — fresh account means it will be in the list
    const txnRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
    await expect(txnRow).toBeVisible({ timeout: 15_000 });

    // The row must display the past date, NOT today's date
    await expect(txnRow).toContainText(expectedDateText);
    const rowText = await txnRow.textContent();
    expect(rowText).not.toContain(todayFormatted);
  });

  // ------------------------------------------------------------------
  // Test 2: Create transaction without changing date — defaults to today
  // ------------------------------------------------------------------
  test('expense created without changing the date defaults to today in account transaction history', async ({ page, request }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);
    const [account] = await ensureActiveAccounts(request, token, 1);
    const category = await ensureExpenseCategory(request, token);

    const uniqueNote = `pw-date-today-${Date.now()}`;

    // Open TransactionModal via drag
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accountCircle = getCircleByName(page, account.name);
    const categoryCircle = getCircleByName(page, category.name);

    await expect(accountCircle).toBeVisible({ timeout: 10_000 });
    await expect(categoryCircle).toBeVisible({ timeout: 10_000 });

    await performDrag(page, accountCircle, categoryCircle);

    // TransactionModal must open
    const modalHeading = page.locator('h2', { hasText: 'New Transaction' });
    await expect(modalHeading).toBeVisible({ timeout: 10_000 });

    // Do NOT change the date — just verify it defaults to today
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible({ timeout: 5_000 });
    expect(await dateInput.inputValue()).toBe(todayIso());

    // Fill amount
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('10');

    // Fill note via the text input
    const noteInput = page.locator('input[type="text"]');
    await noteInput.fill(uniqueNote);

    // Click Confirm with exact text match
    const confirmBtn = page.locator('button').filter({ hasText: /^Confirm$/ });
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
    await confirmBtn.click();

    // If budget warning appears, proceed anyway
    const confirmAnywayBtn = page.locator('button').filter({ hasText: /^Confirm anyway$/ });
    if (await confirmAnywayBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmAnywayBtn.click();
    }

    // Wait for modal to close
    await expect(modalHeading).not.toBeVisible({ timeout: 15_000 });

    // Navigate to account detail
    await page.goto(`/accounts/${account.id}`);
    await page.waitForLoadState('networkidle');

    // Find row
    const txnRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
    await expect(txnRow).toBeVisible({ timeout: 15_000 });

    // Date shown must be today's formatted date
    const todayFormatted = appFormatDate(todayIso());
    await expect(txnRow).toContainText(todayFormatted);
  });

  // ------------------------------------------------------------------
  // Test 3: Edit a transaction date — updated date shown in list
  // ------------------------------------------------------------------
  test('editing a transaction date updates the displayed date in the account history', async ({ page, request }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);
    // Use a fresh isolated account so the edited transaction stays within the 100-row limit
    const freshAccount2 = await gql<{ createAccount: { id: string; name: string } }>(
      request,
      `mutation CreateAccount($input: CreateAccountInput!) {
         createAccount(input: $input) { id name }
       }`,
      { input: { name: `PW-date-edit-${Date.now()}`, icon: 'cash', currency: 'USD', startingBalance: 100 } },
      token,
    );
    const account = freshAccount2.createAccount;
    const category = await ensureExpenseCategory(request, token);

    // Create a transaction via API with today's date (explicit to avoid BFF null bug)
    const uniqueNote = `pw-date-edit-${Date.now()}`;
    await createExpenseWithDate(request, token, account.id, category.id, 25, uniqueNote, todayIso());

    // Navigate to account detail page
    await page.goto(`/accounts/${account.id}`);
    await page.waitForLoadState('networkidle');

    // Find the transaction row
    const txnRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
    await expect(txnRow).toBeVisible({ timeout: 10_000 });

    // Open context menu → click Edit
    await txnRow.click();
    await page.getByRole('button', { name: 'Edit' }).last().click();

    // Edit dialog must be visible
    const editDialog = page.locator('h3', { hasText: 'Edit Transaction' });
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    // Date field must be visible
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible({ timeout: 5_000 });

    // Change date to 14 days ago
    const pastDate = daysAgoIso(14);
    await dateInput.fill(pastDate);
    expect(await dateInput.inputValue()).toBe(pastDate);

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(editDialog).not.toBeVisible({ timeout: 10_000 });

    // Compute expected date text in browser locale and verify the row shows the new date
    // (fresh isolated account means only 1 transaction — safely within the 100-row list limit)
    const expectedDateText = await page.evaluate((isoDate: string) => {
      const [year, month, day] = isoDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }, pastDate);

    const updatedRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
    await expect(updatedRow).toBeVisible({ timeout: 15_000 });
    await expect(updatedRow).toContainText(expectedDateText);
  });

  // ------------------------------------------------------------------
  // Test 4: Future date is blocked in the date picker (max attribute check)
  // ------------------------------------------------------------------
  test('date input in TransactionModal has max attribute set to today preventing future dates', async ({ page, request }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);
    const [account] = await ensureActiveAccounts(request, token, 1);
    const category = await ensureExpenseCategory(request, token);

    // Open TransactionModal via drag
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accountCircle = getCircleByName(page, account.name);
    const categoryCircle = getCircleByName(page, category.name);

    await expect(accountCircle).toBeVisible({ timeout: 10_000 });
    await expect(categoryCircle).toBeVisible({ timeout: 10_000 });

    await performDrag(page, accountCircle, categoryCircle);

    // TransactionModal must open
    const modalHeading = page.locator('h2', { hasText: 'New Transaction' });
    await expect(modalHeading).toBeVisible({ timeout: 10_000 });

    // Verify the create form date input has max = today
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible({ timeout: 5_000 });
    const maxAttr = await dateInput.getAttribute('max');
    expect(maxAttr).toBe(todayIso());

    // Also verify the EditTransactionDialog has the same max constraint.
    // Create a transaction via API (explicit transactionDate to avoid null bug), then edit it.
    const editNote = `pw-date-max-${Date.now()}`;
    await createExpenseWithDate(request, token, account.id, category.id, 5, editNote, todayIso());

    await page.goto(`/accounts/${account.id}`);
    await page.waitForLoadState('networkidle');

    const txnRow = page.locator('[role="button"]').filter({ hasText: editNote }).first();
    await expect(txnRow).toBeVisible({ timeout: 10_000 });
    await txnRow.click();
    await page.getByRole('button', { name: 'Edit' }).last().click();

    const editDialog = page.locator('h3', { hasText: 'Edit Transaction' });
    await expect(editDialog).toBeVisible({ timeout: 10_000 });

    const editDateInput = page.locator('input[type="date"]');
    await expect(editDateInput).toBeVisible({ timeout: 5_000 });
    const editMaxAttr = await editDateInput.getAttribute('max');
    expect(editMaxAttr).toBe(todayIso());
  });
});
