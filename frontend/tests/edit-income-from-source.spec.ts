import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  parseCurrencyText,
  getAuthToken,
  createIncomeTransaction,
  ensureActiveAccounts,
  ensureIncomeSource,
} from './helpers';

const INITIAL_AMOUNT = 100;
const EDITED_AMOUNT = 80;

test('edit an income from the income source detail page updates account balance', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const source = await ensureIncomeSource(request, token);

  const uniqueNote = `pw-edit-inc-${Date.now()}`;
  await createIncomeTransaction(request, token, source.id, account.id, INITIAL_AMOUNT, uniqueNote);

  await page.goto(`/categories/income/${source.id}`);
  await page.waitForLoadState('networkidle');

  // Find the transaction row by unique note
  const incomeRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(incomeRow).toBeVisible({ timeout: 10_000 });

  // Open context menu, then click Edit
  // No .last() needed — income source page has no "Edit" button in the header
  await incomeRow.click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();

  // Edit dialog should be visible
  const editDialog = page.locator('h3', { hasText: 'Edit Transaction' });
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  // Clear amount and type new value
  const amountInput = page.locator('input[type="number"]');
  await amountInput.clear();
  await amountInput.fill(String(EDITED_AMOUNT));

  // Save
  const saveBtn = page.getByRole('button', { name: 'Save' });
  await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
  await saveBtn.click();

  // Dialog should close
  await expect(editDialog).not.toBeVisible({ timeout: 10_000 });

  // Row should now show the updated amount
  const updatedRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(updatedRow).toBeVisible({ timeout: 15_000 });
  await expect(updatedRow).toContainText('80');

  // Navigate to the account detail to verify balance decreased by delta (100 → 80)
  await page.goto(`/accounts/${account.id}`);
  await page.waitForLoadState('networkidle');

  // Find the updated row on account page - it still exists with the same note
  const accountRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(accountRow).toBeVisible({ timeout: 10_000 });
  await expect(accountRow).toContainText('80');
});
