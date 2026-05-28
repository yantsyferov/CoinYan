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
const EDITED_AMOUNT = 30;

test('edit an expense amount and note from the account detail page', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const category = await ensureExpenseCategory(request, token);

  const uniqueNote = `pw-edit-acct-${Date.now()}`;
  await createExpenseTransaction(request, token, account.id, category.id, INITIAL_AMOUNT, uniqueNote);

  await page.goto(`/accounts/${account.id}`);
  await page.waitForLoadState('networkidle');

  // Capture account balance before edit
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

  // Edit dialog should be visible
  const editDialog = page.locator('h3', { hasText: 'Edit Transaction' });
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  // Amount input is pre-filled with 50; clear and type new value
  const amountInput = page.locator('input[type="number"]');
  await amountInput.clear();
  await amountInput.fill(String(EDITED_AMOUNT));

  // Note input: clear and type new note
  const editedNote = `pw-edit-note-${Date.now()}`;
  const noteInput = page.locator('input[placeholder="Add a note..."]');
  await noteInput.clear();
  await noteInput.fill(editedNote);

  // Save button should be enabled
  const saveBtn = page.getByRole('button', { name: 'Save' });
  await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
  await saveBtn.click();

  // Dialog should close
  await expect(editDialog).not.toBeVisible({ timeout: 10_000 });

  // Row should show new note and new amount
  const updatedRow = page.locator('[role="button"]').filter({ hasText: editedNote }).first();
  await expect(updatedRow).toBeVisible({ timeout: 15_000 });
  await expect(updatedRow).toContainText('30');

  // Account balance should have increased by the delta (50 → 30 expense, so 20 less spent)
  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceAfter = parseCurrencyText(await balanceEl.textContent());
  expect(balanceAfter).toBeCloseTo(balanceBefore + (INITIAL_AMOUNT - EDITED_AMOUNT), 1);
});
