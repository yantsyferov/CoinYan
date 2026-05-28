import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  parseCurrencyText,
  getAuthToken,
  createExpenseTransaction,
  ensureActiveAccounts,
  ensureExpenseCategory,
} from './helpers';

const INITIAL_AMOUNT = 50;

test('cancelling the edit dialog makes no changes to the transaction or balance', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const category = await ensureExpenseCategory(request, token);

  const uniqueNote = `pw-edit-cancel-${Date.now()}`;
  await createExpenseTransaction(request, token, account.id, category.id, INITIAL_AMOUNT, uniqueNote);

  await page.goto(`/accounts/${account.id}`);
  await page.waitForLoadState('networkidle');

  // Capture account balance before opening edit dialog
  const accountNameEl = page.getByText(account.name, { exact: true }).first();
  await expect(accountNameEl).toBeVisible({ timeout: 10_000 });
  const balanceEl = accountNameEl.locator('..').locator('div', {
    hasText: /^\$[0-9,.+-]+$/,
  }).first();
  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceBefore = parseCurrencyText(await balanceEl.textContent());

  // Find the transaction row by unique note
  const expenseRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(expenseRow).toBeVisible({ timeout: 10_000 });

  // Open context menu, then click Edit
  // Use .last() because the account page header also has an "Edit" button
  await expenseRow.click();
  await page.getByRole('button', { name: 'Edit' }).last().click();

  const editDialog = page.locator('h3', { hasText: 'Edit Transaction' });
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  // Change the amount to 99 but do NOT save
  const amountInput = page.locator('input[type="number"]');
  await amountInput.clear();
  await amountInput.fill('99');

  // Click Cancel
  const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true });
  await cancelBtn.click();

  // Dialog should be gone
  await expect(editDialog).not.toBeVisible({ timeout: 10_000 });

  // Transaction row should still exist with the original note
  await expect(expenseRow).toBeVisible({ timeout: 10_000 });

  // Row should still show original amount (50), not the edited 99
  await expect(expenseRow).toContainText('50');
  await expect(expenseRow).not.toContainText('99');

  // Account balance should be unchanged
  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceAfter = parseCurrencyText(await balanceEl.textContent());
  expect(balanceAfter).toBeCloseTo(balanceBefore, 1);
});
