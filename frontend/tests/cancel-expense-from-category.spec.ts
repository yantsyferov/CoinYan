import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  parseCurrencyText,
  getAuthToken,
  createExpenseTransaction,
  ensureActiveAccounts,
  ensureExpenseCategory,
} from './helpers';

const AMOUNT = 30;

test('cancel an expense transaction from the expense category detail page', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const category = await ensureExpenseCategory(request, token);

  const uniqueNote = `pw-cat-${Date.now()}`;
  await createExpenseTransaction(request, token, account.id, category.id, AMOUNT, uniqueNote);

  await page.goto(`/categories/expense/${category.id}`);
  await page.waitForLoadState('networkidle');

  // Capture category total before cancellation
  const catNameEl = page.getByText(category.name, { exact: true }).first();
  await expect(catNameEl).toBeVisible({ timeout: 10_000 });
  const totalEl = catNameEl.locator('..').locator('div', { hasText: /^\$[0-9,.+-]+$/ }).first();
  await expect(totalEl).toBeVisible({ timeout: 10_000 });
  const totalBefore = parseCurrencyText(await totalEl.textContent());

  // Click the expense row
  const expenseRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(expenseRow).toBeVisible({ timeout: 10_000 });
  await expenseRow.click();

  // Dialog visible with correct content
  const dialogTitle = page.locator('h3', { hasText: 'Cancel transaction?' });
  await expect(dialogTitle).toBeVisible({ timeout: 5_000 });
  const dialogContent = page.locator('div').filter({ hasText: 'Cancel transaction?' }).last();
  await expect(dialogContent).toContainText('Expense');
  await expect(dialogContent).toContainText(String(AMOUNT));

  // Confirm cancellation
  await page.getByRole('button', { name: 'Cancel transaction' }).click();

  // Row gone
  await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });
  await expect(expenseRow).not.toBeVisible({ timeout: 15_000 });

  // Category total decreased by AMOUNT
  await expect(totalEl).toBeVisible({ timeout: 10_000 });
  const totalAfter = parseCurrencyText(await totalEl.textContent());
  expect(totalAfter).toBeCloseTo(totalBefore - AMOUNT, 1);
});
