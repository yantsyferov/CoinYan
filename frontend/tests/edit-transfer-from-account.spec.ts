import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  parseCurrencyText,
  getAuthToken,
  createTransferTransaction,
  ensureActiveAccounts,
  gql,
} from './helpers';

const INITIAL_AMOUNT = 150;
const EDITED_AMOUNT = 100;

test('edit a transfer from the account detail page updates both account balances', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [fromAccount, toAccount] = await ensureActiveAccounts(request, token, 2);

  const uniqueNote = `pw-edit-xfer-${Date.now()}`;
  await createTransferTransaction(request, token, fromAccount.id, toAccount.id, INITIAL_AMOUNT, uniqueNote);

  // Fetch toAccount balance from API after creating the transfer (it includes the incoming 150)
  type AccountInfo = { id: string; currentBalance: number };
  const toAccountData = await gql<{ accounts: AccountInfo[] }>(
    request,
    '{ accounts { id currentBalance } }',
    undefined,
    token,
  );
  const toAccountBefore = toAccountData.accounts.find((a) => a.id === toAccount.id)?.currentBalance ?? 0;

  // Navigate to fromAccount detail page
  await page.goto(`/accounts/${fromAccount.id}`);
  await page.waitForLoadState('networkidle');

  // Capture fromAccount balance before edit
  const fromNameEl = page.getByText(fromAccount.name, { exact: true }).first();
  await expect(fromNameEl).toBeVisible({ timeout: 10_000 });
  const fromBalanceEl = fromNameEl.locator('..').locator('div', {
    hasText: /^\$[0-9,.+-]+$/,
  }).first();
  await expect(fromBalanceEl).toBeVisible({ timeout: 10_000 });
  const fromBalanceBefore = parseCurrencyText(await fromBalanceEl.textContent());

  // Find the transfer row and open context menu
  const transferRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(transferRow).toBeVisible({ timeout: 10_000 });

  // Open context menu, then click Edit
  // Use .last() because the account page header also has an "Edit" button
  await transferRow.click();
  await page.getByRole('button', { name: 'Edit' }).last().click();

  // Edit dialog should be visible
  const editDialog = page.locator('h3', { hasText: 'Edit Transaction' });
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  // Transfer-specific hint should be visible
  await expect(
    page.getByText('Editing the transfer amount will update both accounts.'),
  ).toBeVisible({ timeout: 5_000 });

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
  await expect(updatedRow).toContainText('100');

  // fromAccount balance should have increased by delta (150 → 100 outgoing, 50 less spent)
  await expect(fromBalanceEl).toBeVisible({ timeout: 10_000 });
  const fromBalanceAfter = parseCurrencyText(await fromBalanceEl.textContent());
  expect(fromBalanceAfter).toBeCloseTo(fromBalanceBefore + (INITIAL_AMOUNT - EDITED_AMOUNT), 1);

  // Navigate to toAccount to verify its balance also decreased by delta (50 less incoming)
  await page.goto(`/accounts/${toAccount.id}`);
  await page.waitForLoadState('networkidle');

  const toNameEl = page.getByText(toAccount.name, { exact: true }).first();
  await expect(toNameEl).toBeVisible({ timeout: 10_000 });
  const toBalanceEl = toNameEl.locator('..').locator('div', {
    hasText: /^\$[0-9,.+-]+$/,
  }).first();
  await expect(toBalanceEl).toBeVisible({ timeout: 10_000 });
  const toBalanceAfter = parseCurrencyText(await toBalanceEl.textContent());

  // toAccount received 100 instead of 150, so balance decreased by 50
  expect(toBalanceAfter).toBeCloseTo(toAccountBefore - (INITIAL_AMOUNT - EDITED_AMOUNT), 1);

  // The transfer row on toAccount should show the updated amount of 100
  const toRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(toRow).toBeVisible({ timeout: 10_000 });
  await expect(toRow).toContainText('100');
});
