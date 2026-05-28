import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  parseCurrencyText,
  getAuthToken,
  createIncomeTransaction,
  ensureActiveAccounts,
  ensureIncomeSource,
} from './helpers';

const AMOUNT = 80;

test('cancel an income transaction from the income source detail page', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const source = await ensureIncomeSource(request, token);

  const uniqueNote = `pw-inc-src-${Date.now()}`;
  await createIncomeTransaction(request, token, source.id, account.id, AMOUNT, uniqueNote);

  await page.goto(`/categories/income/${source.id}`);
  await page.waitForLoadState('networkidle');

  // Capture source total before
  const sourceNameEl = page.getByText(source.name, { exact: true }).first();
  await expect(sourceNameEl).toBeVisible({ timeout: 10_000 });
  const totalEl = sourceNameEl.locator('..').locator('div', { hasText: /^\$[0-9,.]+$/ }).first();
  await expect(totalEl).toBeVisible({ timeout: 10_000 });
  const totalBefore = parseCurrencyText(await totalEl.textContent());

  // Click the income row
  const incomeRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(incomeRow).toBeVisible({ timeout: 10_000 });
  await incomeRow.click();
  await page.getByRole('button', { name: 'Delete' }).click();

  // Dialog shows "Income · $80.00"
  const dialogTitle = page.locator('h3', { hasText: 'Cancel transaction?' });
  await expect(dialogTitle).toBeVisible({ timeout: 5_000 });
  const dialogContent = page.locator('div').filter({ hasText: 'Cancel transaction?' }).last();
  await expect(dialogContent).toContainText('Income');
  await expect(dialogContent).toContainText(String(AMOUNT));

  // Confirm cancellation
  await page.getByRole('button', { name: 'Cancel transaction' }).click();

  // Row gone
  await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });
  await expect(incomeRow).not.toBeVisible({ timeout: 15_000 });

  // Source total decreased by AMOUNT
  await expect(totalEl).toBeVisible({ timeout: 10_000 });
  const totalAfter = parseCurrencyText(await totalEl.textContent());
  expect(totalAfter).toBeCloseTo(totalBefore - AMOUNT, 1);
});
