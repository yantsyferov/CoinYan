import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  parseCurrencyText,
  getAuthToken,
  createExpenseTransaction,
  ensureActiveAccounts,
  ensureExpenseCategory,
} from './helpers';

const AMOUNT = 25;

test('cancel dialog — Keep dismisses without changing the transaction', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const category = await ensureExpenseCategory(request, token);

  const uniqueNote = `pw-dismiss-${Date.now()}`;
  await createExpenseTransaction(request, token, account.id, category.id, AMOUNT, uniqueNote);

  await page.goto(`/accounts/${account.id}`);
  await page.waitForLoadState('networkidle');

  // Capture balance
  const accountNameEl = page.getByText(account.name, { exact: true }).first();
  await expect(accountNameEl).toBeVisible({ timeout: 10_000 });
  const balanceEl = accountNameEl.locator('..').locator('div', {
    hasText: /^\$[0-9,.+-]+$/,
  }).first();
  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceSnapshot = parseCurrencyText(await balanceEl.textContent());

  const expenseRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(expenseRow).toBeVisible({ timeout: 10_000 });

  // ── "Keep" dismisses without cancelling ──────────────────────────────────
  await expenseRow.click();
  await page.getByRole('button', { name: 'Delete' }).click();
  const dialogTitle = page.locator('h3', { hasText: 'Cancel transaction?' });
  await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: 'Keep' }).click();

  await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });
  await expect(expenseRow).toBeVisible({ timeout: 5_000 });
  expect(parseCurrencyText(await balanceEl.textContent())).toBeCloseTo(balanceSnapshot, 1);
});

test('context menu — click-outside backdrop dismisses without changing the transaction', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const category = await ensureExpenseCategory(request, token);

  const uniqueNote = `pw-dismiss-ctx-${Date.now()}`;
  await createExpenseTransaction(request, token, account.id, category.id, AMOUNT, uniqueNote);

  await page.goto(`/accounts/${account.id}`);
  await page.waitForLoadState('networkidle');

  // Capture balance
  const accountNameEl = page.getByText(account.name, { exact: true }).first();
  await expect(accountNameEl).toBeVisible({ timeout: 10_000 });
  const balanceEl = accountNameEl.locator('..').locator('div', {
    hasText: /^\$[0-9,.+-]+$/,
  }).first();
  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceSnapshot = parseCurrencyText(await balanceEl.textContent());

  const expenseRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(expenseRow).toBeVisible({ timeout: 10_000 });

  // ── Click-outside of context menu dismisses without cancelling ────────────
  await expenseRow.click();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible({ timeout: 5_000 });

  // Click the top-left corner of the backdrop (far from the context menu)
  await page.mouse.click(10, 10);

  await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible({ timeout: 5_000 });
  await expect(expenseRow).toBeVisible({ timeout: 5_000 });
  expect(parseCurrencyText(await balanceEl.textContent())).toBeCloseTo(balanceSnapshot, 1);
});

test('cancel dialog — click-outside dismisses without changing the transaction', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const category = await ensureExpenseCategory(request, token);

  const uniqueNote = `pw-dismiss-dlg-${Date.now()}`;
  await createExpenseTransaction(request, token, account.id, category.id, AMOUNT, uniqueNote);

  await page.goto(`/accounts/${account.id}`);
  await page.waitForLoadState('networkidle');

  // Capture balance
  const accountNameEl = page.getByText(account.name, { exact: true }).first();
  await expect(accountNameEl).toBeVisible({ timeout: 10_000 });
  const balanceEl = accountNameEl.locator('..').locator('div', {
    hasText: /^\$[0-9,.+-]+$/,
  }).first();
  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceSnapshot = parseCurrencyText(await balanceEl.textContent());

  const expenseRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(expenseRow).toBeVisible({ timeout: 10_000 });

  // ── Click-outside of cancel dialog dismisses without cancelling ───────────
  await expenseRow.click();
  await page.getByRole('button', { name: 'Delete' }).click();
  const dialogTitle = page.locator('h3', { hasText: 'Cancel transaction?' });
  await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

  // Click the top-left corner of the fixed overlay (far from the centered dialog card)
  await page.mouse.click(10, 10);

  await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });
  await expect(expenseRow).toBeVisible({ timeout: 5_000 });
  expect(parseCurrencyText(await balanceEl.textContent())).toBeCloseTo(balanceSnapshot, 1);
});
