import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { parseCurrencyText } from './helpers';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Opens the "Add account" modal from the Home page by clicking the "+" button
 * inside the "Accounts" section.
 */
async function openCreateAccountModal(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // The Accounts section heading is an h2. Its sibling PlusButton triggers the modal.
  // Strategy: find the h2 with text "Accounts", then find the "+" button within the same section card.
  const accountsHeading = page.getByRole('heading', { name: 'Accounts', exact: true }).first();
  await expect(accountsHeading).toBeVisible({ timeout: 10_000 });

  // The PlusButton is a <button> rendered right next to the heading inside the same flex row.
  // We go up two levels (heading → flex row → section card) and find a button with text "+".
  const plusBtn = accountsHeading.locator('..').locator('..').locator('button', { hasText: '+' }).first();
  await expect(plusBtn).toBeVisible({ timeout: 5_000 });
  await plusBtn.click();

  // Modal should now be visible
  await expect(page.getByRole('heading', { name: 'Add account', exact: true })).toBeVisible({ timeout: 5_000 });
}

/**
 * Fills in the "Add account" form and submits.
 * Selects the first available icon (cash is pre-selected), types USD into
 * the currency search, picks the first match, and optionally sets a starting balance.
 */
async function fillAndSubmitAccountForm(
  page: import('@playwright/test').Page,
  name: string,
  startingBalance?: number,
): Promise<void> {
  // Name
  await page.getByPlaceholder('e.g. Main Card').fill(name);

  // Currency — type "USD" to filter, then click the first dropdown item
  const currencyInput = page.getByPlaceholder('Search currency...');
  await currencyInput.click();
  await currencyInput.fill('USD');

  // Wait for dropdown to show and click the "USD" option
  const usdOption = page.locator('div', { hasText: /^USD\s*—/ }).first();
  await expect(usdOption).toBeVisible({ timeout: 5_000 });
  await usdOption.click();

  // Starting balance (optional)
  if (startingBalance !== undefined) {
    await page.getByPlaceholder('0.00').fill(String(startingBalance));
  }

  // Submit
  await page.getByRole('button', { name: 'Save' }).click();

  // Wait for modal to close (heading disappears)
  await expect(page.getByRole('heading', { name: 'Add account', exact: true })).not.toBeVisible({ timeout: 10_000 });
}

/**
 * Reads the "Account Balance" value from the dashboard summary card.
 * Returns the numeric value parsed from the formatted currency string.
 */
async function getDashboardAccountBalance(page: import('@playwright/test').Page): Promise<number> {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const label = page.locator('span', { hasText: 'Account Balance' }).first();
  await expect(label).toBeVisible({ timeout: 10_000 });

  // SummaryCard structure: <div> > <span>{label}</span> <span>{value}</span>
  const valueSpan = label.locator('..').locator('span').last();
  await expect(valueSpan).toBeVisible({ timeout: 10_000 });

  const text = (await valueSpan.textContent()) ?? '';
  return parseCurrencyText(text);
}

/**
 * Navigates to the account detail page for the newly created account.
 * The account is found by its name in the Home page's Accounts section.
 */
async function navigateToAccountByName(
  page: import('@playwright/test').Page,
  accountName: string,
): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Find the account circle by its name label and click it to navigate
  const accountLabel = page.getByText(accountName, { exact: true }).first();
  await expect(accountLabel).toBeVisible({ timeout: 10_000 });
  await accountLabel.click();

  // Should land on the account detail page
  await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]+/, { timeout: 10_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Account initial balance — recorded as a transaction', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);
  });

  // Scenario 1 + 2: account with starting balance
  test('creating an account with a starting balance creates an Initial balance transaction and increases dashboard Account Balance by 500', async ({ page }) => {
    const STARTING_BALANCE = 500;
    const accountName = `PW Init Balance ${Date.now()}`;

    // ── Step 1: Record current Account Balance from dashboard ─────────────
    const balanceBefore = await getDashboardAccountBalance(page);

    // ── Step 2: Navigate to home, open create account modal ───────────────
    await openCreateAccountModal(page);

    // ── Step 3: Fill in form with starting balance and submit ─────────────
    await fillAndSubmitAccountForm(page, accountName, STARTING_BALANCE);

    // ── Step 4: Navigate to the new account's detail page ─────────────────
    await navigateToAccountByName(page, accountName);
    await page.waitForLoadState('networkidle');

    // ── Step 5: Assert one transaction with note "Initial balance" and $500 ─
    // The "Transactions" heading marks the start of the list
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible({ timeout: 10_000 });

    // Exactly one transaction row should be present
    const transactionRows = page.locator('[role="button"]');
    await expect(transactionRows).toHaveCount(1, { timeout: 10_000 });

    // That row must display "Initial balance" as its note
    const row = transactionRows.first();
    await expect(row).toContainText('Initial balance', { timeout: 10_000 });

    // It must show the amount — formatCurrency(500, 'USD') renders "$500.00"
    await expect(row).toContainText('500', { timeout: 10_000 });

    // ── Step 6: Assert dashboard Account Balance increased by 500 ──────────
    const balanceAfter = await getDashboardAccountBalance(page);
    expect(balanceAfter).toBeCloseTo(balanceBefore + STARTING_BALANCE, 1);
  });

  // Scenario 3: account without starting balance
  test('creating an account without a starting balance has empty transaction history', async ({ page }) => {
    const accountName = `PW No Balance ${Date.now()}`;

    // ── Step 1: Open create account modal ─────────────────────────────────
    await openCreateAccountModal(page);

    // ── Step 2: Fill form with NO starting balance and submit ─────────────
    await fillAndSubmitAccountForm(page, accountName);

    // ── Step 3: Navigate to the new account's detail page ─────────────────
    await navigateToAccountByName(page, accountName);
    await page.waitForLoadState('networkidle');

    // ── Step 4: Assert the "Transactions" heading is visible ───────────────
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible({ timeout: 10_000 });

    // ── Step 5: Assert no transaction rows exist — empty state message shown ─
    // The page renders "No transactions yet." when transactions.length === 0
    await expect(page.getByText('No transactions yet.')).toBeVisible({ timeout: 10_000 });

    // Additionally confirm no role="button" transaction rows are rendered
    const transactionRows = page.locator('[role="button"]');
    await expect(transactionRows).toHaveCount(0, { timeout: 10_000 });
  });
});
