import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  parseCurrencyText,
  getAuthToken,
  createExpenseTransaction,
  ensureActiveAccounts,
  ensureExpenseCategory,
} from './helpers';

const INITIAL_AMOUNT = 40;
const EDITED_AMOUNT = 25;

test('edit an expense from the category detail page updates category total', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const category = await ensureExpenseCategory(request, token);

  const uniqueNote = `pw-edit-cat-${Date.now()}`;
  await createExpenseTransaction(request, token, account.id, category.id, INITIAL_AMOUNT, uniqueNote);

  await page.goto(`/categories/expense/${category.id}`);
  await page.waitForLoadState('networkidle');

  // Capture category total before edit
  const catNameEl = page.getByText(category.name, { exact: true }).first();
  await expect(catNameEl).toBeVisible({ timeout: 10_000 });
  const totalEl = catNameEl.locator('..').locator('div', { hasText: /^\$[0-9,.+-]+$/ }).first();
  await expect(totalEl).toBeVisible({ timeout: 10_000 });
  const totalBefore = parseCurrencyText(await totalEl.textContent());

  // Find the transaction row by unique note
  const expenseRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(expenseRow).toBeVisible({ timeout: 10_000 });

  // Open context menu, then click Edit
  // No .last() needed here — the category page has no "Edit" button in the header
  await expenseRow.click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();

  // Edit dialog should be visible
  const editDialog = page.locator('h3', { hasText: 'Edit Transaction' });
  await expect(editDialog).toBeVisible({ timeout: 10_000 });

  // Clear amount and type new value
  const amountInput = page.locator('input[type="number"][min="0.01"]');
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
  await expect(updatedRow).toContainText('25');

  // Category total should have decreased by the delta (40 → 25, so 15 less spent)
  await expect(totalEl).toBeVisible({ timeout: 10_000 });
  const totalAfter = parseCurrencyText(await totalEl.textContent());
  expect(totalAfter).toBeCloseTo(totalBefore - (INITIAL_AMOUNT - EDITED_AMOUNT), 1);
});
