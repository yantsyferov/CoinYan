import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  parseCurrencyText,
  getAuthToken,
  createTransferTransaction,
  ensureActiveAccounts,
} from './helpers';

const AMOUNT = 200;

test('cancel a transfer from the account detail page restores both account balances', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [fromAccount, toAccount] = await ensureActiveAccounts(request, token, 2);

  // Create transfer
  const uniqueNote = `pw-transfer-${Date.now()}`;
  await createTransferTransaction(request, token, fromAccount.id, toAccount.id, AMOUNT, uniqueNote);

  // Navigate to fromAccount detail page
  await page.goto(`/accounts/${fromAccount.id}`);
  await page.waitForLoadState('networkidle');

  // Capture fromAccount balance (already reflects the outgoing transfer)
  const fromNameEl = page.getByText(fromAccount.name, { exact: true }).first();
  await expect(fromNameEl).toBeVisible({ timeout: 10_000 });
  const fromBalanceEl = fromNameEl.locator('..').locator('div', {
    hasText: /^\$[0-9,.+-]+$/,
  }).first();
  await expect(fromBalanceEl).toBeVisible({ timeout: 10_000 });
  const fromBalanceBefore = parseCurrencyText(await fromBalanceEl.textContent());

  // Find and click the transfer row
  const transferRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(transferRow).toBeVisible({ timeout: 10_000 });
  await transferRow.click();
  await page.getByRole('button', { name: 'Delete' }).click();

  // Dialog shows "Transfer · $200.00"
  const dialogTitle = page.locator('h3', { hasText: 'Cancel transaction?' });
  await expect(dialogTitle).toBeVisible({ timeout: 5_000 });
  const dialogContent = page.locator('div').filter({ hasText: 'Cancel transaction?' }).last();
  await expect(dialogContent).toContainText('Transfer');
  await expect(dialogContent).toContainText(String(AMOUNT));

  // Confirm cancellation
  await page.getByRole('button', { name: 'Cancel transaction' }).click();

  // Transfer row gone from fromAccount
  await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });
  await expect(transferRow).not.toBeVisible({ timeout: 15_000 });

  // fromAccount balance restored (increases by AMOUNT since transfer is reversed)
  await expect(fromBalanceEl).toBeVisible({ timeout: 10_000 });
  const fromBalanceAfter = parseCurrencyText(await fromBalanceEl.textContent());
  expect(fromBalanceAfter).toBeCloseTo(fromBalanceBefore + AMOUNT, 1);

  // Navigate to toAccount — the incoming transfer row should also be gone
  await page.goto(`/accounts/${toAccount.id}`);
  await page.waitForLoadState('networkidle');

  const toNameEl = page.getByText(toAccount.name, { exact: true }).first();
  await expect(toNameEl).toBeVisible({ timeout: 10_000 });

  const incomingRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(incomingRow).not.toBeVisible({ timeout: 10_000 });
});
