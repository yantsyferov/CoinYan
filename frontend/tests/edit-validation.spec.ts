import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  getAuthToken,
  createExpenseTransaction,
  ensureActiveAccounts,
  ensureExpenseCategory,
} from './helpers';

const INITIAL_AMOUNT = 50;

test('edit dialog validates amount and disables Save for invalid values', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const category = await ensureExpenseCategory(request, token);

  const uniqueNote = `pw-edit-valid-${Date.now()}`;
  await createExpenseTransaction(request, token, account.id, category.id, INITIAL_AMOUNT, uniqueNote);

  await page.goto(`/accounts/${account.id}`);
  await page.waitForLoadState('networkidle');

  // Find the transaction row and open the edit dialog
  const expenseRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(expenseRow).toBeVisible({ timeout: 10_000 });

  // Use .last() because the account page header also has an "Edit" button
  await expenseRow.click();
  await page.getByRole('button', { name: 'Edit' }).last().click();

  const editDialog = page.locator('h3', { hasText: 'Edit Transaction' });
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  const amountInput = page.locator('input[type="number"]');
  const saveBtn = page.getByRole('button', { name: 'Save' });
  const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true });

  // ── Test: amount = "0" → error visible, Save disabled ───────────────────
  await amountInput.clear();
  await amountInput.fill('0');
  // Trigger validation by tabbing away
  await amountInput.press('Tab');

  await expect(page.getByText('Amount must be greater than 0')).toBeVisible({ timeout: 5_000 });
  await expect(saveBtn).toBeDisabled({ timeout: 5_000 });

  // ── Test: amount = "-10" → error still visible, Save still disabled ──────
  await amountInput.clear();
  await amountInput.fill('-10');
  await amountInput.press('Tab');

  await expect(page.getByText('Amount must be greater than 0')).toBeVisible({ timeout: 5_000 });
  await expect(saveBtn).toBeDisabled({ timeout: 5_000 });

  // ── Test: amount = "25" → error gone, Save enabled ──────────────────────
  await amountInput.clear();
  await amountInput.fill('25');
  // Error should clear on valid input
  await expect(page.getByText('Amount must be greater than 0')).not.toBeVisible({ timeout: 5_000 });
  await expect(saveBtn).toBeEnabled({ timeout: 5_000 });

  // Cancel without saving — no changes should persist
  await cancelBtn.click();
  await expect(editDialog).not.toBeVisible({ timeout: 10_000 });

  // Row still shows original note (transaction was not changed)
  const originalRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(originalRow).toBeVisible({ timeout: 10_000 });
});
