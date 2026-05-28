import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Opens the inline month picker, sets it to the given value (e.g. "2000-01"),
 * and waits for the period label button to update.
 *
 * The picker appears only when the user clicks the period-label button.
 * Setting the native input value via the prototype setter is required because
 * React controls the input; a plain `.fill()` would not fire the synthetic
 * onChange handler.
 */
async function navigateToMonth(
  page: import('@playwright/test').Page,
  isoMonth: string, // e.g. "2000-01"
  expectedLabel: string, // e.g. "January 2000"
): Promise<void> {
  // The period label is a plain <button> whose text is "Month YYYY"
  const periodBtn = page.locator('button').filter({ hasText: /^[A-Z][a-z]+ \d{4}$/ }).first();
  await expect(periodBtn).toBeVisible({ timeout: 10_000 });
  await periodBtn.click();

  const monthInput = page.locator('input[type="month"]');
  await expect(monthInput).toBeVisible({ timeout: 5_000 });

  // Use the native input value setter so React's synthetic onChange fires
  await monthInput.evaluate((el: HTMLInputElement, value: string) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, isoMonth);

  // Confirm the label updated — picker closes automatically on change
  await expect(page.getByRole('button', { name: expectedLabel })).toBeVisible({ timeout: 10_000 });
}

/**
 * Returns the text content of the "Account Balance" summary card value span.
 * SummaryCard DOM structure:
 *   <div>         ← card wrapper
 *     <span>label</span>
 *     <span>value</span>    ← this is what we read
 *   </div>
 */
async function getAccountBalanceText(
  page: import('@playwright/test').Page,
): Promise<string> {
  const labelSpan = page.locator('span', { hasText: 'Account Balance' }).first();
  await expect(labelSpan).toBeVisible({ timeout: 10_000 });
  // The label and value spans share the same parent div (the SummaryCard wrapper)
  const valueSpan = labelSpan.locator('..').locator('span').last();
  await expect(valueSpan).toBeVisible({ timeout: 10_000 });
  return (await valueSpan.textContent()) ?? '';
}

// ─── tests ──────────────────────────────────────────────────────────────────

test.describe('Dashboard — Account Balance historical cumulative display', () => {
  test.beforeEach(async ({ page }) => {
    // All three scenarios start from a fresh authenticated session on the dashboard
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('Scenario 1: current month shows a formatted currency value, not an em-dash', async ({ page }) => {
    // Business rule: the Account Balance card reflects the live cumulative balance
    // of all accounts as of the end of the current month. Because at least one
    // account exists (created during test-user setup) this must be a currency
    // string, never the "no data" sentinel "—".
    const balanceText = await getAccountBalanceText(page);

    // The value must NOT be the "no historical data" sentinel
    expect(balanceText).not.toBe('—');

    // The value must look like a currency formatted by formatCurrency():
    //   "symbol" + digits + "." + 2-decimal digits
    // e.g. "$1,234.56", "-$408.00", "$0.00"
    // We accept any currency symbol (user may have EUR/GBP accounts) but
    // the en-US number format with two decimal places is always present.
    expect(balanceText).toMatch(/[^\d]?\d[\d,]*\.\d{2}$/);
  });

  test('Scenario 2: a month before any transactions exist (year=2000, month=1) shows —', async ({ page }) => {
    // Business rule: for a calendar month that precedes ALL transactions in the
    // system the API returns null for totalAccountBalance, which the UI renders
    // as "—". This guards against showing a misleading $0.00 for a period where
    // the user had no accounts yet.
    await navigateToMonth(page, '2000-01', 'January 2000');
    await page.waitForLoadState('networkidle');

    const balanceText = await getAccountBalanceText(page);

    // Must be the sentinel — not a currency amount
    expect(balanceText).toBe('—');
  });

  test('Scenario 3: returning to current month after visiting a historical month restores the currency value', async ({ page }) => {
    // Business rule: the dashboard period selector must be stateless between
    // navigations — returning to the current month after browsing history must
    // always show live balance data, not the cached "no data" state.

    // Step A: navigate away to January 2000 to trigger the — state
    await navigateToMonth(page, '2000-01', 'January 2000');
    await page.waitForLoadState('networkidle');

    // Sanity-check: we are in the — state before testing the return trip
    const historicalText = await getAccountBalanceText(page);
    expect(historicalText).toBe('—');

    // Step B: click the "Today" button — it is shown whenever the selected
    // period is not the current calendar month
    const todayBtn = page.getByRole('button', { name: 'Today' });
    await expect(todayBtn).toBeVisible({ timeout: 5_000 });
    await todayBtn.click();

    // Wait for the period label to snap back to the current month
    const now = new Date();
    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const currentLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
    await expect(page.getByRole('button', { name: currentLabel })).toBeVisible({ timeout: 10_000 });

    await page.waitForLoadState('networkidle');

    // Step C: the Account Balance card must show a currency value again
    const restoredText = await getAccountBalanceText(page);

    expect(restoredText).not.toBe('—');
    expect(restoredText).toMatch(/[^\d]?\d[\d,]*\.\d{2}$/);
  });
});
