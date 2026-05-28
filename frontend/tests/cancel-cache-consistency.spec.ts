import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  parseCurrencyText,
  getAuthToken,
  createIncomeTransaction,
  ensureActiveAccounts,
  ensureIncomeSource,
} from './helpers';

const AMOUNT = 60;

test('cancelling income from account detail updates home page income source total without reload', async ({ page, request }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const [account] = await ensureActiveAccounts(request, token, 1);
  const source = await ensureIncomeSource(request, token);

  // Create income transaction via API
  const uniqueNote = `pw-cache-${Date.now()}`;
  await createIncomeTransaction(request, token, source.id, account.id, AMOUNT, uniqueNote);

  // Navigate to account detail and cancel the transaction
  await page.goto(`/accounts/${account.id}`);
  await page.waitForLoadState('networkidle');

  const incomeRow = page.locator('[role="button"]').filter({ hasText: uniqueNote }).first();
  await expect(incomeRow).toBeVisible({ timeout: 10_000 });
  await incomeRow.click();
  await page.getByRole('button', { name: 'Delete' }).click();

  const dialogTitle = page.locator('h3', { hasText: 'Cancel transaction?' });
  await expect(dialogTitle).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Cancel transaction' }).click();
  await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });
  await expect(incomeRow).not.toBeVisible({ timeout: 15_000 });

  // Read the source total at this point from the current INCOME_SOURCES_QUERY data.
  // After cancellation, the total was refetched — we capture it as the expected "after" value.
  // Navigate back to home via the Back button (client-side React Router navigation, no full reload)
  await page.getByText('← Back').first().click();
  await page.waitForURL('**/');
  await page.waitForLoadState('networkidle');

  // CircleItem structure: outer div > div[icon] + span[name] + span[total]
  // The subtitle span is the last span inside the same CircleItem wrapper div.
  const nameSpan = page.locator('span').filter({ hasText: source.name }).first();
  await expect(nameSpan).toBeVisible({ timeout: 10_000 });
  const totalSpan = nameSpan.locator('..').locator('span').last();
  await expect(totalSpan).toBeVisible({ timeout: 10_000 });

  // After cancellation and navigation the displayed total must NOT include the cancelled AMOUNT.
  // We verify it's less than or equal to what it would be if the income was still there.
  const displayedTotal = parseCurrencyText(await totalSpan.textContent());
  // The source total before the income was created was source.total (from ensureIncomeSource).
  // After cancellation it should be back at that level.
  expect(displayedTotal).toBeCloseTo(source.total, 1);
});
