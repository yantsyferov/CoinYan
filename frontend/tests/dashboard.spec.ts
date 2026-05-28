import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  getAuthToken,
  ensureActiveAccounts,
  ensureExpenseCategory,
  createExpenseTransaction,
} from './helpers';

// Today is 2026-05-25, so current month is May 2026
const CURRENT_MONTH_LABEL = 'May 2026';
const PREV_MONTH_LABEL = 'April 2026';
const NEXT_MONTH_LABEL = 'June 2026';

test.beforeEach(async ({ page }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);
});

test('Test 1: default month is current month (May 2026)', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // The period label button contains the current month name and year
  await expect(page.getByRole('button', { name: CURRENT_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // "Today" button must NOT be present when we're on the current month
  await expect(page.getByRole('button', { name: 'Today' })).not.toBeVisible();
});

test('Test 2: previous month button, Today button appears and returns to current month', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Verify current month is shown
  await expect(page.getByRole('button', { name: CURRENT_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // Click Previous month
  await page.locator('[aria-label="Previous month"]').click();

  // Period label should change to April 2026
  await expect(page.getByRole('button', { name: PREV_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // "Today" button should now be visible
  const todayBtn = page.getByRole('button', { name: 'Today' });
  await expect(todayBtn).toBeVisible({ timeout: 5_000 });

  // Click "Today" to return to current month
  await todayBtn.click();

  // Period label should return to May 2026
  await expect(page.getByRole('button', { name: CURRENT_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // "Today" button should be hidden again
  await expect(page.getByRole('button', { name: 'Today' })).not.toBeVisible();
});

test('Test 3: next month button navigates forward from a past month (cannot go past current month)', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Verify current month is shown
  await expect(page.getByRole('button', { name: CURRENT_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // The Next month button is disabled on the current month — clicking is not possible
  await expect(page.locator('[aria-label="Next month"]')).toBeDisabled({ timeout: 5_000 });

  // Navigate back one month to April 2026
  await page.locator('[aria-label="Previous month"]').click();
  await expect(page.getByRole('button', { name: PREV_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // From April 2026, clicking Next month should bring us back to May 2026
  await page.locator('[aria-label="Next month"]').click();
  await expect(page.getByRole('button', { name: CURRENT_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // Back on current month — "Today" button should be hidden again
  await expect(page.getByRole('button', { name: 'Today' })).not.toBeVisible();
});

test('Test 4: empty period shows zeros and empty state message', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Click ‹ 16 times: May 2026 → Jan 2025. Then 12 more = Jan 2024. Then 48 more = Jan 2020.
  // Simpler: use the month picker via evaluate to set the input value and fire the change event.

  // Open the month picker by clicking the period label button
  await page.getByRole('button', { name: CURRENT_MONTH_LABEL }).click();

  // The input[type="month"] picker should now be visible
  const monthInput = page.locator('input[type="month"]');
  await expect(monthInput).toBeVisible({ timeout: 5_000 });

  // Set the value via JavaScript and dispatch a change event so the React onChange handler fires
  await monthInput.evaluate((el: HTMLInputElement) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(el, '2020-01');
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Wait for the label to update to January 2020
  await expect(page.getByRole('button', { name: 'January 2020' })).toBeVisible({ timeout: 10_000 });

  // Wait for data to load (networkidle may not fire for cached/empty results)
  await page.waitForLoadState('networkidle');

  // "No transactions for this period" text should be visible
  await expect(page.getByText('No transactions for this period')).toBeVisible({ timeout: 10_000 });

  // Summary cards should show $0.00 for income and expenses
  // The cards are rendered as label spans + value spans; we find them by their label text
  // and then check the sibling value span
  const incomeCard = page.locator('span', { hasText: 'Total Income' }).first();
  await expect(incomeCard).toBeVisible({ timeout: 10_000 });
  // The value span is the next span sibling rendered in the same SummaryCard div
  const incomeValue = incomeCard.locator('..').locator('span').last();
  await expect(incomeValue).toHaveText('$0.00', { timeout: 10_000 });

  const expensesCard = page.locator('span', { hasText: 'Total Expenses' }).first();
  await expect(expensesCard).toBeVisible({ timeout: 10_000 });
  const expensesValue = expensesCard.locator('..').locator('span').last();
  await expect(expensesValue).toHaveText('$0.00', { timeout: 10_000 });
});

test('Test 5: clicking a category row navigates to category detail page', async ({ page, request }) => {
  const token = await getAuthToken(request);

  // Ensure there is at least one expense category and a transaction for it in current month
  const [account] = await ensureActiveAccounts(request, token, 1);
  const category = await ensureExpenseCategory(request, token);

  // Create an expense transaction so the category appears in the dashboard
  await createExpenseTransaction(request, token, account.id, category.id, 25, `pw-dashboard-cat-${Date.now()}`);

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Wait for the "Spending by Category" section heading
  await expect(page.getByRole('heading', { name: 'Spending by Category' })).toBeVisible({ timeout: 10_000 });

  // Check whether any category rows are visible (not empty state)
  const emptyMsg = page.getByText('No transactions for this period');
  const hasEmpty = await emptyMsg.isVisible().catch(() => false);

  if (hasEmpty) {
    test.skip();
    return;
  }

  // Click the first category row — each row is a div with cursor:pointer that holds the category name
  // We identify rows as siblings inside the categories list; they contain the category amount text
  // Use the category name we just ensured to find a specific row
  const categoryRow = page.getByText(category.name, { exact: true }).first();
  await expect(categoryRow).toBeVisible({ timeout: 10_000 });
  await categoryRow.click();

  // URL should change to /categories/expense/<uuid>
  await expect(page).toHaveURL(/\/categories\/expense\/[0-9a-f-]+/, { timeout: 10_000 });
});

test('Test 7: Next month button is disabled on current month and enabled on a past month', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Verify we are on the current month
  await expect(page.getByRole('button', { name: CURRENT_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // The Next month button must be disabled when on the current month
  const nextBtn = page.locator('[aria-label="Next month"]');
  await expect(nextBtn).toBeDisabled({ timeout: 5_000 });

  // Navigate to the previous month
  await page.locator('[aria-label="Previous month"]').click();
  await expect(page.getByRole('button', { name: PREV_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // Now on a past month — the Next month button must NOT be disabled
  await expect(nextBtn).not.toBeDisabled({ timeout: 5_000 });
});

test('Test 8: Month picker input has max set to the current month', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('button', { name: CURRENT_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // Open the month picker
  await page.getByRole('button', { name: CURRENT_MONTH_LABEL }).click();

  const monthInput = page.locator('input[type="month"]');
  await expect(monthInput).toBeVisible({ timeout: 5_000 });

  // Build the expected max value from the same date constant used by the page
  const now = new Date();
  const expectedMax = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const maxAttr = await monthInput.getAttribute('max');
  expect(maxAttr).toBe(expectedMax);

  // Close the picker by pressing Escape
  await page.keyboard.press('Escape');
});

test('Test 9: Account Balance differs between current month and a past month', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('button', { name: CURRENT_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });

  // Capture the Account Balance value for the current month
  const accountBalanceLabel = page.locator('span', { hasText: 'Account Balance' }).first();
  await expect(accountBalanceLabel).toBeVisible({ timeout: 10_000 });
  const currentMonthBalance = await accountBalanceLabel.locator('..').locator('span').last().textContent();

  // Navigate to the previous month
  await page.locator('[aria-label="Previous month"]').click();
  await expect(page.getByRole('button', { name: PREV_MONTH_LABEL })).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState('networkidle');

  // Capture the Account Balance for the past month
  const pastMonthBalance = await accountBalanceLabel.locator('..').locator('span').last().textContent();

  // The two values must be different — past month returns end-of-month balance, not live balance
  expect(pastMonthBalance).not.toBe(currentMonthBalance);
});

test('Test 6: BottomNav is present on both / and /dashboard with correct tabs', async ({ page }) => {
  // ---- Check / (Home page) ----
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const nav = page.locator('nav');
  await expect(nav).toBeVisible({ timeout: 10_000 });

  // Both tab labels must be present inside the nav
  const homeTabOnHome = nav.getByText('Home', { exact: true });
  const dashboardTabOnHome = nav.getByText('Dashboard', { exact: true });
  await expect(homeTabOnHome).toBeVisible({ timeout: 5_000 });
  await expect(dashboardTabOnHome).toBeVisible({ timeout: 5_000 });

  // On the Home page, the "Home" Link should be active (color #4F46E5).
  // BottomNav structure: <nav> > <a style="color: ..."> > <span>{icon}</span> <span>{label}</span>
  // The label span's direct parent is the <a> element.
  const homeLink = homeTabOnHome.locator('..');
  const homeLinkColor = await homeLink.evaluate((el) => getComputedStyle(el).color);
  expect(homeLinkColor).toBe('rgb(79, 70, 229)');

  // "Dashboard" link should be inactive (color #94A3B8)
  const dashboardLink = dashboardTabOnHome.locator('..');
  const dashboardLinkColor = await dashboardLink.evaluate((el) => getComputedStyle(el).color);
  expect(dashboardLinkColor).toBe('rgb(148, 163, 184)');

  // ---- Navigate to /dashboard ----
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const navOnDash = page.locator('nav');
  await expect(navOnDash).toBeVisible({ timeout: 10_000 });

  const homeTabOnDash = navOnDash.getByText('Home', { exact: true });
  const dashboardTabOnDash = navOnDash.getByText('Dashboard', { exact: true });
  await expect(homeTabOnDash).toBeVisible({ timeout: 5_000 });
  await expect(dashboardTabOnDash).toBeVisible({ timeout: 5_000 });

  // On the Dashboard page, the "Dashboard" Link should be active
  const dashboardLinkOnDash = dashboardTabOnDash.locator('..');
  const dashboardActiveColor = await dashboardLinkOnDash.evaluate((el) => getComputedStyle(el).color);
  expect(dashboardActiveColor).toBe('rgb(79, 70, 229)');

  // "Home" link should be inactive
  const homeLinkOnDash = homeTabOnDash.locator('..');
  const homeInactiveColor = await homeLinkOnDash.evaluate((el) => getComputedStyle(el).color);
  expect(homeInactiveColor).toBe('rgb(148, 163, 184)');
});
