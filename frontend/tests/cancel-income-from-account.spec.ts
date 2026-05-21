import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  gql,
  parseCurrencyText,
  getAuthToken,
  createIncomeTransaction,
  ensureActiveAccounts,
  ensureIncomeSource,
} from './helpers';

const AMOUNT = 100;

test('cancel an income transaction from the account detail page', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const source = await ensureIncomeSource(request, token);

  const uniqueNote = `pw-inc-acct-${Date.now()}`;
  await createIncomeTransaction(request, token, source.id, account.id, AMOUNT, uniqueNote);

  await page.goto(`/accounts/${account.id}`);
  await page.waitForLoadState('networkidle');

  // Capture balance before (already includes the income we just created)
  const accountNameEl = page.getByText(account.name, { exact: true }).first();
  await expect(accountNameEl).toBeVisible({ timeout: 10_000 });
  const balanceEl = accountNameEl.locator('..').locator('div', {
    hasText: /^\$[0-9,.+-]+$/,
  }).first();
  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceBefore = parseCurrencyText(await balanceEl.textContent());

  // Click the income row
  const incomeRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(incomeRow).toBeVisible({ timeout: 10_000 });
  await incomeRow.click();

  // Dialog shows "Income · $100.00"
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

  // Balance decreased by AMOUNT (income reversed)
  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceAfter = parseCurrencyText(await balanceEl.textContent());
  expect(balanceAfter).toBeCloseTo(balanceBefore - AMOUNT, 1);
});
